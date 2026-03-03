package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type OAuthProviderHandler struct {
	repo  *repository.OAuthProviderRepository
	audit *middleware.AuditLogger
}

func NewOAuthProviderHandler(repo *repository.OAuthProviderRepository, audit *middleware.AuditLogger) *OAuthProviderHandler {
	return &OAuthProviderHandler{repo: repo, audit: audit}
}

func (h *OAuthProviderHandler) List(c *gin.Context) {
	providers, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if providers == nil {
		providers = []model.OAuthProvider{}
	}
	c.JSON(http.StatusOK, model.NewDataResponse(providers))
}

func (h *OAuthProviderHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	p, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "Provider not found"))
		return
	}

	p.ClientSecret = ""
	c.JSON(http.StatusOK, model.NewDataResponse(p))
}

type createOAuthProviderRequest struct {
	Provider        string          `json:"provider" binding:"required"`
	DisplayName     string          `json:"display_name"`
	ClientID        string          `json:"client_id" binding:"required"`
	ClientSecret    string          `json:"client_secret" binding:"required"`
	Scopes          []string        `json:"scopes"`
	ExtraConfig     json.RawMessage `json:"extra_config"`
	AutoCreateUsers bool            `json:"auto_create_users"`
	DefaultRoleID   *uuid.UUID      `json:"default_role_id"`
	IsEnabled       bool            `json:"is_enabled"`
}

func (h *OAuthProviderHandler) Create(c *gin.Context) {
	var req createOAuthProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	if req.ExtraConfig == nil {
		req.ExtraConfig = json.RawMessage(`{}`)
	}
	if req.Scopes == nil {
		req.Scopes = []string{}
	}

	p := &model.OAuthProvider{
		Provider:        req.Provider,
		DisplayName:     req.DisplayName,
		ClientID:        req.ClientID,
		ClientSecret:    req.ClientSecret,
		Scopes:          req.Scopes,
		ExtraConfig:     req.ExtraConfig,
		AutoCreateUsers: req.AutoCreateUsers,
		DefaultRoleID:   req.DefaultRoleID,
		IsEnabled:       req.IsEnabled,
	}

	if err := h.repo.Create(c.Request.Context(), p); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	rid := p.ID.String()
	h.audit.LogSuccess(c, "create", "oauth_provider", &rid, "Created OAuth provider: "+p.Provider)
	p.ClientSecret = ""
	p.HasSecret = true
	c.JSON(http.StatusCreated, model.NewDataResponse(p))
}

type updateOAuthProviderRequest struct {
	DisplayName     *string         `json:"display_name"`
	ClientID        *string         `json:"client_id"`
	ClientSecret    *string         `json:"client_secret"`
	Scopes          []string        `json:"scopes"`
	ExtraConfig     json.RawMessage `json:"extra_config"`
	AutoCreateUsers *bool           `json:"auto_create_users"`
	DefaultRoleID   *uuid.UUID      `json:"default_role_id"`
	IsEnabled       *bool           `json:"is_enabled"`
}

func (h *OAuthProviderHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "Provider not found"))
		return
	}

	var req updateOAuthProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	if req.DisplayName != nil {
		existing.DisplayName = *req.DisplayName
	}
	if req.ClientID != nil {
		existing.ClientID = *req.ClientID
	}
	if req.ClientSecret != nil {
		existing.ClientSecret = *req.ClientSecret // empty = keep existing (handled by repo COALESCE)
	} else {
		existing.ClientSecret = "" // keep existing
	}
	if req.Scopes != nil {
		existing.Scopes = req.Scopes
	}
	if req.ExtraConfig != nil {
		existing.ExtraConfig = req.ExtraConfig
	}
	if req.AutoCreateUsers != nil {
		existing.AutoCreateUsers = *req.AutoCreateUsers
	}
	if req.DefaultRoleID != nil {
		existing.DefaultRoleID = req.DefaultRoleID
	}
	if req.IsEnabled != nil {
		existing.IsEnabled = *req.IsEnabled
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	uid := existing.ID.String()
	h.audit.LogSuccess(c, "update", "oauth_provider", &uid, "Updated OAuth provider: "+existing.Provider)
	existing.ClientSecret = ""
	c.JSON(http.StatusOK, model.NewDataResponse(existing))
}

func (h *OAuthProviderHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "Provider not found"))
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	did := id.String()
	h.audit.LogSuccess(c, "delete", "oauth_provider", &did, "Deleted OAuth provider: "+existing.Provider)
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "deleted"}))
}
