package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/model"
)

type contextKey string

const (
	UserIDKey   contextKey = "user_id"
	UserNameKey contextKey = "user_name"
	RoleKey     contextKey = "role"
	PermsKey    contextKey = "permissions"
)

type JWTClaims struct {
	UserID      uuid.UUID `json:"user_id"`
	Username    string    `json:"username"`
	Role        string    `json:"role"`
	Permissions []string  `json:"permissions"`
	jwt.RegisteredClaims
}

func RequireAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "Missing authorization header"))
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "Invalid authorization format"))
			return
		}

		tokenStr := parts[1]
		claims := &JWTClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "Invalid or expired token"))
			return
		}

		c.Set(string(UserIDKey), claims.UserID)
		c.Set(string(UserNameKey), claims.Username)
		c.Set(string(RoleKey), claims.Role)
		c.Set(string(PermsKey), claims.Permissions)
		c.Next()
	}
}

func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get(string(UserIDKey))
	if !exists {
		return uuid.UUID{}, false
	}
	id, ok := val.(uuid.UUID)
	return id, ok
}

func GetUserName(c *gin.Context) string {
	val, _ := c.Get(string(UserNameKey))
	s, _ := val.(string)
	return s
}

func GetPermissions(c *gin.Context) []string {
	val, _ := c.Get(string(PermsKey))
	perms, _ := val.([]string)
	return perms
}
