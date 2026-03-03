package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

type OAuthAuthHandler struct {
	oauthService *service.OAuthService
}

func NewOAuthAuthHandler(oauthService *service.OAuthService) *OAuthAuthHandler {
	return &OAuthAuthHandler{oauthService: oauthService}
}

func (h *OAuthAuthHandler) ListEnabled(c *gin.Context) {
	providers, err := h.oauthService.GetEnabledProviders(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if providers == nil {
		providers = []model.PublicOAuthProvider{}
	}
	c.JSON(http.StatusOK, model.NewDataResponse(providers))
}

func (h *OAuthAuthHandler) Authorize(c *gin.Context) {
	providerSlug := c.Param("provider")
	redirectURI := c.Query("redirect_uri")
	if redirectURI == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "redirect_uri is required"))
		return
	}

	url, state, err := h.oauthService.GetAuthorizeURL(c.Request.Context(), providerSlug, redirectURI)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"url":   url,
		"state": state,
	}))
}

func (h *OAuthAuthHandler) Callback(c *gin.Context) {
	providerSlug := c.Param("provider")

	var req struct {
		Code        string `json:"code" binding:"required"`
		State       string `json:"state"`
		RedirectURI string `json:"redirect_uri" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	resp, err := h.oauthService.HandleCallback(c.Request.Context(), providerSlug, req.Code, req.RedirectURI)
	if err != nil {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(resp))
}
