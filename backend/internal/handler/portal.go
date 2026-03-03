package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

type PortalHandler struct {
	portalRepo *repository.PortalRepository
	userRepo   *repository.UserRepository
	subService *service.SubscriptionService
	auth       *service.AuthService
	logger     *zap.Logger
}

func NewPortalHandler(
	portalRepo *repository.PortalRepository,
	userRepo *repository.UserRepository,
	subService *service.SubscriptionService,
	auth *service.AuthService,
	logger *zap.Logger,
) *PortalHandler {
	return &PortalHandler{
		portalRepo: portalRepo,
		userRepo:   userRepo,
		subService: subService,
		auth:       auth,
		logger:     logger,
	}
}

// ──────── Public Endpoints ────────

// ListAPIs returns the public API catalog.
func (h *PortalHandler) ListAPIs(c *gin.Context) {
	search := c.Query("search")
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "12"))

	apis, total, err := h.portalRepo.ListVisibleAPIs(c.Request.Context(), search, category, page, pageSize)
	if err != nil {
		h.logger.Error("listing portal APIs", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to list APIs"}})
		return
	}
	if apis == nil {
		apis = []model.PortalApiSummary{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  apis,
		"total": total,
		"page":  page,
	})
}

// GetAPI returns a single API detail with plans.
func (h *PortalHandler) GetAPI(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid API ID"}})
		return
	}

	detail, err := h.portalRepo.GetVisibleAPI(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("getting portal API", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to get API"}})
		return
	}
	if detail == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "API not found"}})
		return
	}

	// Don't send the full spec in the detail response (it can be large)
	detail.OpenAPISpec = ""

	c.JSON(http.StatusOK, gin.H{"data": detail})
}

// GetSpec returns the raw OpenAPI spec for an API.
func (h *PortalHandler) GetSpec(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid API ID"}})
		return
	}

	spec, err := h.portalRepo.GetAPIOpenAPISpec(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to get spec"}})
		return
	}
	if spec == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "no OpenAPI spec available"}})
		return
	}

	// Detect if JSON or YAML
	if len(spec) > 0 && spec[0] == '{' {
		c.Data(http.StatusOK, "application/json", []byte(spec))
	} else {
		c.Data(http.StatusOK, "text/yaml", []byte(spec))
	}
}

// Register creates a new developer account.
func (h *PortalHandler) Register(c *gin.Context) {
	var req model.DeveloperRegistration
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	ctx := c.Request.Context()

	// Check if username already taken
	existing, _ := h.userRepo.GetByUsername(ctx, req.Username)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": gin.H{"message": "username already taken"}})
		return
	}

	// Check if email already taken
	if req.Email != "" {
		existing, _ = h.userRepo.GetByEmail(ctx, req.Email)
		if existing != nil {
			c.JSON(http.StatusConflict, gin.H{"error": gin.H{"message": "email already registered"}})
			return
		}
	}

	// Get developer role
	devRole, err := h.userRepo.GetRoleByName(ctx, "developer")
	if err != nil || devRole == nil {
		h.logger.Error("developer role not found", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "developer registration not available"}})
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to process password"}})
		return
	}

	hashStr := string(hash)
	user := &model.User{
		Username:     req.Username,
		Email:        &req.Email,
		DisplayName:  req.FullName,
		PasswordHash: &hashStr,
		RoleID:       devRole.ID,
		IsActive:     true,
	}

	if err := h.portalRepo.RegisterDeveloper(ctx, user); err != nil {
		h.logger.Error("registering developer", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to create account"}})
		return
	}

	// Auto-login: generate tokens
	tokenResp, err := h.auth.Login(ctx, service.LoginRequest{
		Username: req.Username,
		Password: req.Password,
	})
	if err != nil {
		// Account created but login failed — still return success
		c.JSON(http.StatusCreated, gin.H{"data": gin.H{"message": "Account created. Please sign in."}})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": tokenResp})
}

// GetCategories returns distinct portal categories.
func (h *PortalHandler) GetCategories(c *gin.Context) {
	cats, err := h.portalRepo.ListCategories(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to list categories"}})
		return
	}
	if cats == nil {
		cats = []string{}
	}
	c.JSON(http.StatusOK, gin.H{"data": cats})
}

// GetStats returns portal-wide stats for the landing page.
func (h *PortalHandler) GetStats(c *gin.Context) {
	apiCount, devCount, err := h.portalRepo.GetPortalStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to get stats"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"api_count":       apiCount,
		"developer_count": devCount,
	}})
}

