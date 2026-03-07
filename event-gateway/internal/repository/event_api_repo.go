package repository

import (
	"context"
	"encoding/json"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/fuseone/event-gateway/internal/stream"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

type EventApiRepository struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func NewEventApiRepository(pool *pgxpool.Pool, logger *zap.Logger) *EventApiRepository {
	return &EventApiRepository{pool: pool, logger: logger}
}

// EventApiWithConnection joins event_api with its stream connection for the gateway to use.
// Provider is populated by ConfigManager after DB load — not scanned from DB.
type EventApiWithConnection struct {
	model.EventApi
	Connection   model.StreamConnection // underlying connection config
	Provider     stream.StreamProvider  // live provider, set by ConfigManager
	ActiveSchema json.RawMessage        // Active schema content (loaded from event_schemas), nil if none
}

const eventApiSelectCols = `
	ea.id, ea.name, ea.description, ea.slug,
	ea.kafka_connection_id, ea.topic_name,
	ea.rest_produce, ea.rest_consume, ea.sse_enabled,
	ea.websocket_enabled, ea.webhook_enabled,
	ea.consumer_group_prefix, ea.auto_offset_reset,
	ea.schema_validation,
	ea.status, ea.created_at, ea.updated_at,
	kc.id,
	COALESCE(kc.connection_type, 'kafka'),
	kc.brokers, kc.security_protocol,
	kc.sasl_mechanism, kc.sasl_username, kc.sasl_password,
	kc.nats_urls, kc.nats_token, kc.nats_nkey_seed,
	kc.nats_credentials,
	COALESCE(kc.nats_jetstream, false),
	COALESCE(kc.nats_tls, false)
`

func scanEventApiWithConnection(scan func(dest ...any) error) (EventApiWithConnection, error) {
	var eac EventApiWithConnection
	err := scan(
		&eac.ID, &eac.Name, &eac.Description, &eac.Slug,
		&eac.KafkaConnectionID, &eac.TopicName,
		&eac.RestProduce, &eac.RestConsume, &eac.SSEEnabled,
		&eac.WebsocketEnabled, &eac.WebhookEnabled,
		&eac.ConsumerGroupPrefix, &eac.AutoOffsetReset,
		&eac.SchemaValidation,
		&eac.Status, &eac.CreatedAt, &eac.UpdatedAt,
		&eac.Connection.ID,
		&eac.Connection.ConnectionType,
		&eac.Connection.Brokers, &eac.Connection.SecurityProtocol,
		&eac.Connection.SASLMechanism, &eac.Connection.SASLUsername, &eac.Connection.SASLPassword,
		&eac.Connection.NATSURLs, &eac.Connection.NATSToken, &eac.Connection.NATSNKeySeed,
		&eac.Connection.NATSCredentials,
		&eac.Connection.NATSJetStream,
		&eac.Connection.NATSTLS,
	)
	return eac, err
}

func (r *EventApiRepository) ListActive(ctx context.Context) ([]EventApiWithConnection, error) {
	query := `SELECT ` + eventApiSelectCols + `
		FROM event_apis ea
		JOIN kafka_connections kc ON kc.id = ea.kafka_connection_id
		WHERE ea.status = 'active' AND kc.is_active = true`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []EventApiWithConnection
	for rows.Next() {
		eac, err := scanEventApiWithConnection(rows.Scan)
		if err != nil {
			return nil, err
		}
		results = append(results, eac)
	}
	return results, rows.Err()
}

func (r *EventApiRepository) GetBySlug(ctx context.Context, slug string) (*EventApiWithConnection, error) {
	query := `SELECT ` + eventApiSelectCols + `
		FROM event_apis ea
		JOIN kafka_connections kc ON kc.id = ea.kafka_connection_id
		WHERE ea.slug = $1 AND ea.status = 'active' AND kc.is_active = true`
	eac, err := scanEventApiWithConnection(func(dest ...any) error {
		return r.pool.QueryRow(ctx, query, slug).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}
	return &eac, nil
}

func (r *EventApiRepository) GetByID(ctx context.Context, id uuid.UUID) (*EventApiWithConnection, error) {
	query := `SELECT ` + eventApiSelectCols + `
		FROM event_apis ea
		JOIN kafka_connections kc ON kc.id = ea.kafka_connection_id
		WHERE ea.id = $1`
	eac, err := scanEventApiWithConnection(func(dest ...any) error {
		return r.pool.QueryRow(ctx, query, id).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}
	return &eac, nil
}

// LoadActiveSchema loads the active schema content for an Event API (if any).
func (r *EventApiRepository) LoadActiveSchema(ctx context.Context, eventApiID uuid.UUID) (json.RawMessage, error) {
	var content json.RawMessage
	err := r.pool.QueryRow(ctx, `
		SELECT schema_content FROM event_schemas
		WHERE event_api_id = $1 AND is_active = true
		ORDER BY version DESC LIMIT 1
	`, eventApiID).Scan(&content)
	if err != nil {
		return nil, err // pgx.ErrNoRows if none
	}
	return content, nil
}
