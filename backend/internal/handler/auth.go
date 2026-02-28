package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
	userRepo    *repository.UserRepository
	audit       *middleware.AuditLogger
}

func NewAuthHandler(authService *service.AuthService, userRepo *repository.UserRepository, audit *middleware.AuditLogger) *AuthHandler {
	return &AuthHandler{authService: authService, userRepo: userRepo, audit: audit}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	resp, err := h.authService.Login(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(resp))
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	resp, err := h.authService.RefreshAccessToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(resp))
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	h.authService.Logout(c.Request.Context(), req.RefreshToken)
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "logged out"}))
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "Invalid user"))
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "User not found"))
		return
	}

	user.PasswordHash = nil
	user.TOTPSecret = ""

	c.JSON(http.StatusOK, model.NewDataResponse(user))
}
