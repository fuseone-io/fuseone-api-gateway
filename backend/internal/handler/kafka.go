package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

// KafkaHandler handles Kafka connection CRUD and topic browser proxy endpoints.
type KafkaHandler struct {
	repo        repository.KafkaConnectionQuerier
	logger      *zap.Logger
	auditLogger *middleware.AuditLogger
}

// NewKafkaHandler creates a new KafkaHandler.
func NewKafkaHandler(repo repository.KafkaConnectionQuerier, auditLogger *middleware.AuditLogger, logger *zap.Logger) *KafkaHandler {
	return &KafkaHandler{
		repo:        repo,
		logger:      logger,
		auditLogger: auditLogger,
	}
}

// --- Connection CRUD ---

// ListConnections returns all Kafka connections.
func (h *KafkaHandler) ListConnections(c *gin.Context) {
	connections, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if connections == nil {
		connections = []model.KafkaConnection{}
	}
	c.JSON(http.StatusOK, gin.H{"data": connections})
}

// GetConnection returns a single Kafka connection by ID.
func (h *KafkaHandler) GetConnection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid connection ID"}})
		return
	}

	conn, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "connection not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": conn})
}

type createKafkaConnectionRequest struct {
	Name             string   `json:"name" binding:"required"`
	Description      string   `json:"description"`
	Brokers          []string `json:"brokers" binding:"required"`
	SecurityProtocol string   `json:"security_protocol"`
	SASLMechanism    *string  `json:"sasl_mechanism"`
	SASLUsername     *string  `json:"sasl_username"`
	SASLPassword     *string  `json:"sasl_password"`
	IsActive         *bool    `json:"is_active"`
}

// CreateConnection creates a new Kafka connection.
func (h *KafkaHandler) CreateConnection(c *gin.Context) {
	var req createKafkaConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if len(req.Brokers) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "brokers must not be empty"}})
		return
	}

	securityProtocol := req.SecurityProtocol
	if securityProtocol == "" {
		securityProtocol = "PLAINTEXT"
	}
	if !model.ValidSecurityProtocols[securityProtocol] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid security_protocol; must be PLAINTEXT, SSL, SASL_PLAINTEXT, or SASL_SSL"}})
		return
	}

	if req.SASLMechanism != nil && !model.ValidSASLMechanisms[*req.SASLMechanism] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid sasl_mechanism; must be PLAIN, SCRAM-SHA-256, or SCRAM-SHA-512"}})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var createdBy *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, err := uuid.Parse(uid.(string)); err == nil {
			createdBy = &parsed
		}
	}

	conn := &model.KafkaConnection{
		Name:             req.Name,
		Description:      req.Description,
		Brokers:          req.Brokers,
		SecurityProtocol: securityProtocol,
		SASLMechanism:    req.SASLMechanism,
		SASLUsername:     req.SASLUsername,
		SASLPassword:     req.SASLPassword,
		IsActive:         isActive,
		CreatedBy:        createdBy,
	}

	if err := h.repo.Create(c.Request.Context(), conn); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := conn.ID.String()
	h.auditLogger.LogSuccess(c, "create", "kafka_connection", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": conn})
}

type updateKafkaConnectionRequest struct {
	Name             *string  `json:"name"`
	Description      *string  `json:"description"`
	Brokers          []string `json:"brokers"`
	SecurityProtocol *string  `json:"security_protocol"`
	SASLMechanism    *string  `json:"sasl_mechanism"`
	SASLUsername     *string  `json:"sasl_username"`
	SASLPassword     *string  `json:"sasl_password"`
	IsActive         *bool    `json:"is_active"`
}

