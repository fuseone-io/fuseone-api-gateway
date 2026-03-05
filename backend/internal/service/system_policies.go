package service

import (
	"context"
	"encoding/json"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
)

// SystemGlobalRuleID is the fixed ID for the platform-managed global rule.
const SystemGlobalRuleID = "fuseone_platform"

// SystemPolicies manages platform-level global rules that are auto-created
// on startup and shown as read-only in the frontend.
type SystemPolicies struct {
	apisix  *APISIXClient
	tracing *config.TracingConfig
	logger  *zap.Logger
}

func NewSystemPolicies(apisix *APISIXClient, tracing *config.TracingConfig, logger *zap.Logger) *SystemPolicies {
	return &SystemPolicies{apisix: apisix, tracing: tracing, logger: logger}
}

// EnsureSystemGlobalRules creates or updates the platform global rule.
// This is best-effort — errors are logged but not propagated to avoid
// blocking gateway startup.
func (sp *SystemPolicies) EnsureSystemGlobalRules(ctx context.Context) error {
	// Note: APISIX global_rules do NOT support labels (unlike routes/services).
	// We identify system rules by their well-known ID (fuseone_platform) instead.
	plugins := map[string]interface{}{
		"request-id": map[string]interface{}{
			"header_name":         "X-Correlation-Id",
			"include_in_response": true,
			"algorithm":           "uuid",
		},
		"prometheus": map[string]interface{}{
			"prefer_name": true,
		},
	}

	// Auto-enable opentelemetry tracing for all routes (Sensedia-style).
	// Users don't need to add anything to their flows — tracing is automatic.
	// IMPORTANT: APISIX opentelemetry plugin defaults to sampler=always_off,
	// so we MUST explicitly set the sampler or no spans will be created.
	if sp.tracing != nil && sp.tracing.Enabled {
		otelPlugin := map[string]interface{}{}
		if sp.tracing.SampleRate < 1.0 && sp.tracing.SampleRate > 0 {
			otelPlugin["sampler"] = map[string]interface{}{
				"name": "trace_id_ratio",
				"options": map[string]interface{}{
					"fraction": sp.tracing.SampleRate,
				},
			}
		} else {
			// SampleRate >= 1.0 means trace everything
			otelPlugin["sampler"] = map[string]interface{}{
				"name": "always_on",
				"options": map[string]interface{}{
					"fraction": 1,
				},
			}
		}
		// Include nginx timing variables as span attributes so the backend
		// can decompose the root span into a meaningful waterfall (gateway
		// vs upstream breakdown) without any custom APISIX plugin.
		otelPlugin["additional_attributes"] = []string{
			"upstream_response_time",
			"upstream_connect_time",
			"upstream_header_time",
			"upstream_addr",
			"upstream_status",
		}
		plugins["opentelemetry"] = otelPlugin
	}

	payload := map[string]interface{}{
		"plugins": plugins,
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

	sp.logger.Info("system global rule ensured",
		zap.String("id", SystemGlobalRuleID),
		zap.Bool("tracing", sp.tracing != nil && sp.tracing.Enabled),
	)

	// Set opentelemetry plugin_metadata so APISIX knows where to send traces.
	// Without this, the opentelemetry plugin warns and does nothing.
	if sp.tracing != nil && sp.tracing.Enabled {
		addr := sp.tracing.CollectorAddress
		if addr == "" {
			addr = "host.docker.internal:8080"
		}
		otelMeta := map[string]interface{}{
			"resource": map[string]interface{}{
				"service.name": "fuseone-gateway",
			},
			"collector": map[string]interface{}{
				"address":         addr,
				"request_timeout": 3,
				"request_headers": map[string]interface{}{
					"Content-Type": "application/x-protobuf",
				},
			},
			"batch_span_processor": map[string]interface{}{
				"max_export_batch_size": 64,
				"inactive_timeout":      2,
			},
			"trace_id_source": "x-request-id",
			"set_ngx_var":     true,
		}
		metaData, _ := json.Marshal(otelMeta)
		_, err := sp.apisix.CreateWithID(ctx, "plugin_metadata", "opentelemetry", metaData)
		if err != nil {
			sp.logger.Warn("failed to set opentelemetry plugin_metadata", zap.Error(err))
		} else {
			sp.logger.Info("opentelemetry plugin_metadata configured",
				zap.String("collector", addr),
			)
		}
	}

	return nil
}

// UpdateTracing updates the tracing configuration at runtime.
// It modifies the in-memory config, pushes the new settings to APISIX,
// and persists to the settings store via the caller.
func (sp *SystemPolicies) UpdateTracing(ctx context.Context, enabled bool, sampleRate float64, retentionDays int) error {
	sp.tracing.Enabled = enabled
	sp.tracing.SampleRate = sampleRate
	if retentionDays > 0 {
		sp.tracing.RetentionDays = retentionDays
	}

	// Re-apply the full global rule (includes toggling opentelemetry on/off)
	return sp.EnsureSystemGlobalRules(ctx)
}
