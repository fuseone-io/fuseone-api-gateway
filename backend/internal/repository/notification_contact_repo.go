package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// NotificationContactQuerier defines the interface for notification contact operations.
type NotificationContactQuerier interface {
	Create(ctx context.Context, contact *model.NotificationContact) error
	Get(ctx context.Context, id uuid.UUID) (*model.NotificationContact, error)
	Update(ctx context.Context, contact *model.NotificationContact) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context) ([]model.NotificationContact, error)
}

type NotificationContactRepository struct {
	pool *pgxpool.Pool
}

func NewNotificationContactRepository(pool *pgxpool.Pool) *NotificationContactRepository {
	return &NotificationContactRepository{pool: pool}
}

func (r *NotificationContactRepository) Create(ctx context.Context, contact *model.NotificationContact) error {
	configJSON, err := json.Marshal(json.RawMessage(contact.Config))
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	query := `INSERT INTO notification_contacts (name, type, config, enabled, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		contact.Name, contact.Type, configJSON, contact.Enabled, contact.CreatedBy,
	).Scan(&contact.ID, &contact.CreatedAt, &contact.UpdatedAt)
}

func (r *NotificationContactRepository) Get(ctx context.Context, id uuid.UUID) (*model.NotificationContact, error) {
	query := `SELECT id, name, type, config, enabled, created_by, created_at, updated_at
		FROM notification_contacts WHERE id = $1`
	c := &model.NotificationContact{}
	var configJSON []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.Name, &c.Type, &configJSON, &c.Enabled, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	c.Config = configJSON
	return c, nil
}

func (r *NotificationContactRepository) Update(ctx context.Context, contact *model.NotificationContact) error {
	configJSON, err := json.Marshal(json.RawMessage(contact.Config))
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	query := `UPDATE notification_contacts SET name=$1, type=$2, config=$3, enabled=$4, updated_at=NOW()
		WHERE id=$5`
	_, err = r.pool.Exec(ctx, query,
		contact.Name, contact.Type, configJSON, contact.Enabled, contact.ID,
	)
	return err
}

func (r *NotificationContactRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM notification_contacts WHERE id = $1`, id)
	return err
}

func (r *NotificationContactRepository) List(ctx context.Context) ([]model.NotificationContact, error) {
	query := `SELECT id, name, type, config, enabled, created_by, created_at, updated_at
		FROM notification_contacts ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contacts []model.NotificationContact
	for rows.Next() {
		var c model.NotificationContact
		var configJSON []byte
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Type, &configJSON, &c.Enabled, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		c.Config = configJSON
		contacts = append(contacts, c)
	}
	return contacts, nil
}
