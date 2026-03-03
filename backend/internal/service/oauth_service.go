package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/oauth2"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// providerTemplate holds the well-known OAuth2 endpoints for a provider.
type providerTemplate struct {
	AuthURL     string
	TokenURL    string
	UserInfoURL string
}

var providerTemplates = map[string]providerTemplate{
	"google": {
		AuthURL:     "https://accounts.google.com/o/oauth2/v2/auth",
		TokenURL:    "https://oauth2.googleapis.com/token",
		UserInfoURL: "https://www.googleapis.com/oauth2/v3/userinfo",
	},
	"microsoft": {
		AuthURL:     "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
		TokenURL:    "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
		UserInfoURL: "https://graph.microsoft.com/v1.0/me",
	},
	"github": {
		AuthURL:     "https://github.com/login/oauth/authorize",
		TokenURL:    "https://github.com/login/oauth/access_token",
		UserInfoURL: "https://api.github.com/user",
	},
	"okta": {
		AuthURL:     "https://{domain}/oauth2/default/v1/authorize",
		TokenURL:    "https://{domain}/oauth2/default/v1/token",
		UserInfoURL: "https://{domain}/oauth2/default/v1/userinfo",
	},
}

type OAuthService struct {
	repo        *repository.OAuthProviderRepository
	userRepo    *repository.UserRepository
	authService *AuthService
	cfg         *config.AuthConfig
	logger      *zap.Logger
}

func NewOAuthService(
	repo *repository.OAuthProviderRepository,
	userRepo *repository.UserRepository,
	authService *AuthService,
	cfg *config.AuthConfig,
	logger *zap.Logger,
) *OAuthService {
	return &OAuthService{
		repo:        repo,
		userRepo:    userRepo,
		authService: authService,
		cfg:         cfg,
		logger:      logger,
	}
}

func (s *OAuthService) GetEnabledProviders(ctx context.Context) ([]model.PublicOAuthProvider, error) {
	return s.repo.GetEnabled(ctx)
}

func (s *OAuthService) GetAuthorizeURL(ctx context.Context, providerSlug, redirectURI string) (string, string, error) {
	provider, err := s.repo.GetByProvider(ctx, providerSlug)
	if err != nil {
		return "", "", fmt.Errorf("fetching provider: %w", err)
	}
	if provider == nil || !provider.IsEnabled {
		return "", "", fmt.Errorf("provider not found or disabled")
	}

	cfg := s.buildOAuth2Config(provider, redirectURI)

	state, err := generateState()
	if err != nil {
		return "", "", fmt.Errorf("generating state: %w", err)
	}

	url := cfg.AuthCodeURL(state, oauth2.AccessTypeOffline)
	return url, state, nil
}

func (s *OAuthService) HandleCallback(ctx context.Context, providerSlug, code, redirectURI string) (*TokenResponse, error) {
	provider, err := s.repo.GetByProvider(ctx, providerSlug)
	if err != nil {
		return nil, fmt.Errorf("fetching provider: %w", err)
	}
	if provider == nil || !provider.IsEnabled {
		return nil, fmt.Errorf("provider not found or disabled")
	}

	cfg := s.buildOAuth2Config(provider, redirectURI)

	// Exchange code for token
	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("exchanging code: %w", err)
	}

	// Fetch user info
	userInfo, err := s.fetchUserInfo(ctx, provider, token)
	if err != nil {
		return nil, fmt.Errorf("fetching user info: %w", err)
	}

	// Find existing link
	link, err := s.repo.GetUserLink(ctx, providerSlug, userInfo.ProviderUID)
	if err != nil {
		return nil, fmt.Errorf("looking up user link: %w", err)
	}

	var user *model.User

	if link != nil {
		// Existing linked user
		user, err = s.userRepo.GetByID(ctx, link.UserID)
		if err != nil {
			return nil, fmt.Errorf("fetching linked user: %w", err)
		}
		if user == nil || !user.IsActive {
			return nil, fmt.Errorf("linked user not found or disabled")
		}
	} else {
		// No link found — try to match by email
		if userInfo.Email != "" {
			user, err = s.userRepo.GetByEmail(ctx, userInfo.Email)
			if err != nil {
				return nil, fmt.Errorf("looking up user by email: %w", err)
			}
		}

		if user != nil && user.IsActive {
			// Found user by email — create link
			newLink := &model.UserOAuthLink{
				UserID:      user.ID,
				Provider:    providerSlug,
				ProviderUID: userInfo.ProviderUID,
				Email:       userInfo.Email,
			}
			if err := s.repo.CreateUserLink(ctx, newLink); err != nil {
				s.logger.Warn("failed to create oauth link", zap.Error(err))
			}
		} else if provider.AutoCreateUsers {
			// Auto-create user
			roleID := provider.DefaultRoleID
			if roleID == nil {
				// Fallback to viewer role
				viewerRole, _ := s.userRepo.GetRoleByName(ctx, "viewer")
				if viewerRole != nil {
					roleID = &viewerRole.ID
				}
			}
			if roleID == nil {
				return nil, fmt.Errorf("no default role configured for auto-provisioning")
			}

			username := s.generateUsername(userInfo)
			displayName := userInfo.DisplayName
			if displayName == "" {
				displayName = username
			}

			newUser := &model.User{
				Username:    username,
				Email:       &userInfo.Email,
				DisplayName: displayName,
				RoleID:      *roleID,
				IsActive:    true,
			}
			if err := s.userRepo.Create(ctx, newUser); err != nil {
				return nil, fmt.Errorf("auto-creating user: %w", err)
			}

			newLink := &model.UserOAuthLink{
				UserID:      newUser.ID,
				Provider:    providerSlug,
				ProviderUID: userInfo.ProviderUID,
				Email:       userInfo.Email,
			}
			if err := s.repo.CreateUserLink(ctx, newLink); err != nil {
				s.logger.Warn("failed to create oauth link after user creation", zap.Error(err))
			}

			user = newUser
		} else {
			return nil, fmt.Errorf("no account linked to this %s identity; contact an administrator", providerSlug)
		}
	}

	// Generate JWT tokens using auth service internals
	role, err := s.userRepo.GetRoleByID(ctx, user.RoleID)
	if err != nil || role == nil {
		return nil, fmt.Errorf("fetching user role: %w", err)
	}

	accessToken, expiresAt, err := s.authService.generateAccessToken(user, role)
	if err != nil {
		return nil, fmt.Errorf("generating access token: %w", err)
	}

	refreshToken, err := s.authService.generateRefreshToken(ctx, user.ID)
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

