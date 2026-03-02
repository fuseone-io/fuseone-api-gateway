package service

import (
	"context"
	"encoding/json"

	"go.uber.org/zap"
)

// SystemGlobalRuleID is the fixed ID for the platform-managed global rule.
const SystemGlobalRuleID = "fuseone_platform"

// SystemPolicies manages platform-level global rules that are auto-created
// on startup and shown as read-only in the frontend.
type SystemPolicies struct {
	apisix *APISIXClient
	logger *zap.Logger
}

func NewSystemPolicies(apisix *APISIXClient, logger *zap.Logger) *SystemPolicies {
	return &SystemPolicies{apisix: apisix, logger: logger}
}

// EnsureSystemGlobalRules creates or updates the platform global rule.
// This is best-effort — errors are logged but not propagated to avoid
// blocking gateway startup.
func (sp *SystemPolicies) EnsureSystemGlobalRules(ctx context.Context) error {
	// Note: APISIX global_rules do NOT support labels (unlike routes/services).
	// We identify system rules by their well-known ID (fuseone_platform) instead.
	payload := map[string]interface{}{
		"plugins": map[string]interface{}{
			"request-id": map[string]interface{}{
				"header_name":         "X-Correlation-Id",
				"include_in_response": true,
				"algorithm":           "uuid",
			},
			"prometheus": map[string]interface{}{
				"prefer_name": true,
			},
		},
	}

	data, _ := json.Marshal(payload)

	_, err := sp.apisix.CreateWithID(ctx, "global_rules", SystemGlobalRuleID, data)
	if err != nil {
		sp.logger.Warn("failed to ensure system global rule",
			zap.String("id", SystemGlobalRuleID),
			zap.Error(err),
		)
		return nil // best-effort
	}

	sp.logger.Info("system global rule ensured", zap.String("id", SystemGlobalRuleID))
	return nil
}
