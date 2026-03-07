package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// KafkaConnectionQuerier defines the interface for Kafka connection database operations.
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

func (r *KafkaConnectionRepository) Create(ctx context.Context, conn *model.KafkaConnection) error {
	query := `INSERT INTO kafka_connections (name, description, brokers, security_protocol, sasl_mechanism, sasl_username, sasl_password, is_active, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		conn.Name, conn.Description, conn.Brokers, conn.SecurityProtocol,
		conn.SASLMechanism, conn.SASLUsername, conn.SASLPassword,
		conn.IsActive, conn.CreatedBy,
	).Scan(&conn.ID, &conn.CreatedAt, &conn.UpdatedAt)
}

func (r *KafkaConnectionRepository) Get(ctx context.Context, id uuid.UUID) (*model.KafkaConnection, error) {
	query := `SELECT id, name, description, brokers, security_protocol, sasl_mechanism, sasl_username, sasl_password, is_active, created_by, created_at, updated_at
		FROM kafka_connections WHERE id = $1`
	conn := &model.KafkaConnection{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&conn.ID, &conn.Name, &conn.Description, &conn.Brokers,
		&conn.SecurityProtocol, &conn.SASLMechanism, &conn.SASLUsername,
		&conn.SASLPassword, &conn.IsActive,
		&conn.CreatedBy, &conn.CreatedAt, &conn.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return conn, nil
}

func (r *KafkaConnectionRepository) Update(ctx context.Context, conn *model.KafkaConnection) error {
	query := `UPDATE kafka_connections SET name=$1, description=$2, brokers=$3, security_protocol=$4,
		sasl_mechanism=$5, sasl_username=$6, sasl_password=$7, is_active=$8,
		updated_at=NOW()
		WHERE id=$9`
	_, err := r.pool.Exec(ctx, query,
		conn.Name, conn.Description, conn.Brokers, conn.SecurityProtocol,
		conn.SASLMechanism, conn.SASLUsername, conn.SASLPassword,
		conn.IsActive, conn.ID,
	)
	return err
}

func (r *KafkaConnectionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM kafka_connections WHERE id = $1`, id)
	return err
}

func (r *KafkaConnectionRepository) List(ctx context.Context) ([]model.KafkaConnection, error) {
	query := `SELECT id, name, description, brokers, security_protocol, sasl_mechanism, sasl_username, sasl_password, is_active, created_by, created_at, updated_at
		FROM kafka_connections ORDER BY created_at DESC`
	return r.scanConnections(ctx, query)
}

func (r *KafkaConnectionRepository) ListActive(ctx context.Context) ([]model.KafkaConnection, error) {
	query := `SELECT id, name, description, brokers, security_protocol, sasl_mechanism, sasl_username, sasl_password, is_active, created_by, created_at, updated_at
		FROM kafka_connections WHERE is_active = true ORDER BY created_at DESC`
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
		var conn model.KafkaConnection
		if err := rows.Scan(
			&conn.ID, &conn.Name, &conn.Description, &conn.Brokers,
			&conn.SecurityProtocol, &conn.SASLMechanism, &conn.SASLUsername,
			&conn.SASLPassword, &conn.IsActive,
			&conn.CreatedBy, &conn.CreatedAt, &conn.UpdatedAt,
		); err != nil {
			return nil, err
		}
		connections = append(connections, conn)
	}
	return connections, nil
}
