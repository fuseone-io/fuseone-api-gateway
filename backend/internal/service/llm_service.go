package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// ChatMessage is a single turn in a conversation.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResult holds the LLM response and token counts.
type ChatResult struct {
	Content   string `json:"content"`
	TokensIn  int    `json:"tokens_in"`
	TokensOut int    `json:"tokens_out"`
}

// LLMService manages provider configuration and chat execution.
type LLMService struct {
	repo         *repository.LLMRepository
	crypto       *CryptoService
	httpClient   *http.Client // non-streaming: 60s timeout
	streamClient *http.Client // streaming: no timeout (cancelled by request context)
	logger       *zap.Logger
}

// NewLLMService creates a new LLMService.
func NewLLMService(repo *repository.LLMRepository, crypto *CryptoService, logger *zap.Logger) *LLMService {
	return &LLMService{
		repo:         repo,
		crypto:       crypto,
		httpClient:   &http.Client{Timeout: 60 * time.Second},
		streamClient: &http.Client{Timeout: 0},
		logger:       logger,
	}
}

// ErrNoProvider is returned when no LLM provider is configured and enabled.
var ErrNoProvider = fmt.Errorf("no LLM provider configured and enabled")

// ErrQuotaExceeded is returned when the daily quota has been reached.
var ErrQuotaExceeded = fmt.Errorf("daily quota exceeded for this provider")

// CheckAvailable returns nil if an active provider exists, ErrNoProvider otherwise.
func (s *LLMService) CheckAvailable(ctx context.Context) error {
	cfg, _, err := s.repo.GetActive(ctx)
	if err != nil {
		return err
	}
	if cfg == nil {
		return ErrNoProvider
	}
	return nil
}

// Chat sends messages to the active LLM provider and returns the response.
func (s *LLMService) Chat(ctx context.Context, userID *uuid.UUID, messages []ChatMessage, endpoint string) (*ChatResult, error) {
	cfg, encKey, err := s.repo.GetActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("get active provider: %w", err)
	}
	if cfg == nil {
		return nil, ErrNoProvider
	}

	if err := s.checkQuota(ctx, cfg); err != nil {
		return nil, err
	}

	apiKey, err := s.crypto.Decrypt(encKey)
	if err != nil {
		return nil, fmt.Errorf("decrypt api key: %w", err)
	}

	start := time.Now()
	result, callErr := s.callProvider(ctx, cfg.Provider, cfg.Model, string(apiKey), messages)

	log := &model.LLMUsageLog{
		Provider:   string(cfg.Provider),
		Model:      cfg.Model,
		Endpoint:   endpoint,
		DurationMs: int(time.Since(start).Milliseconds()),
		Success:    callErr == nil,
		UserID:     userID,
	}
	if callErr != nil {
		log.ErrorMessage = callErr.Error()
	} else {
		log.TokensIn = result.TokensIn
		log.TokensOut = result.TokensOut
	}
	logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer logCancel()
	if logErr := s.repo.InsertLog(logCtx, log); logErr != nil {
		s.logger.Warn("failed to log llm usage", zap.Error(logErr))
	}

	if callErr != nil {
		return nil, callErr
	}
	return result, nil
}

func (s *LLMService) checkQuota(ctx context.Context, cfg *model.LLMConfig) error {
	if cfg.DailyQuota == 0 {
		return nil
	}
	count, err := s.repo.CountTodayUsage(ctx, cfg.Provider)
	if err != nil {
		s.logger.Warn("failed to count today's LLM usage", zap.Error(err))
		return nil // don't block on DB error
	}
	if count >= cfg.DailyQuota {
		return ErrQuotaExceeded
	}
	return nil
}

func (s *LLMService) callProvider(ctx context.Context, provider model.LLMProvider, model_, apiKey string, messages []ChatMessage) (*ChatResult, error) {
	switch provider {
	case model.ProviderOpenAI, model.ProviderGroq:
		return s.callOpenAICompat(ctx, provider, model_, apiKey, messages)
	case model.ProviderAnthropic:
		return s.callAnthropic(ctx, model_, apiKey, messages)
	case model.ProviderGoogle:
		return s.callGoogle(ctx, model_, apiKey, messages)
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}
}

