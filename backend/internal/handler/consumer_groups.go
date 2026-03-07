package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ConsumerGroupsHandler proxies consumer group operations to the Event Gateway.
type ConsumerGroupsHandler struct {
	egURL      string
	httpClient *http.Client
	logger     *zap.Logger
}

func NewConsumerGroupsHandler(eventGatewayURL string, logger *zap.Logger) *ConsumerGroupsHandler {
	return &ConsumerGroupsHandler{
		egURL:      eventGatewayURL,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		logger:     logger,
	}
}

// List proxies GET /internal/event-apis/:id/consumer-groups from Event Gateway.
func (h *ConsumerGroupsHandler) List(c *gin.Context) {
	id := c.Param("id")
	h.proxy(c, http.MethodGet, fmt.Sprintf("%s/internal/event-apis/%s/consumer-groups", h.egURL, id), nil)
}

// Describe proxies GET /internal/event-apis/:id/consumer-groups/:groupId from Event Gateway.
func (h *ConsumerGroupsHandler) Describe(c *gin.Context) {
	id := c.Param("id")
	groupID := c.Param("groupId")
	h.proxy(c, http.MethodGet, fmt.Sprintf("%s/internal/event-apis/%s/consumer-groups/%s", h.egURL, id, groupID), nil)
}

// ResetOffsets proxies POST /internal/event-apis/:id/consumer-groups/:groupId/reset from Event Gateway.
func (h *ConsumerGroupsHandler) ResetOffsets(c *gin.Context) {
	id := c.Param("id")
	groupID := c.Param("groupId")
	h.proxy(c, http.MethodPost, fmt.Sprintf("%s/internal/event-apis/%s/consumer-groups/%s/reset", h.egURL, id, groupID), c.Request.Body)
}

func (h *ConsumerGroupsHandler) proxy(c *gin.Context, method, url string, body io.Reader) {
	req, err := http.NewRequestWithContext(c.Request.Context(), method, url, body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request"})
		return
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		h.logger.Error("proxy to event gateway", zap.Error(err), zap.String("url", url))
		c.JSON(http.StatusBadGateway, gin.H{"error": "event gateway unavailable"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read response"})
		return
	}

	// Forward as JSON
	var result interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		c.Data(resp.StatusCode, "application/json", respBody)
		return
	}
	c.JSON(resp.StatusCode, result)
}