// ──────── Authenticated Endpoints (Developer) ────────

// GetProfile returns the current developer's profile.
func (h *PortalHandler) GetProfile(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "not authenticated"}})
		return
	}

	profile, err := h.portalRepo.GetDeveloperProfile(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to get profile"}})
		return
	}
	if profile == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "profile not found"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": profile})
}

// UpdateProfile updates the developer's profile.
func (h *PortalHandler) UpdateProfile(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "not authenticated"}})
		return
	}

	var body struct {
		DisplayName string `json:"display_name"`
		Email       string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "user not found"}})
		return
	}

	if body.DisplayName != "" {
		user.DisplayName = body.DisplayName
	}
	if body.Email != "" {
		user.Email = &body.Email
	}

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to update profile"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "profile updated"}})
}

// ListMySubscriptions returns the developer's subscriptions.
func (h *PortalHandler) ListMySubscriptions(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "not authenticated"}})
		return
	}

	subs, err := h.portalRepo.ListDeveloperSubscriptions(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to list subscriptions"}})
		return
	}
	if subs == nil {
		subs = []model.PortalSubscription{}
	}

	c.JSON(http.StatusOK, gin.H{"data": subs})
}

// Subscribe creates a subscription request for the developer.
func (h *PortalHandler) Subscribe(c *gin.Context) {
	apiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid API ID"}})
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "not authenticated"}})
		return
	}

	var req model.PortalSubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	ctx := c.Request.Context()

	// Verify API is portal-visible
	api, err := h.portalRepo.GetVisibleAPI(ctx, apiID)
	if err != nil || api == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "API not found or not available"}})
		return
	}

	// Get the developer's username for the consumer
	user, err := h.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "user not found"}})
		return
	}

	// Create subscription using the existing subscription service
	subReq := &model.CreateSubscriptionRequest{
		ConsumerUsername: "dev-" + user.Username,
		ApiDefinitionID: apiID,
		PlanID:          req.PlanID,
		Notes:           req.Notes,
	}

	sub, err := h.subService.Create(ctx, subReq, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": sub})
}

// ──────── Admin: Portal Settings ────────

// GetPortalSettings returns portal visibility, categories, and spec for an API (admin endpoint).
func (h *PortalHandler) GetPortalSettings(c *gin.Context) {
	apiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid API ID"}})
		return
	}

	row := h.portalRepo.Pool().QueryRow(c.Request.Context(),
		`SELECT portal_visible, portal_categories, openapi_spec FROM api_definitions WHERE id = $1`, apiID)

	var visible bool
	var categories []string
	var spec string
	if err := row.Scan(&visible, &categories, &spec); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "API not found"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"portal_visible":    visible,
		"portal_categories": categories,
		"openapi_spec":      spec,
	}})
}

// UpdatePortalSettings updates portal visibility and spec for an API (admin endpoint).
func (h *PortalHandler) UpdatePortalSettings(c *gin.Context) {
	apiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid API ID"}})
		return
	}

	var req model.UpdatePortalSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	visible := false
	if req.PortalVisible != nil {
		visible = *req.PortalVisible
	}
	categories := req.PortalCategories
	if categories == nil {
		categories = []string{}
	}
	spec := ""
	if req.OpenAPISpec != nil {
		spec = *req.OpenAPISpec
	}

	if err := h.portalRepo.UpdatePortalSettings(c.Request.Context(), apiID, visible, categories, spec); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to update portal settings"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "portal settings updated"}})
}
