package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

// systemPrompt is the base prompt for the assistant.
const systemPrompt = `You are the FuseOne AI Assistant, an expert in API Gateway management built on Apache APISIX.
You help users configure APIs, routes, upstreams, plugins, policies, rate limiting, authentication, monitoring, and troubleshooting.
Always be concise and practical. When showing configuration examples, use valid JSON.
Reply in the same language the user is writing in (pt-BR or English).
If the user provides documentation context, use it to give accurate, specific answers.`

// generateAPISystemPrompt is for the API generation endpoint.
const generateAPISystemPrompt = `You are an APISIX configuration expert. The user will describe an API they want to create.
Return ONLY a valid JSON object with this EXACT structure, no markdown, no explanation, no extra text:
{
  "name": "api-name-slug",
  "upstream": {
    "type": "roundrobin",
    "nodes": {"hostname:port": 1}
  },
  "route": {
    "uri": "/path",
    "methods": ["GET", "POST"]
  },
  "plugins": {
    "plugin-name": {}
  }
}
Use only well-known APISIX plugins: limit-count, jwt-auth, key-auth, basic-auth, cors, proxy-rewrite, response-rewrite, ip-restriction, request-id, prometheus.
If no plugins are needed, return an empty plugins object.
The name must be lowercase with hyphens only.`

// LLMHandler handles LLM provider configuration and AI endpoints.
type LLMHandler struct {
	llmRepo     *repository.LLMRepository
	llmSvc      *service.LLMService
	cryptoSvc   *service.CryptoService
	auditLogger *middleware.AuditLogger
}

// NewLLMHandler creates a new LLMHandler.
func NewLLMHandler(
	llmRepo *repository.LLMRepository,
	llmSvc *service.LLMService,
	cryptoSvc *service.CryptoService,
	auditLogger *middleware.AuditLogger,
) *LLMHandler {
	return &LLMHandler{
		llmRepo:     llmRepo,
		llmSvc:      llmSvc,
		cryptoSvc:   cryptoSvc,
		auditLogger: auditLogger,
	}
}

// --- Provider Config CRUD ---

// ListConfigs returns all provider configs without API keys.
func (h *LLMHandler) ListConfigs(c *gin.Context) {
	cfgs, err := h.llmRepo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if cfgs == nil {
		cfgs = []model.LLMConfig{}
	}
	c.JSON(http.StatusOK, gin.H{"data": cfgs})
}

// GetUsageSummary returns today and this month's usage per provider.
func (h *LLMHandler) GetUsageSummary(c *gin.Context) {
	summaries, err := h.llmRepo.GetUsageSummary(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if summaries == nil {
		summaries = []model.LLMUsageSummary{}
	}
	c.JSON(http.StatusOK, gin.H{"data": summaries})
}

type upsertLLMConfigRequest struct {
	Model      string `json:"model" binding:"required"`
	APIKey     string `json:"api_key"` // optional on update
	Enabled    *bool  `json:"enabled"`
	DailyQuota *int   `json:"daily_quota"`
}

// UpsertConfig creates or updates a provider config.
func (h *LLMHandler) UpsertConfig(c *gin.Context) {
	providerStr := c.Param("provider")
	if !model.IsValidProvider(providerStr) {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": fmt.Sprintf("invalid provider %q; must be openai, anthropic, google, or groq", providerStr)}})
		return
	}
	provider := model.LLMProvider(providerStr)

	var req upsertLLMConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if !model.IsValidModel(provider, req.Model) {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": fmt.Sprintf("invalid model %q for provider %q", req.Model, providerStr)}})
		return
	}

	// Encrypt the API key if provided
	var encKey []byte
	if req.APIKey != "" {
		var err error
		encKey, err = h.cryptoSvc.Encrypt([]byte(req.APIKey))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to encrypt api key"}})
			return
		}
	} else {
		// Load existing key to keep it
		_, existing, err := h.llmRepo.Get(c.Request.Context(), provider)
		if err != nil || existing == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "api_key is required for new provider"}})
			return
		}
		encKey = existing
	}

	enabled := false
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	dailyQuota := 100
	if req.DailyQuota != nil {
		dailyQuota = *req.DailyQuota
	}

	var createdBy *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, ok := uid.(uuid.UUID); ok {
			createdBy = &parsed
		}
	}

	// If enabling this provider, disable all others first
	if enabled {
		if err := h.llmRepo.DisableAll(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
			return
		}
	}

	cfg := &model.LLMConfig{
		Provider:   provider,
		Model:      req.Model,
		Enabled:    enabled,
		DailyQuota: dailyQuota,
		CreatedBy:  createdBy,
	}

	if err := h.llmRepo.Upsert(c.Request.Context(), cfg, encKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := string(provider)
	h.auditLogger.LogSuccess(c, "upsert", "llm_config", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": cfg})
}

// DeleteConfig removes a provider config.
func (h *LLMHandler) DeleteConfig(c *gin.Context) {
	providerStr := c.Param("provider")
	if !model.IsValidProvider(providerStr) {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid provider"}})
		return
	}

	if err := h.llmRepo.Delete(c.Request.Context(), model.LLMProvider(providerStr)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := providerStr
	h.auditLogger.LogSuccess(c, "delete", "llm_config", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

// GetStatus returns whether any provider is configured and enabled (no auth required).
func (h *LLMHandler) GetStatus(c *gin.Context) {
	err := h.llmSvc.CheckAvailable(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"available": err == nil}})
}

// --- AI Endpoints ---

type chatRequest struct {
	Messages []service.ChatMessage `json:"messages" binding:"required"`
	Context  string                `json:"context"`
}

// Chat calls the active LLM provider and returns the assistant's reply.
func (h *LLMHandler) Chat(c *gin.Context) {
	var req chatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "messages must not be empty"}})
		return
	}

	// Build system prompt, optionally injecting context
	sysContent := systemPrompt
	if req.Context != "" {
		sysContent += "\n\nRelevant documentation context:\n" + req.Context
	}

	messages := append([]service.ChatMessage{{Role: "system", Content: sysContent}}, req.Messages...)

	var userID *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, ok := uid.(uuid.UUID); ok {
			userID = &parsed
		}
	}

	result, err := h.llmSvc.Chat(c.Request.Context(), userID, messages, "chat")
	if err != nil {
		if errors.Is(err, service.ErrNoProvider) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": gin.H{"message": "no AI provider configured; go to Settings → AI Providers"}})
			return
		}
		if errors.Is(err, service.ErrQuotaExceeded) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": gin.H{"message": "daily quota exceeded for this provider"}})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// ChatStream handles POST /api/ai/chat/stream — returns an SSE stream of tokens.
