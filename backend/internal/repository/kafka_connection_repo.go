package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// KafkaConnectionQuerier defines the interface for stream connection database operations.
type KafkaConnectionQuerier interface {
	Create(ctx context.Context, conn *model.KafkaConnection) error
	Get(ctx context.Context, id uuid.UUID) (*model.KafkaConnection, error)
	Update(ctx context.Context, conn *model.KafkaConnection) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context) ([]model.KafkaConnection, error)
	ListActive(ctx context.Context) ([]model.KafkaConnection, error)
}

// KafkaConnectionRepository implements KafkaConnectionQuerier using PostgreSQL.
type KafkaConnectionRepository struct {
	pool *pgxpool.Pool
}

// NewKafkaConnectionRepository creates a new KafkaConnectionRepository.
func NewKafkaConnectionRepository(pool *pgxpool.Pool) *KafkaConnectionRepository {
	return &KafkaConnectionRepository{pool: pool}
}

const selectCols = `id, name, description,
	COALESCE(connection_type, 'kafka'),
	brokers, security_protocol, sasl_mechanism, sasl_username, sasl_password,
	COALESCE(nats_urls, '{}'), nats_token, nats_nkey_seed, nats_credentials,
	COALESCE(nats_jetstream, false), COALESCE(nats_tls, false),
	is_active, created_by, created_at, updated_at`

func scanConn(row interface {
	Scan(dest ...any) error
}) (*model.KafkaConnection, error) {
	conn := &model.KafkaConnection{}
	err := row.Scan(
		&conn.ID, &conn.Name, &conn.Description,
		&conn.ConnectionType,
		&conn.Brokers, &conn.SecurityProtocol,
		&conn.SASLMechanism, &conn.SASLUsername, &conn.SASLPassword,
		&conn.NATSURLs, &conn.NATSToken, &conn.NATSNKeySeed, &conn.NATSCredentials,
		&conn.NATSJetStream, &conn.NATSTLS,
		&conn.IsActive, &conn.CreatedBy, &conn.CreatedAt, &conn.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

func (r *KafkaConnectionRepository) Create(ctx context.Context, conn *model.KafkaConnection) error {
	query := `INSERT INTO kafka_connections
		(name, description, connection_type,
		 brokers, security_protocol, sasl_mechanism, sasl_username, sasl_password,
		 nats_urls, nats_token, nats_nkey_seed, nats_credentials, nats_jetstream, nats_tls,
		 is_active, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		conn.Name, conn.Description, conn.ConnectionType,
		conn.Brokers, conn.SecurityProtocol,
		conn.SASLMechanism, conn.SASLUsername, conn.SASLPassword,
		conn.NATSURLs, conn.NATSToken, conn.NATSNKeySeed, conn.NATSCredentials,
		conn.NATSJetStream, conn.NATSTLS,
		conn.IsActive, conn.CreatedBy,
	).Scan(&conn.ID, &conn.CreatedAt, &conn.UpdatedAt)
}

func (r *KafkaConnectionRepository) Get(ctx context.Context, id uuid.UUID) (*model.KafkaConnection, error) {
	query := `SELECT ` + selectCols + ` FROM kafka_connections WHERE id = $1`
	conn, err := scanConn(r.pool.QueryRow(ctx, query, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return conn, nil
}

func (r *KafkaConnectionRepository) Update(ctx context.Context, conn *model.KafkaConnection) error {
	query := `UPDATE kafka_connections SET
		name=$1, description=$2, connection_type=$3,
		brokers=$4, security_protocol=$5, sasl_mechanism=$6, sasl_username=$7, sasl_password=$8,
		nats_urls=$9, nats_token=$10, nats_nkey_seed=$11, nats_credentials=$12,
		nats_jetstream=$13, nats_tls=$14,
		is_active=$15, updated_at=NOW()
		WHERE id=$16`
	_, err := r.pool.Exec(ctx, query,
		conn.Name, conn.Description, conn.ConnectionType,
		conn.Brokers, conn.SecurityProtocol,
		conn.SASLMechanism, conn.SASLUsername, conn.SASLPassword,
		conn.NATSURLs, conn.NATSToken, conn.NATSNKeySeed, conn.NATSCredentials,
		conn.NATSJetStream, conn.NATSTLS,
		conn.IsActive, conn.ID,
	)
	return err
}

func (r *KafkaConnectionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM kafka_connections WHERE id = $1`, id)
	return err
}

func (r *KafkaConnectionRepository) List(ctx context.Context) ([]model.KafkaConnection, error) {
	query := `SELECT ` + selectCols + ` FROM kafka_connections ORDER BY created_at DESC`
	return r.scanConnections(ctx, query)
}

func (r *KafkaConnectionRepository) ListActive(ctx context.Context) ([]model.KafkaConnection, error) {
	query := `SELECT ` + selectCols + ` FROM kafka_connections WHERE is_active = true ORDER BY created_at DESC`
	return r.scanConnections(ctx, query)
}

func (r *KafkaConnectionRepository) scanConnections(ctx context.Context, query string, args ...any) ([]model.KafkaConnection, error) {
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var connections []model.KafkaConnection
	for rows.Next() {
		conn, err := scanConn(rows)
		if err != nil {
			return nil, err
		}
		connections = append(connections, *conn)
	}
	return connections, nil
}
