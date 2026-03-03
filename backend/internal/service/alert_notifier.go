package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
)

// AlertNotifier dispatches notifications for alert events.
type AlertNotifier struct {
	httpClient *http.Client
	logger     *zap.Logger
}

func NewAlertNotifier(logger *zap.Logger) *AlertNotifier {
	return &AlertNotifier{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		logger:     logger,
	}
}

// WebhookPayload is the JSON body sent to webhook endpoints.
type WebhookPayload struct {
	RuleName  string   `json:"rule_name"`
	RuleType  string   `json:"rule_type"`
	State     string   `json:"state"`
	Event     string   `json:"event"`
	Message   string   `json:"message"`
	Value     *float64 `json:"value,omitempty"`
	Threshold *float64 `json:"threshold,omitempty"`
	Timestamp string   `json:"timestamp"`
}

// Notify sends notifications for all channels configured on the rule.
func (n *AlertNotifier) Notify(ctx context.Context, rule *model.AlertRule, event *model.AlertEvent) {
	for _, ch := range rule.Channels {
		switch ch.Type {
		case "webhook":
			n.sendWebhook(ctx, ch, rule, event)
		case "slack":
			n.sendSlack(ctx, ch, rule, event)
		case "teams":
			n.sendTeams(ctx, ch, rule, event)
		default:
			n.logger.Warn("unsupported alert channel type", zap.String("type", ch.Type))
		}
	}
}

func (n *AlertNotifier) sendWebhook(ctx context.Context, ch model.AlertChannel, rule *model.AlertRule, event *model.AlertEvent) {
	var cfg model.WebhookConfig
	if err := json.Unmarshal(ch.Config, &cfg); err != nil {
		n.logger.Warn("invalid webhook config", zap.Error(err))
		return
	}
	if cfg.URL == "" {
		return
	}

	payload := WebhookPayload{
		RuleName:  rule.Name,
		RuleType:  rule.RuleType,
		State:     rule.State,
		Event:     event.EventType,
		Message:   event.Message,
		Value:     event.Value,
		Threshold: event.Threshold,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		n.logger.Warn("failed to marshal webhook payload", zap.Error(err))
		return
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.URL, bytes.NewReader(body))
	if err != nil {
		n.logger.Warn("failed to create webhook request", zap.Error(err), zap.String("url", cfg.URL))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range cfg.Headers {
		req.Header.Set(k, v)
	}

	resp, err := n.httpClient.Do(req)
	if err != nil {
		n.logger.Warn("webhook delivery failed", zap.Error(err), zap.String("url", cfg.URL))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		n.logger.Warn("webhook returned error",
			zap.String("url", cfg.URL),
			zap.Int("status", resp.StatusCode),
			zap.String("rule", rule.Name),
		)
	} else {
		n.logger.Debug("webhook delivered",
			zap.String("url", cfg.URL),
			zap.String("event", event.EventType),
			zap.String("rule", rule.Name),
		)
	}
}

func (n *AlertNotifier) sendSlack(ctx context.Context, ch model.AlertChannel, rule *model.AlertRule, event *model.AlertEvent) {
	var cfg model.SlackConfig
	if err := json.Unmarshal(ch.Config, &cfg); err != nil {
		n.logger.Warn("invalid slack config", zap.Error(err))
		return
	}
	if cfg.WebhookURL == "" {
		return
	}

	// Build emoji + color based on state
	emoji := ":white_check_mark:"
	color := "#22c55e"
	if rule.State == model.AlertStateFiring {
		emoji = ":rotating_light:"
		color = "#ef4444"
	}

	valueText := "-"
	if event.Value != nil {
		valueText = fmt.Sprintf("%.4f", *event.Value)
	}
	thresholdText := "-"
	if event.Threshold != nil {
		thresholdText = fmt.Sprintf("%.4f", *event.Threshold)
	}

	// Slack Block Kit payload with attachment for colored sidebar
	slackPayload := map[string]interface{}{
		"text": fmt.Sprintf("%s *%s* — %s", emoji, rule.Name, event.Message),
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"fields": []map[string]string{
					{"title": "Rule Type", "value": rule.RuleType, "short": "true"},
					{"title": "State", "value": rule.State, "short": "true"},
					{"title": "Value", "value": valueText, "short": "true"},
					{"title": "Threshold", "value": thresholdText, "short": "true"},
				},
				"footer": "FuseOne API Gateway",
				"ts":     fmt.Sprintf("%d", time.Now().Unix()),
			},
		},
	}

	if cfg.Channel != "" {
		slackPayload["channel"] = cfg.Channel
	}
	if cfg.Username != "" {
		slackPayload["username"] = cfg.Username
	}

	n.postJSON(ctx, cfg.WebhookURL, slackPayload, "slack", rule.Name)
}