// --- OpenAI-compatible (OpenAI + Groq) ---

type openAIRequest struct {
	Model    string          `json:"model"`
	Messages []ChatMessage   `json:"messages"`
	MaxTokens int            `json:"max_tokens,omitempty"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (s *LLMService) callOpenAICompat(ctx context.Context, provider model.LLMProvider, modelID, apiKey string, messages []ChatMessage) (*ChatResult, error) {
	baseURL := "https://api.openai.com/v1/chat/completions"
	if provider == model.ProviderGroq {
		baseURL = "https://api.groq.com/openai/v1/chat/completions"
	}

	body, _ := json.Marshal(openAIRequest{Model: modelID, Messages: messages, MaxTokens: 2048})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var oaiResp openAIResponse
	if err := json.Unmarshal(raw, &oaiResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if oaiResp.Error != nil {
		return nil, fmt.Errorf("provider error: %s", oaiResp.Error.Message)
	}
	if len(oaiResp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from provider")
	}
	return &ChatResult{
		Content:   oaiResp.Choices[0].Message.Content,
		TokensIn:  oaiResp.Usage.PromptTokens,
		TokensOut: oaiResp.Usage.CompletionTokens,
	}, nil
}

// --- Anthropic ---

type anthropicRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	System    string          `json:"system,omitempty"`
	Messages  []ChatMessage   `json:"messages"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (s *LLMService) callAnthropic(ctx context.Context, modelID, apiKey string, messages []ChatMessage) (*ChatResult, error) {
	// Extract system message if present; Anthropic has a separate system field
	var system string
	var userMessages []ChatMessage
	for _, m := range messages {
		if m.Role == "system" {
			system = m.Content
		} else {
			userMessages = append(userMessages, m)
		}
	}

	body, _ := json.Marshal(anthropicRequest{
		Model:     modelID,
		MaxTokens: 2048,
		System:    system,
		Messages:  userMessages,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var aResp anthropicResponse
	if err := json.Unmarshal(raw, &aResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if aResp.Error != nil {
		return nil, fmt.Errorf("provider error: %s", aResp.Error.Message)
	}
	if len(aResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from provider")
	}
	return &ChatResult{
		Content:   aResp.Content[0].Text,
		TokensIn:  aResp.Usage.InputTokens,
		TokensOut: aResp.Usage.OutputTokens,
	}, nil
}

// --- Google Gemini ---

type geminiRequest struct {
	Contents         []geminiContent        `json:"contents"`
	SystemInstruction *geminiContent        `json:"systemInstruction,omitempty"`
	GenerationConfig  geminiGenerationConfig `json:"generationConfig"`
}

type geminiContent struct {
	Role  string        `json:"role,omitempty"`
	Parts []geminiPart  `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiGenerationConfig struct {
	MaxOutputTokens int `json:"maxOutputTokens"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	UsageMetadata struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
	} `json:"usageMetadata"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (s *LLMService) callGoogle(ctx context.Context, modelID, apiKey string, messages []ChatMessage) (*ChatResult, error) {
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		modelID, apiKey,
	)

	var systemInstruction *geminiContent
	var contents []geminiContent
	for _, m := range messages {
		if m.Role == "system" {
			systemInstruction = &geminiContent{Parts: []geminiPart{{Text: m.Content}}}
			continue
		}
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, geminiContent{
			Role:  role,
			Parts: []geminiPart{{Text: m.Content}},
		})
	}

	body, _ := json.Marshal(geminiRequest{
		Contents:          contents,
		SystemInstruction: systemInstruction,
		GenerationConfig:  geminiGenerationConfig{MaxOutputTokens: 2048},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var gResp geminiResponse
	if err := json.Unmarshal(raw, &gResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if gResp.Error != nil {
		return nil, fmt.Errorf("provider error: %s", gResp.Error.Message)
	}
	if len(gResp.Candidates) == 0 || len(gResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from provider")
	}
	return &ChatResult{
		Content:   gResp.Candidates[0].Content.Parts[0].Text,
		TokensIn:  gResp.UsageMetadata.PromptTokenCount,
		TokensOut: gResp.UsageMetadata.CandidatesTokenCount,
	}, nil
}

// =============================================================================
// Streaming
// =============================================================================

// ChatStream calls the active provider with streaming and invokes onChunk for each text delta.
func (s *LLMService) ChatStream(ctx context.Context, userID *uuid.UUID, messages []ChatMessage, endpoint string, onChunk func(string)) (*ChatResult, error) {
	cfg, encKey, err := s.repo.GetActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("get active provider: %w", err)
	}
	if cfg == nil {
		return nil, ErrNoProvider
	}
	if err := s.checkQuota(ctx, cfg); err != nil {
		return nil, err
	}
	apiKey, err := s.crypto.Decrypt(encKey)
	if err != nil {
		return nil, fmt.Errorf("decrypt api key: %w", err)
	}

	start := time.Now()
	result, callErr := s.callProviderStream(ctx, cfg.Provider, cfg.Model, string(apiKey), messages, onChunk)

	log := &model.LLMUsageLog{
		Provider:   string(cfg.Provider),
		Model:      cfg.Model,
		Endpoint:   endpoint,
		DurationMs: int(time.Since(start).Milliseconds()),
		Success:    callErr == nil,
		UserID:     userID,
	}
	if callErr != nil {
		log.ErrorMessage = callErr.Error()
	} else {
		log.TokensIn = result.TokensIn
		log.TokensOut = result.TokensOut
	}
	logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer logCancel()
	if logErr := s.repo.InsertLog(logCtx, log); logErr != nil {
		s.logger.Warn("failed to log llm usage", zap.Error(logErr))
	}
	if callErr != nil {
		return nil, callErr
	}
	return result, nil
}

func (s *LLMService) callProviderStream(ctx context.Context, provider model.LLMProvider, model_, apiKey string, messages []ChatMessage, onChunk func(string)) (*ChatResult, error) {
	switch provider {
	case model.ProviderOpenAI, model.ProviderGroq:
		return s.callOpenAICompatStream(ctx, provider, model_, apiKey, messages, onChunk)
	case model.ProviderAnthropic:
		return s.callAnthropicStream(ctx, model_, apiKey, messages, onChunk)
	case model.ProviderGoogle:
		return s.callGoogleStream(ctx, model_, apiKey, messages, onChunk)
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}
}

// --- OpenAI/Groq streaming ---

type openAIStreamRequest struct {
	Model         string                 `json:"model"`
	Messages      []ChatMessage          `json:"messages"`
	MaxTokens     int                    `json:"max_tokens,omitempty"`
	Stream        bool                   `json:"stream"`
	StreamOptions map[string]interface{} `json:"stream_options,omitempty"`
}

type openAIStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

func (s *LLMService) callOpenAICompatStream(ctx context.Context, provider model.LLMProvider, modelID, apiKey string, messages []ChatMessage, onChunk func(string)) (*ChatResult, error) {
	baseURL := "https://api.openai.com/v1/chat/completions"
	if provider == model.ProviderGroq {
		baseURL = "https://api.groq.com/openai/v1/chat/completions"
	}

	body, _ := json.Marshal(openAIStreamRequest{
		Model:         modelID,
		Messages:      messages,
		MaxTokens:     2048,
		Stream:        true,
		StreamOptions: map[string]interface{}{"include_usage": true},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.streamClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		var errResp openAIResponse
		json.Unmarshal(raw, &errResp)
		if errResp.Error != nil {
			return nil, fmt.Errorf("provider error: %s", errResp.Error.Message)
		}
		return nil, fmt.Errorf("provider returned %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 64*1024)
	var tokensIn, tokensOut int

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var chunk openAIStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if chunk.Usage != nil {
			tokensIn = chunk.Usage.PromptTokens
			tokensOut = chunk.Usage.CompletionTokens
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			onChunk(chunk.Choices[0].Delta.Content)
		}
	}
	return &ChatResult{TokensIn: tokensIn, TokensOut: tokensOut}, scanner.Err()
}

// --- Anthropic streaming ---

type anthropicStreamRequest struct {
	Model     string        `json:"model"`
	MaxTokens int           `json:"max_tokens"`
	System    string        `json:"system,omitempty"`
	Messages  []ChatMessage `json:"messages"`
	Stream    bool          `json:"stream"`
}

func (s *LLMService) callAnthropicStream(ctx context.Context, modelID, apiKey string, messages []ChatMessage, onChunk func(string)) (*ChatResult, error) {
	var system string
	var userMessages []ChatMessage
	for _, m := range messages {
		if m.Role == "system" {
			system = m.Content
		} else {
			userMessages = append(userMessages, m)
		}
	}

	body, _ := json.Marshal(anthropicStreamRequest{
		Model:     modelID,
		MaxTokens: 2048,
		System:    system,
		Messages:  userMessages,
		Stream:    true,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.streamClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		var errResp anthropicResponse
		json.Unmarshal(raw, &errResp)
		if errResp.Error != nil {
			return nil, fmt.Errorf("provider error: %s", errResp.Error.Message)
		}
		return nil, fmt.Errorf("provider returned %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 64*1024)
	var tokensIn, tokensOut int
	var currentEvent string

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event: ") {
			currentEvent = strings.TrimPrefix(line, "event: ")
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")

		switch currentEvent {
		case "content_block_delta":
			var delta struct {
				Delta struct {
					Text string `json:"text"`
				} `json:"delta"`
			}
			if err := json.Unmarshal([]byte(data), &delta); err == nil && delta.Delta.Text != "" {
				onChunk(delta.Delta.Text)
			}
		case "message_start":
			var msg struct {
				Message struct {
					Usage struct {
						InputTokens int `json:"input_tokens"`
					} `json:"usage"`
				} `json:"message"`
			}
			if err := json.Unmarshal([]byte(data), &msg); err == nil {
				tokensIn = msg.Message.Usage.InputTokens
			}
		case "message_delta":
			var delta struct {
				Usage struct {
					OutputTokens int `json:"output_tokens"`
				} `json:"usage"`
			}
			if err := json.Unmarshal([]byte(data), &delta); err == nil {
				tokensOut = delta.Usage.OutputTokens
			}
		}
		currentEvent = ""
	}
	return &ChatResult{TokensIn: tokensIn, TokensOut: tokensOut}, scanner.Err()
}

// --- Google Gemini streaming ---

func (s *LLMService) callGoogleStream(ctx context.Context, modelID, apiKey string, messages []ChatMessage, onChunk func(string)) (*ChatResult, error) {
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?key=%s&alt=sse",
		modelID, apiKey,
	)

	var systemInstruction *geminiContent
	var contents []geminiContent
	for _, m := range messages {
		if m.Role == "system" {
			systemInstruction = &geminiContent{Parts: []geminiPart{{Text: m.Content}}}
			continue
		}
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, geminiContent{Role: role, Parts: []geminiPart{{Text: m.Content}}})
	}

	body, _ := json.Marshal(geminiRequest{
		Contents:          contents,
		SystemInstruction: systemInstruction,
		GenerationConfig:  geminiGenerationConfig{MaxOutputTokens: 2048},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.streamClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		var errResp geminiResponse
		json.Unmarshal(raw, &errResp)
		if errResp.Error != nil {
			return nil, fmt.Errorf("provider error: %s", errResp.Error.Message)
		}
		return nil, fmt.Errorf("provider returned %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 64*1024)
	var tokensIn, tokensOut int

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var gResp geminiResponse
		if err := json.Unmarshal([]byte(data), &gResp); err != nil {
			continue
		}
		if gResp.Error != nil {
			return nil, fmt.Errorf("provider error: %s", gResp.Error.Message)
		}
		if len(gResp.Candidates) > 0 && len(gResp.Candidates[0].Content.Parts) > 0 {
			if text := gResp.Candidates[0].Content.Parts[0].Text; text != "" {
				onChunk(text)
			}
		}
		if gResp.UsageMetadata.PromptTokenCount > 0 {
			tokensIn = gResp.UsageMetadata.PromptTokenCount
			tokensOut = gResp.UsageMetadata.CandidatesTokenCount
		}
	}
	return &ChatResult{TokensIn: tokensIn, TokensOut: tokensOut}, scanner.Err()
}
