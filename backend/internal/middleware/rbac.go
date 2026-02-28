package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/model"
)

func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		perms := GetPermissions(c)

		for _, p := range perms {
			if p == "*" || p == permission {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden,
			model.NewErrorResponse("FORBIDDEN", "Insufficient permissions"))
	}
}
