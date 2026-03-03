package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const EnvironmentIDKey = "environment_id"

// EnvironmentContext extracts X-Environment-ID from the request header
// and places it in the Gin context for downstream handlers.
func EnvironmentContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("X-Environment-ID")
		if header != "" {
			if envID, err := uuid.Parse(header); err == nil {
				c.Set(EnvironmentIDKey, envID)
			}
		}
		c.Next()
	}
}

// GetEnvironmentID returns the environment ID from the Gin context.
// Returns uuid.Nil if not set (signals "use default environment").
func GetEnvironmentID(c *gin.Context) uuid.UUID {
	val, exists := c.Get(EnvironmentIDKey)
	if !exists {
		return uuid.Nil
	}
	id, ok := val.(uuid.UUID)
	if !ok {
		return uuid.Nil
	}
	return id
}
