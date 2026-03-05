package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

type BackupHandler struct {
	backup   *service.BackupService
	settings *repository.SettingsRepository
	crypto   *service.CryptoService
	auditor  *middleware.AuditLogger
	logger   *zap.Logger
}

func NewBackupHandler(
	backup *service.BackupService,
	settings *repository.SettingsRepository,
	crypto *service.CryptoService,
	auditor *middleware.AuditLogger,
	logger *zap.Logger,
) *BackupHandler {
	return &BackupHandler{
		backup:   backup,
		settings: settings,
		crypto:   crypto,
		auditor:  auditor,
		logger:   logger,
	}
}

func (h *BackupHandler) getConfig(ctx *gin.Context) (*service.BackupConfig, error) {
	raw, err := h.settings.Get(ctx.Request.Context(), "backup_git")
	if err != nil || raw == nil {
		return nil, err
	}

	var cfg service.BackupConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, err
	}

	// Decrypt the token
	if cfg.Token != "" {
		decrypted, err := h.crypto.Decrypt([]byte(cfg.Token))
		if err == nil {
			cfg.Token = string(decrypted)
		}
	}
	return &cfg, nil
}

// Configure saves the Git backup configuration.
func (h *BackupHandler) Configure(c *gin.Context) {
	var req struct {
		Provider string `json:"provider" binding:"required"`
		RepoURL  string `json:"repo_url" binding:"required"`
		Branch   string `json:"branch"`
		Token    string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	if req.Branch == "" {
		req.Branch = "main"
	}

	// Encrypt the token
	encToken, err := h.crypto.Encrypt([]byte(req.Token))
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", "failed to encrypt token"))
		return
	}

	cfg := service.BackupConfig{
		Provider: req.Provider,
		RepoURL:  req.RepoURL,
		Branch:   req.Branch,
		Token:    string(encToken),
	}

	cfgJSON, _ := json.Marshal(cfg)
	userID, _ := middleware.GetUserID(c)
	if err := h.settings.Upsert(c.Request.Context(), "backup_git", cfgJSON, userID); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	h.auditor.LogSuccess(c, "update", "backup_config", nil, "")

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"provider": req.Provider,
		"repo_url": req.RepoURL,
		"branch":   req.Branch,
	}))
}

// GetConfig returns the current backup configuration (token masked).
func (h *BackupHandler) GetConfig(c *gin.Context) {
	cfg, err := h.getConfig(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if cfg == nil {
		c.JSON(http.StatusOK, model.NewDataResponse(nil))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"provider": cfg.Provider,
		"repo_url": cfg.RepoURL,
		"branch":   cfg.Branch,
		"has_token": cfg.Token != "",
	}))
}

// TestConnection tests the Git repository connectivity.
func (h *BackupHandler) TestConnection(c *gin.Context) {
	cfg, err := h.getConfig(c)
	if err != nil || cfg == nil {
		c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
			"ok":      false,
			"message": "Backup not configured",
		}))
		return
	}

	if err := h.backup.TestConnection(c.Request.Context(), *cfg); err != nil {
		c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
			"ok":      false,
			"message": err.Error(),
		}))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"ok":      true,
		"message": "Connection successful",
	}))
}

// Create triggers a new backup.
func (h *BackupHandler) Create(c *gin.Context) {
	cfg, err := h.getConfig(c)
	if err != nil || cfg == nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("NOT_CONFIGURED", "Backup not configured"))
		return
	}

	commit, err := h.backup.CreateBackup(c.Request.Context(), *cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("BACKUP_FAILED", err.Error()))
		return
	}

	h.auditor.LogSuccess(c, "create", "backup", nil, "")

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"commit_sha": commit.SHA,
		"message":    commit.Message,
	}))
}

// History returns the list of backup commits.
func (h *BackupHandler) History(c *gin.Context) {
	cfg, err := h.getConfig(c)
	if err != nil || cfg == nil {
		c.JSON(http.StatusOK, model.NewDataResponse([]interface{}{}))
		return
	}

	commits, err := h.backup.GetHistory(c.Request.Context(), *cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(commits))
}

// PreviewRestore shows what a restore would change.
func (h *BackupHandler) PreviewRestore(c *gin.Context) {
	sha := c.Param("sha")
	if sha == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "sha is required"))
		return
	}

	cfg, err := h.getConfig(c)
	if err != nil || cfg == nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("NOT_CONFIGURED", "Backup not configured"))
		return
	}

	preview, err := h.backup.PreviewRestore(c.Request.Context(), *cfg, sha)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(preview))
}

// Restore applies a backup from a specific commit.
func (h *BackupHandler) Restore(c *gin.Context) {
	var req struct {
		SHA    string `json:"sha" binding:"required"`
		DryRun bool   `json:"dry_run"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	cfg, err := h.getConfig(c)
	if err != nil || cfg == nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("NOT_CONFIGURED", "Backup not configured"))
		return
	}

	if req.DryRun {
		preview, err := h.backup.PreviewRestore(c.Request.Context(), *cfg, req.SHA)
		if err != nil {
			c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
			return
		}
		c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
			"message": "Dry run — no changes applied",
			"preview": preview,
		}))
		return
	}

	applied, err := h.backup.Restore(c.Request.Context(), *cfg, req.SHA)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("RESTORE_FAILED", err.Error()))
		return
	}

	h.auditor.LogSuccess(c, "restore", "backup", &req.SHA, "")

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"message": "Restore completed successfully",
		"applied": applied,
	}))
}