// UpdateConnection updates an existing Kafka connection.
func (h *KafkaHandler) UpdateConnection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid connection ID"}})
		return
	}

	existing, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "connection not found"}})
		return
	}

	var req updateKafkaConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if req.Name != nil {
		if *req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "name must not be empty"}})
			return
		}
		existing.Name = *req.Name
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Brokers != nil {
		if len(req.Brokers) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "brokers must not be empty"}})
			return
		}
		existing.Brokers = req.Brokers
	}
	if req.SecurityProtocol != nil {
		if !model.ValidSecurityProtocols[*req.SecurityProtocol] {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid security_protocol; must be PLAINTEXT, SSL, SASL_PLAINTEXT, or SASL_SSL"}})
			return
		}
		existing.SecurityProtocol = *req.SecurityProtocol
	}
	if req.SASLMechanism != nil {
		if !model.ValidSASLMechanisms[*req.SASLMechanism] {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid sasl_mechanism; must be PLAIN, SCRAM-SHA-256, or SCRAM-SHA-512"}})
			return
		}
		existing.SASLMechanism = req.SASLMechanism
	}
	if req.SASLUsername != nil {
		existing.SASLUsername = req.SASLUsername
	}
	if req.SASLPassword != nil {
		existing.SASLPassword = req.SASLPassword
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditLogger.LogSuccess(c, "update", "kafka_connection", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// DeleteConnection deletes a Kafka connection.
func (h *KafkaHandler) DeleteConnection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid connection ID"}})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	delStr := id.String()
	h.auditLogger.LogSuccess(c, "delete", "kafka_connection", &delStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

// --- Topic Browser Proxy Endpoints ---

// loadActiveConnection loads a Kafka connection by :connectionId and validates it is active.
func (h *KafkaHandler) loadActiveConnection(c *gin.Context) (*model.KafkaConnection, bool) {
	id, err := uuid.Parse(c.Param("connectionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid connection ID"}})
		return nil, false
	}

	conn, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return nil, false
	}
	if conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "connection not found"}})
		return nil, false
	}
	if !conn.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "connection is not active"}})
		return nil, false
	}

	return conn, true
}

// ListTopics lists all topics for the given Kafka connection.
func (h *KafkaHandler) ListTopics(c *gin.Context) {
	conn, ok := h.loadActiveConnection(c)
	if !ok {
		return
	}

	client := service.NewKafkaDirectClient(conn, h.logger)
	topics, err := client.ListTopics(c.Request.Context())
	if err != nil {
		h.logger.Error("failed to list topics", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if topics == nil {
		topics = []string{}
	}
	c.JSON(http.StatusOK, gin.H{"data": topics})
}

// GetTopic returns detailed information about a specific topic.
func (h *KafkaHandler) GetTopic(c *gin.Context) {
	conn, ok := h.loadActiveConnection(c)
	if !ok {
		return
	}

	topicName := c.Param("topicName")
	if topicName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "topic name is required"}})
		return
	}

	client := service.NewKafkaDirectClient(conn, h.logger)
	detail, err := client.GetTopic(c.Request.Context(), topicName)
	if err != nil {
		h.logger.Error("failed to get topic", zap.String("topic", topicName), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

type produceMessageRequest struct {
	Key     *string           `json:"key"`
	Value   interface{}       `json:"value" binding:"required"`
	Headers map[string]string `json:"headers"`
}

// ProduceMessage produces a message to a topic directly via franz-go.
func (h *KafkaHandler) ProduceMessage(c *gin.Context) {
	conn, ok := h.loadActiveConnection(c)
	if !ok {
		return
	}

	topicName := c.Param("topicName")
	if topicName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "topic name is required"}})
		return
	}

	var req produceMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	client := service.NewKafkaDirectClient(conn, h.logger)
	result, err := client.ProduceMessage(c.Request.Context(), topicName, service.ProduceRequest{
		Key:     req.Key,
		Value:   req.Value,
		Headers: req.Headers,
	})
	if err != nil {
		h.logger.Error("failed to produce message", zap.String("topic", topicName), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

type consumeMessagesRequest struct {
	MaxMessages int `json:"max_messages"`
}

// ConsumeMessages fetches recent messages from a topic directly via franz-go.
func (h *KafkaHandler) ConsumeMessages(c *gin.Context) {
	conn, ok := h.loadActiveConnection(c)
	if !ok {
		return
	}

	topicName := c.Param("topicName")
	if topicName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "topic name is required"}})
		return
	}

	var req consumeMessagesRequest
	_ = c.ShouldBindJSON(&req) // optional body

	client := service.NewKafkaDirectClient(conn, h.logger)
	messages, err := client.ConsumeMessages(c.Request.Context(), topicName, req.MaxMessages)
	if err != nil {
		h.logger.Error("failed to consume messages", zap.String("topic", topicName), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if messages == nil {
		messages = []service.ConsumedMessage{}
	}
	c.JSON(http.StatusOK, gin.H{"data": messages})
}
