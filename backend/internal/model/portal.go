package model

import (
	"time"

	"github.com/google/uuid"
)

// PortalApiSummary is a minimal representation of an API for the public catalog.
type PortalApiSummary struct {
	ID              uuid.UUID `db:"id" json:"id"`
	Name            string    `db:"name" json:"name"`
	Description     string    `db:"description" json:"description"`
	Version         string    `db:"version" json:"version"`
	LifecycleStatus string    `db:"lifecycle_status" json:"lifecycle_status"`
	Categories      []string  `db:"portal_categories" json:"categories"`
	HasOpenAPISpec  bool      `db:"has_openapi_spec" json:"has_openapi_spec"`
	PlanCount       int       `db:"plan_count" json:"plan_count"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

// PortalApiDetail extends the summary with full details for the detail page.
type PortalApiDetail struct {
	PortalApiSummary
	OpenAPISpec string       `json:"openapi_spec,omitempty"`
	Plans       []PortalPlan `json:"plans"`
}

// PortalPlan represents a plan available for subscription.
type PortalPlan struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	RateLimit   int    `json:"rate_limit"`
	QuotaDay    int    `json:"quota_day"`
	QuotaMonth  int    `json:"quota_month"`
}

// DeveloperRegistration is the signup request for the developer portal.
type DeveloperRegistration struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"full_name"`
	Company  string `json:"company"`
}

// DeveloperProfile is the developer's profile with stats.
type DeveloperProfile struct {
	ID                  uuid.UUID  `json:"id"`
	Username            string     `json:"username"`
	Email               *string    `json:"email,omitempty"`
	DisplayName         string     `json:"display_name"`
	Company             string     `json:"company"`
	ActiveSubscriptions int        `json:"active_subscriptions"`
	TotalAPIKeys        int        `json:"total_api_keys"`
	LastLoginAt         *time.Time `json:"last_login_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

// PortalSubscription enriches a subscription with API and plan names for display.
type PortalSubscription struct {
	Subscription
	ApiName  string `json:"api_name"`
	PlanName string `json:"plan_name"`
}

// PortalAPIKey represents a developer's API key from an active subscription.
type PortalAPIKey struct {
	SubscriptionID uuid.UUID `json:"subscription_id"`
	ApiName        string    `json:"api_name"`
	PlanName       string    `json:"plan_name"`
	ConsumerName   string    `json:"consumer_name"`
	APIKey         string    `json:"api_key"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

// PortalSubscribeRequest is the request body for self-service subscription.
type PortalSubscribeRequest struct {
	PlanID string `json:"plan_id"`
	Notes  string `json:"notes"`
}

// UpdatePortalSettingsRequest is the admin request to update API portal visibility.
type UpdatePortalSettingsRequest struct {
	PortalVisible    *bool    `json:"portal_visible"`
	PortalCategories []string `json:"portal_categories"`
	OpenAPISpec      *string  `json:"openapi_spec"`
}