func (s *OAuthService) buildOAuth2Config(provider *model.OAuthProvider, redirectURI string) *oauth2.Config {
	var authURL, tokenURL string

	tmpl, ok := providerTemplates[provider.Provider]
	if ok {
		authURL = tmpl.AuthURL
		tokenURL = tmpl.TokenURL
	}

	// Apply extra_config substitutions
	var extra map[string]string
	json.Unmarshal(provider.ExtraConfig, &extra)

	if provider.Provider == "microsoft" {
		tenant := extra["tenant_id"]
		if tenant == "" {
			tenant = "common"
		}
		authURL = strings.ReplaceAll(authURL, "{tenant}", tenant)
		tokenURL = strings.ReplaceAll(tokenURL, "{tenant}", tenant)
	} else if provider.Provider == "okta" {
		domain := extra["domain"]
		authURL = strings.ReplaceAll(authURL, "{domain}", domain)
		tokenURL = strings.ReplaceAll(tokenURL, "{domain}", domain)
	} else if provider.Provider == "oidc" {
		// Generic OIDC — all URLs from extra_config
		authURL = extra["authorization_url"]
		tokenURL = extra["token_url"]
	}

	scopes := provider.Scopes
	if len(scopes) == 0 {
		scopes = []string{"openid", "email", "profile"}
	}

	return &oauth2.Config{
		ClientID:     provider.ClientID,
		ClientSecret: provider.ClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:  authURL,
			TokenURL: tokenURL,
		},
		RedirectURL: redirectURI,
		Scopes:      scopes,
	}
}

type oauthUserInfo struct {
	ProviderUID string
	Email       string
	DisplayName string
}

func (s *OAuthService) fetchUserInfo(ctx context.Context, provider *model.OAuthProvider, token *oauth2.Token) (*oauthUserInfo, error) {
	var userInfoURL string

	tmpl, ok := providerTemplates[provider.Provider]
	if ok {
		userInfoURL = tmpl.UserInfoURL
	}

	var extra map[string]string
	json.Unmarshal(provider.ExtraConfig, &extra)

	if provider.Provider == "okta" {
		domain := extra["domain"]
		userInfoURL = strings.ReplaceAll(userInfoURL, "{domain}", domain)
	} else if provider.Provider == "oidc" {
		userInfoURL = extra["userinfo_url"]
	}

	client := oauth2.NewClient(ctx, oauth2.StaticTokenSource(token))
	req, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("building userinfo request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("requesting userinfo: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading userinfo response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo returned status %d: %s", resp.StatusCode, string(body))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("parsing userinfo: %w", err)
	}

	return s.extractUserInfo(provider.Provider, data), nil
}

func (s *OAuthService) extractUserInfo(providerSlug string, data map[string]interface{}) *oauthUserInfo {
	info := &oauthUserInfo{}

	switch providerSlug {
	case "google":
		info.ProviderUID = getString(data, "sub")
		info.Email = getString(data, "email")
		info.DisplayName = getString(data, "name")

	case "microsoft":
		info.ProviderUID = getString(data, "id")
		info.Email = getString(data, "mail")
		if info.Email == "" {
			info.Email = getString(data, "userPrincipalName")
		}
		info.DisplayName = getString(data, "displayName")

	case "github":
		if id, ok := data["id"]; ok {
			info.ProviderUID = fmt.Sprintf("%v", id)
		}
		info.Email = getString(data, "email")
		info.DisplayName = getString(data, "name")
		if info.DisplayName == "" {
			info.DisplayName = getString(data, "login")
		}

	default: // okta, oidc
		info.ProviderUID = getString(data, "sub")
		info.Email = getString(data, "email")
		info.DisplayName = getString(data, "name")
	}

	return info
}

func (s *OAuthService) generateUsername(info *oauthUserInfo) string {
	if info.Email != "" {
		parts := strings.SplitN(info.Email, "@", 2)
		return parts[0]
	}
	return "user-" + uuid.New().String()[:8]
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
