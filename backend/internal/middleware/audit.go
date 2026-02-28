package middleware

import (
	"context"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type AuditLogger struct {
	repo   *repository.AuditRepository
	logger *zap.Logger
}

func NewAuditLogger(repo *repository.AuditRepository, logger *zap.Logger) *AuditLogger {
	return &AuditLogger{repo: repo, logger: logger}
}

func (a *AuditLogger) Log(c *gin.Context, action, resourceType string, resourceID *string, details string, status string, errorMessage string) {
	userID, _ := GetUserID(c)
	userName := GetUserName(c)

	log := &model.AuditLog{
		UserID:       userID,
		UserName:     userName,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      details,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.GetHeader("User-Agent"),
		Status:       status,
		ErrorMessage: errorMessage,
	}

	ctx := context.WithoutCancel(c.Request.Context())
	go func() {
		if err := a.repo.Create(ctx, log); err != nil {
			a.logger.Error("failed to create audit log",
				zap.Error(err),
				zap.String("action", action),
				zap.String("resource_type", resourceType),
			)
		}
	}()
}

func (a *AuditLogger) LogSuccess(c *gin.Context, action, resourceType string, resourceID *string, details string) {
	a.Log(c, action, resourceType, resourceID, details, "success", "")
}

func (a *AuditLogger) LogError(c *gin.Context, action, resourceType string, resourceID *string, details string, errMsg string) {
	a.Log(c, action, resourceType, resourceID, details, "error", errMsg)
}
