package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type ProfileHandler struct {
	userRepo *repository.UserRepository
	audit    *middleware.AuditLogger
}

func NewProfileHandler(userRepo *repository.UserRepository, audit *middleware.AuditLogger) *ProfileHandler {
	return &ProfileHandler{userRepo: userRepo, audit: audit}
}

type updateProfileRequest struct {
	DisplayName string  `json:"display_name" binding:"required"`
	Email       *string `json:"email"`
	AvatarURL   string  `json:"avatar_url"`
}

// UpdateProfile updates the current user's profile (display name, email, avatar).
func (h *ProfileHandler) UpdateProfile(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "Invalid user"))
		return
	}

	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "User not found"))
		return
	}

	user.DisplayName = req.DisplayName
	user.Email = req.Email
	user.AvatarURL = req.AvatarURL

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	updated, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || updated == nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", "Profile updated but failed to fetch"))
		return
	}
	updated.PasswordHash = nil
	updated.TOTPSecret = ""

	idStr := userID.String()
	h.audit.LogSuccess(c, "update", "profile", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(updated))
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
}

// ChangePassword changes the current user's password after verifying the current one.
func (h *ProfileHandler) ChangePassword(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "Invalid user"))
		return
	}

	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "User not found"))
		return
	}

	if user.PasswordHash == nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Cannot change password for OAuth-only accounts"))
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Current password is incorrect"))
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", "Failed to hash password"))
		return
	}

	if err := h.userRepo.UpdatePassword(c.Request.Context(), userID, string(hash)); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	// Revoke all refresh tokens for security
	h.userRepo.RevokeAllUserTokens(c.Request.Context(), userID)

	idStr := userID.String()
	h.audit.LogSuccess(c, "change_password", "profile", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "Password changed successfully"}))
}

// TOTPSetup generates a new TOTP secret and returns the otpauth:// URL.
func (h *ProfileHandler) TOTPSetup(c *gin.Context) {
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

	if user.TOTPEnabled {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "2FA is already enabled. Disable it first to reconfigure."))
		return
	}

	accountName := user.Username
	if user.Email != nil && *user.Email != "" {
		accountName = *user.Email
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "FuseOne API Gateway",
		AccountName: accountName,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", "Failed to generate TOTP key"))
		return
	}

	// Store secret but keep disabled until verified
	if err := h.userRepo.UpdateTOTP(c.Request.Context(), userID, key.Secret(), false); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{
		"secret": key.Secret(),
		"url":    key.URL(),
	}))
}

type totpEnableRequest struct {
	Code string `json:"code" binding:"required,len=6"`
}

// TOTPEnable verifies a TOTP code and enables 2FA.
func (h *ProfileHandler) TOTPEnable(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "Invalid user"))
		return
	}

	var req totpEnableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "User not found"))
		return
	}

	if user.TOTPEnabled {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "2FA is already enabled"))
		return
	}

	if user.TOTPSecret == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Run TOTP setup first"))
		return
	}

	if !totp.Validate(req.Code, user.TOTPSecret) {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid verification code"))
		return
	}

	if err := h.userRepo.UpdateTOTP(c.Request.Context(), userID, user.TOTPSecret, true); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	idStr := userID.String()
	h.audit.LogSuccess(c, "enable_totp", "profile", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "2FA enabled successfully"}))
}

type totpDisableRequest struct {
	Password string `json:"password" binding:"required"`
}

// TOTPDisable disables 2FA after verifying the user's password.
func (h *ProfileHandler) TOTPDisable(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "Invalid user"))
		return
	}

	var req totpDisableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "User not found"))
		return
	}

	if !user.TOTPEnabled {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "2FA is not enabled"))
		return
	}

	if user.PasswordHash == nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Cannot verify password for OAuth-only accounts"))
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid password"))
		return
	}

	if err := h.userRepo.UpdateTOTP(c.Request.Context(), userID, "", false); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	idStr := userID.String()
	h.audit.LogSuccess(c, "disable_totp", "profile", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "2FA disabled successfully"}))
}
