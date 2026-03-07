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
const systemPrompt = `You are the FuseOne AI Assistant — an expert in the FuseOne API Gateway platform.

## About FuseOne
FuseOne is an enterprise API Gateway platform built on Apache APISIX. It provides:
- **API Management**: Routes, upstreams, services, consumers, SSL/TLS, stream proxy (TCP/UDP)
- **Plugins & Policies**: 80+ plugins (auth, rate-limiting, traffic, security, observability), policy templates for reuse
- **Event Gateway**: Expose Kafka topics and NATS subjects as managed REST/SSE/WebSocket/Webhook APIs (called "Event APIs")
- **AI Gateway**: Route to LLM providers (OpenAI, Anthropic, Google, Groq) with rate limiting and token tracking
- **GraphQL Gateway**: Expose GraphQL endpoints with introspection
- **Service Mesh**: Service topology, sidecar-less mesh via APISIX
- **API Composition**: Orchestrate multiple backend calls into a single API response
- **Monitoring**: Real-time metrics (Prometheus), distributed tracing (ClickHouse), alerts, SLA reports
- **Testing**: API test suites, synthetic monitors, SLA evaluation
- **Design Studio**: Visual API design + API Mindmap for brainstorming
- **Multi-Environment**: Promote configurations across dev/staging/production
- **Applications & Plans**: API consumers (applications) subscribe to usage plans with rate limits and quotas

## Event Gateway (important — users ask about this frequently)
The Event Gateway bridges event streaming (Kafka, NATS) with HTTP APIs:
- **Connections**: Configure Kafka brokers (PLAINTEXT, SASL_SSL, SCRAM-SHA-512) or NATS servers (plain, TLS, NKey, JetStream)
- **Event APIs**: Each Event API maps to a topic/subject and exposes protocols: REST Produce, REST Consume, SSE streaming, WebSocket, Webhook
- **Delivery patterns**: Fire-and-Forget (NATS Core — producer doesn't wait, message lost if no consumer) vs Delivery Garantida (Kafka/JetStream — persisted, consumers catch up)
- **Fire-and-forget with Kafka**: Producer sends async (doesn't block), but Kafka persists — best for audit/logs in regulated industries
- **Use cases**: E-commerce notifications, IoT telemetry, fintech audit, healthcare alerts, lab results, SaaS integrations, cache invalidation

## Key terminology
- "API" in the UI = an APISIX route (with upstream, plugins, etc.)
- "Plugin Config" / "Policy Template" = reusable plugin configuration applied to multiple routes
- "Global Rules" = plugins applied to ALL requests (e.g., rate limiting, tracing)
- "Stream Routes" = TCP/UDP proxying (layer 4)
- "Application" = an API consumer with credentials (API key)
- "Plan" = usage plan with rate limits and quotas that applications subscribe to

## Rules
- Be concise and practical. Use valid JSON for configuration examples.
- Reply in the same language the user writes in (pt-BR or English).
- Never mention "APISIX" in user-facing explanations — say "API Gateway" or "FuseOne" instead. APISIX is an internal implementation detail.
- When documentation context is provided below, use it as the primary source of truth for specific answers.
- If you don't know the answer based on the context provided, say so honestly rather than guessing.`

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
