package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type AuthService struct {
	userRepo *repository.UserRepository
	cfg      *config.AuthConfig
}

func NewAuthService(userRepo *repository.UserRepository, cfg *config.AuthConfig) *AuthService {
	return &AuthService{userRepo: userRepo, cfg: cfg}
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	TOTPCode string `json:"totp_code,omitempty"`
}

type TokenResponse struct {
	AccessToken  string     `json:"access_token"`
	RefreshToken string     `json:"refresh_token"`
	ExpiresAt    time.Time  `json:"expires_at"`
	User         model.User `json:"user"`
}

func (s *AuthService) Login(ctx context.Context, req LoginRequest) (*TokenResponse, error) {
	user, err := s.userRepo.GetByUsername(ctx, req.Username)
	if err != nil {
		return nil, fmt.Errorf("finding user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("invalid credentials")
	}
	if !user.IsActive {
		return nil, fmt.Errorf("account is disabled")
	}
	if user.PasswordHash == nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// Get role permissions
	role, err := s.userRepo.GetRoleByID(ctx, user.RoleID)
	if err != nil || role == nil {
		return nil, fmt.Errorf("finding role: %w", err)
	}

	// Generate tokens
	accessToken, expiresAt, err := s.generateAccessToken(user, role)
	if err != nil {
		return nil, fmt.Errorf("generating access token: %w", err)
	}

	refreshToken, err := s.generateRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("generating refresh token: %w", err)
	}

	s.userRepo.UpdateLastLogin(ctx, user.ID)

	user.PasswordHash = nil
	user.TOTPSecret = ""
	user.RoleName = role.Name

	return &TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		User:         *user,
	}, nil
}

func (s *AuthService) RefreshAccessToken(ctx context.Context, refreshTokenStr string) (*TokenResponse, error) {
	hash := hashToken(refreshTokenStr)
	rt, err := s.userRepo.GetRefreshToken(ctx, hash)
	if err != nil {
		return nil, fmt.Errorf("finding refresh token: %w", err)
	}
	if rt == nil {
		return nil, fmt.Errorf("invalid refresh token")
	}
	if time.Now().After(rt.ExpiresAt) {
		return nil, fmt.Errorf("refresh token expired")
	}

	// Revoke old token
	s.userRepo.RevokeRefreshToken(ctx, hash)

	user, err := s.userRepo.GetByID(ctx, rt.UserID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("finding user: %w", err)
	}
	if !user.IsActive {
		return nil, fmt.Errorf("account is disabled")
	}

	role, err := s.userRepo.GetRoleByID(ctx, user.RoleID)
	if err != nil || role == nil {
		return nil, fmt.Errorf("finding role: %w", err)
	}

	accessToken, expiresAt, err := s.generateAccessToken(user, role)
	if err != nil {
		return nil, fmt.Errorf("generating access token: %w", err)
	}

	newRefreshToken, err := s.generateRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("generating refresh token: %w", err)
	}

	user.PasswordHash = nil
	user.TOTPSecret = ""
	user.RoleName = role.Name

	return &TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresAt:    expiresAt,
		User:         *user,
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshTokenStr string) error {
	hash := hashToken(refreshTokenStr)
	return s.userRepo.RevokeRefreshToken(ctx, hash)
}

func (s *AuthService) generateAccessToken(user *model.User, role *model.Role) (string, time.Time, error) {
	expiresAt := time.Now().Add(time.Duration(s.cfg.JWTExpiryMinutes) * time.Minute)

	claims := middleware.JWTClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Role:        role.Name,
		Permissions: role.Permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "fuseone-gateway",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenStr, expiresAt, nil
}

func (s *AuthService) generateRefreshToken(ctx context.Context, userID uuid.UUID) (string, error) {
	tokenID := uuid.New()
	tokenStr := tokenID.String()
	hash := hashToken(tokenStr)

	rt := &model.RefreshToken{
		ID:        uuid.New(),
		UserID:    userID,
		TokenHash: hash,
		ExpiresAt: time.Now().AddDate(0, 0, s.cfg.RefreshExpiryDays),
	}

	if err := s.userRepo.CreateRefreshToken(ctx, rt); err != nil {
		return "", fmt.Errorf("storing refresh token: %w", err)
	}

	return tokenStr, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
