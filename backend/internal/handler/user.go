package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type UserHandler struct {
	userRepo *repository.UserRepository
	auditor  *middleware.AuditLogger
}

func NewUserHandler(userRepo *repository.UserRepository, auditor *middleware.AuditLogger) *UserHandler {
	return &UserHandler{userRepo: userRepo, auditor: auditor}
}

// List returns paginated users with optional search.
func (h *UserHandler) List(c *gin.Context) {
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	users, total, err := h.userRepo.ListWithSearch(c.Request.Context(), search, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	// Strip sensitive fields
	for i := range users {
		users[i].PasswordHash = nil
		users[i].TOTPSecret = ""
	}

	if users == nil {
		users = []model.User{}
	}

	c.JSON(http.StatusOK, gin.H{"data": users, "total": total})
}

// Get returns a single user.
func (h *UserHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid user ID"))
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "user not found"))
		return
	}

	user.PasswordHash = nil
	user.TOTPSecret = ""

	c.JSON(http.StatusOK, model.NewDataResponse(user))
}

type createUserRequest struct {
	Username    string  `json:"username" binding:"required"`
	Email       *string `json:"email"`
	DisplayName string  `json:"display_name" binding:"required"`
	Password    string  `json:"password" binding:"required,min=6"`
	RoleID      string  `json:"role_id" binding:"required"`
	IsActive    bool    `json:"is_active"`
}

// Create creates a new user.
func (h *UserHandler) Create(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	roleID, err := uuid.Parse(req.RoleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid role_id"))
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", "failed to hash password"))
		return
	}
	hashStr := string(hash)

	user := &model.User{
		Username:     req.Username,
		Email:        req.Email,
		DisplayName:  req.DisplayName,
		PasswordHash: &hashStr,
		RoleID:       roleID,
		IsActive:     req.IsActive,
	}

	if err := h.userRepo.Create(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	// Fetch full user with role_name
	created, err := h.userRepo.GetByID(c.Request.Context(), user.ID)
	if err != nil || created == nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", "user created but failed to fetch"))
		return
	}
	created.PasswordHash = nil
	created.TOTPSecret = ""

	idStr := created.ID.String()
	h.auditor.LogSuccess(c, "create", "user", &idStr, "")

	c.JSON(http.StatusCreated, model.NewDataResponse(created))
}

type updateUserRequest struct {
	Username    string  `json:"username" binding:"required"`
	Email       *string `json:"email"`
	DisplayName string  `json:"display_name" binding:"required"`
	RoleID      string  `json:"role_id" binding:"required"`
	IsActive    bool    `json:"is_active"`
}

// Update updates a user (not password).
func (h *UserHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid user ID"))
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	roleID, err := uuid.Parse(req.RoleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid role_id"))
		return
	}

	existing, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "user not found"))
		return
	}

	existing.Username = req.Username
	existing.Email = req.Email
	existing.DisplayName = req.DisplayName
	existing.RoleID = roleID
	existing.IsActive = req.IsActive

	if err := h.userRepo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	updated, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil || updated == nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", "user updated but failed to fetch"))
		return
	}
	updated.PasswordHash = nil
	updated.TOTPSecret = ""

	idStr := id.String()
	h.auditor.LogSuccess(c, "update", "user", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(updated))
}

type resetPasswordRequest struct {
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// ResetPassword resets a user's password.
func (h *UserHandler) ResetPassword(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid user ID"))
		return
	}

	var req resetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", "failed to hash password"))
		return
	}

	if err := h.userRepo.UpdatePassword(c.Request.Context(), id, string(hash)); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "reset_password", "user", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "password reset successfully"}))
}

// Delete deletes a user.
func (h *UserHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid user ID"))
		return
	}

	// Prevent self-deletion
	currentUserID, ok := middleware.GetUserID(c)
	if ok && currentUserID == id {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "cannot delete your own account"))
		return
	}

	existing, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "user not found"))
		return
	}

	if err := h.userRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "delete", "user", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "user deleted"}))
}