func (h *LLMHandler) ChatStream(c *gin.Context) {
	var req chatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "messages must not be empty"}})
		return
	}

	sysContent := systemPrompt
	if req.Context != "" {
		sysContent += "\n\nRelevant documentation context:\n" + req.Context
	}
	messages := append([]service.ChatMessage{{Role: "system", Content: sysContent}}, req.Messages...)

	var userID *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, ok := uid.(uuid.UUID); ok {
			userID = &parsed
		}
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Flush()

	result, err := h.llmSvc.ChatStream(c.Request.Context(), userID, messages, "chat", func(chunk string) {
		data, _ := json.Marshal(map[string]string{"content": chunk})
		c.SSEvent("chunk", string(data))
		c.Writer.Flush()
	})

	if err != nil {
		errMsg := err.Error()
		if errors.Is(err, service.ErrNoProvider) {
			errMsg = "no AI provider configured; go to Settings → AI Providers"
		} else if errors.Is(err, service.ErrQuotaExceeded) {
			errMsg = "daily quota exceeded for this provider"
		}
		data, _ := json.Marshal(map[string]string{"message": errMsg})
		c.SSEvent("error", string(data))
	} else {
		data, _ := json.Marshal(map[string]int{"tokens_in": result.TokensIn, "tokens_out": result.TokensOut})
		c.SSEvent("done", string(data))
	}
	c.Writer.Flush()
}

type generateAPIRequest struct {
	Description string `json:"description" binding:"required"`
}

// GeneratedAPIConfig is the structured output from the API generator.
type GeneratedAPIConfig struct {
	Name     string                 `json:"name"`
	Upstream map[string]interface{} `json:"upstream"`
	Route    map[string]interface{} `json:"route"`
	Plugins  map[string]interface{} `json:"plugins"`
}

// GenerateAPI asks the LLM to generate an APISIX configuration from a description.
func (h *LLMHandler) GenerateAPI(c *gin.Context) {
	var req generateAPIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	messages := []service.ChatMessage{
		{Role: "system", Content: generateAPISystemPrompt},
		{Role: "user", Content: req.Description},
	}

	var userID *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, ok := uid.(uuid.UUID); ok {
			userID = &parsed
		}
	}

	result, err := h.llmSvc.Chat(c.Request.Context(), userID, messages, "generate-api")
	if err != nil {
		if errors.Is(err, service.ErrNoProvider) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": gin.H{"message": "no AI provider configured"}})
			return
		}
		if errors.Is(err, service.ErrQuotaExceeded) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": gin.H{"message": "daily quota exceeded"}})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	// Parse the LLM's JSON response
	content := strings.TrimSpace(result.Content)
	// Strip markdown code fences if present
	if strings.HasPrefix(content, "```") {
		lines := strings.Split(content, "\n")
		if len(lines) > 2 {
			content = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}

	var apiCfg GeneratedAPIConfig
	if err := json.Unmarshal([]byte(content), &apiCfg); err != nil {
		// Return raw content if JSON parse fails
		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"raw":       content,
				"tokens_in": result.TokensIn, "tokens_out": result.TokensOut,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"config":     apiCfg,
			"tokens_in":  result.TokensIn,
			"tokens_out": result.TokensOut,
		},
	})
}
