package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

type SecretHandler struct {
	repo   *repository.SecretRepository
	crypto *service.CryptoService
	audit  *middleware.AuditLogger
}

func NewSecretHandler(repo *repository.SecretRepository, crypto *service.CryptoService, audit *middleware.AuditLogger) *SecretHandler {
	return &SecretHandler{repo: repo, crypto: crypto, audit: audit}
}

// --- Local Secrets ---

func (h *SecretHandler) ListSecrets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))

	secrets, total, err := h.repo.List(c.Request.Context(), page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if secrets == nil {
		secrets = []model.Secret{}
	}

	c.JSON(http.StatusOK, model.NewListResponse(secrets, total, page, pageSize))
}

func (h *SecretHandler) GetSecret(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	secret, _, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if secret == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "Secret not found"))
		return
	}

	// Never return the encrypted value — only metadata
	c.JSON(http.StatusOK, model.NewDataResponse(secret))
}

func (h *SecretHandler) CreateSecret(c *gin.Context) {
	var req model.CreateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	encrypted, err := h.crypto.Encrypt([]byte(req.Value))
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("ENCRYPTION_ERROR", "Failed to encrypt secret"))
		return
	}

	userID, _ := middleware.GetUserID(c)
	secret := &model.Secret{
		Name:        req.Name,
		Description: req.Description,
		Tags:        req.Tags,
		CreatedBy:   &userID,
	}
	if secret.Tags == nil {
		secret.Tags = []string{}
	}

	if err := h.repo.Create(c.Request.Context(), secret, encrypted); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}

	h.audit.LogSuccess(c, "CREATE", "secret", nil, req.Name)
	c.JSON(http.StatusCreated, model.NewDataResponse(secret))
}

func (h *SecretHandler) UpdateSecret(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	var req model.UpdateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	// Encrypt new value if provided
	var encryptedValue []byte
	if req.Value != nil {
		enc, err := h.crypto.Encrypt([]byte(*req.Value))
		if err != nil {
			c.JSON(http.StatusInternalServerError, model.NewErrorResponse("ENCRYPTION_ERROR", "Failed to encrypt secret"))
			return
		}
		encryptedValue = enc
	}

	if err := h.repo.Update(c.Request.Context(), id, req.Description, encryptedValue, req.Tags); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "UPDATE", "secret", &idStr, "")
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "updated"}))
}

func (h *SecretHandler) DeleteSecret(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "DELETE", "secret", &idStr, "")
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "deleted"}))
}

// --- Secret Managers ---

func (h *SecretHandler) ListManagers(c *gin.Context) {
	managers, err := h.repo.ListManagers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if managers == nil {
		managers = []model.SecretManager{}
	}

	c.JSON(http.StatusOK, model.NewDataResponse(managers))
}

func (h *SecretHandler) GetManager(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	manager, err := h.repo.GetManagerByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if manager == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "Secret manager not found"))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(manager))
}

func (h *SecretHandler) CreateManager(c *gin.Context) {
	var req model.CreateSecretManagerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	validTypes := map[string]bool{"vault": true, "aws": true, "gcp": true, "env": true}
	if !validTypes[req.Type] {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Type must be one of: vault, aws, gcp, env"))
		return
	}

	userID, _ := middleware.GetUserID(c)
	manager := &model.SecretManager{
		Name:      req.Name,
		Type:      req.Type,
		Config:    req.Config,
		IsActive:  true,
		CreatedBy: &userID,
	}

	if err := h.repo.CreateManager(c.Request.Context(), manager); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}

	h.audit.LogSuccess(c, "CREATE", "secret_manager", nil, req.Name)
	c.JSON(http.StatusCreated, model.NewDataResponse(manager))
}

func (h *SecretHandler) UpdateManager(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	var req model.UpdateSecretManagerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	if err := h.repo.UpdateManager(c.Request.Context(), id, &req); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "UPDATE", "secret_manager", &idStr, "")
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "updated"}))
}

func (h *SecretHandler) DeleteManager(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	if err := h.repo.DeleteManager(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "DELETE", "secret_manager", &idStr, "")
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "deleted"}))
}