func (n *AlertNotifier) sendTeams(ctx context.Context, ch model.AlertChannel, rule *model.AlertRule, event *model.AlertEvent) {
	var cfg model.TeamsConfig
	if err := json.Unmarshal(ch.Config, &cfg); err != nil {
		n.logger.Warn("invalid teams config", zap.Error(err))
		return
	}
	if cfg.WebhookURL == "" {
		return
	}

	themeColor := "22c55e"
	if rule.State == model.AlertStateFiring {
		themeColor = "ef4444"
	}

	valueText := "-"
	if event.Value != nil {
		valueText = fmt.Sprintf("%.4f", *event.Value)
	}
	thresholdText := "-"
	if event.Threshold != nil {
		thresholdText = fmt.Sprintf("%.4f", *event.Threshold)
	}

	// Teams MessageCard format (O365 Connector)
	teamsPayload := map[string]interface{}{
		"@type":      "MessageCard",
		"@context":   "http://schema.org/extensions",
		"themeColor": themeColor,
		"summary":    fmt.Sprintf("Alert: %s — %s", rule.Name, event.EventType),
		"sections": []map[string]interface{}{
			{
				"activityTitle": fmt.Sprintf("Alert: %s", rule.Name),
				"activitySubtitle": event.Message,
				"facts": []map[string]string{
					{"name": "Rule Type", "value": rule.RuleType},
					{"name": "State", "value": rule.State},
					{"name": "Value", "value": valueText},
					{"name": "Threshold", "value": thresholdText},
					{"name": "Event", "value": event.EventType},
				},
				"markdown": true,
			},
		},
	}

	n.postJSON(ctx, cfg.WebhookURL, teamsPayload, "teams", rule.Name)
}

// postJSON is a helper that marshals and POSTs a JSON payload.
func (n *AlertNotifier) postJSON(ctx context.Context, url string, payload interface{}, channelType, ruleName string) {
	body, err := json.Marshal(payload)
	if err != nil {
		n.logger.Warn("failed to marshal payload", zap.String("channel", channelType), zap.Error(err))
		return
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		n.logger.Warn("failed to create request", zap.String("channel", channelType), zap.Error(err), zap.String("url", url))
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.httpClient.Do(req)
	if err != nil {
		n.logger.Warn("delivery failed", zap.String("channel", channelType), zap.Error(err), zap.String("url", url))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		n.logger.Warn("channel returned error",
			zap.String("channel", channelType), zap.String("url", url),
			zap.Int("status", resp.StatusCode), zap.String("rule", ruleName),
		)
	} else {
		n.logger.Debug("notification delivered",
			zap.String("channel", channelType), zap.String("rule", ruleName),
		)
	}
}

// TestChannel sends a test notification to verify any channel type.
func (n *AlertNotifier) TestChannel(ctx context.Context, channelType string, config json.RawMessage) error {
	testRule := &model.AlertRule{
		Name:     "Test Alert",
		RuleType: "test",
		State:    model.AlertStateFiring,
	}
	testEvent := &model.AlertEvent{
		EventType: "test",
		Message:   "This is a test notification from FuseOne API Gateway",
	}
	ch := model.AlertChannel{Type: channelType, Config: config}

	switch channelType {
	case "webhook":
		var cfg model.WebhookConfig
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("invalid webhook config: %w", err)
		}
		if cfg.URL == "" {
			return fmt.Errorf("webhook URL is required")
		}
		n.sendWebhook(ctx, ch, testRule, testEvent)
	case "slack":
		var cfg model.SlackConfig
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("invalid slack config: %w", err)
		}
		if cfg.WebhookURL == "" {
			return fmt.Errorf("slack webhook URL is required")
		}
		n.sendSlack(ctx, ch, testRule, testEvent)
	case "teams":
		var cfg model.TeamsConfig
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("invalid teams config: %w", err)
		}
		if cfg.WebhookURL == "" {
			return fmt.Errorf("teams webhook URL is required")
		}
		n.sendTeams(ctx, ch, testRule, testEvent)
	default:
		return fmt.Errorf("unsupported channel type: %s", channelType)
	}
	return nil
}

// TestWebhook sends a test notification to verify webhook connectivity.
func (n *AlertNotifier) TestWebhook(ctx context.Context, url string, headers map[string]string) error {
	payload := WebhookPayload{
		RuleName:  "Test Alert",
		RuleType:  "test",
		State:     "firing",
		Event:     "test",
		Message:   "This is a test notification from FuseOne API Gateway",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delivery: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}
