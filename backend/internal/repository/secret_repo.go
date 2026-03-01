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

type SecretRepository struct {
	pool *pgxpool.Pool
}

func NewSecretRepository(pool *pgxpool.Pool) *SecretRepository {
	return &SecretRepository{pool: pool}
}

// --- Local Secrets ---

func (r *SecretRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Secret, []byte, error) {
	var s model.Secret
	var tagsJSON []byte
	var encryptedValue []byte
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, description, encrypted_value, tags, created_by, created_at, updated_at
		 FROM secrets WHERE id = $1`, id,
	).Scan(&s.ID, &s.Name, &s.Description, &encryptedValue, &tagsJSON, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("getting secret by id: %w", err)
	}
	json.Unmarshal(tagsJSON, &s.Tags)
	return &s, encryptedValue, nil
}

func (r *SecretRepository) GetByName(ctx context.Context, name string) (*model.Secret, []byte, error) {
	var s model.Secret
	var tagsJSON []byte
	var encryptedValue []byte
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, description, encrypted_value, tags, created_by, created_at, updated_at
		 FROM secrets WHERE name = $1`, name,
	).Scan(&s.ID, &s.Name, &s.Description, &encryptedValue, &tagsJSON, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("getting secret by name: %w", err)
	}
	json.Unmarshal(tagsJSON, &s.Tags)
	return &s, encryptedValue, nil
}

func (r *SecretRepository) List(ctx context.Context, page, pageSize int) ([]model.Secret, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM secrets").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting secrets: %w", err)
	}

	rows, err := r.pool.Query(ctx,
		`SELECT id, name, description, tags, created_by, created_at, updated_at
		 FROM secrets ORDER BY created_at DESC LIMIT $1 OFFSET $2`, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("listing secrets: %w", err)
	}
	defer rows.Close()

	var secrets []model.Secret
	for rows.Next() {
		var s model.Secret
		var tagsJSON []byte
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &tagsJSON, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scanning secret: %w", err)
		}
		json.Unmarshal(tagsJSON, &s.Tags)
		secrets = append(secrets, s)
	}

	return secrets, total, nil
}

func (r *SecretRepository) Create(ctx context.Context, s *model.Secret, encryptedValue []byte) error {
	tagsJSON, _ := json.Marshal(s.Tags)
	return r.pool.QueryRow(ctx,
		`INSERT INTO secrets (name, description, encrypted_value, tags, created_by)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at`,
		s.Name, s.Description, encryptedValue, tagsJSON, s.CreatedBy,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *SecretRepository) Update(ctx context.Context, id uuid.UUID, description *string, encryptedValue []byte, tags *[]string) error {
	if description != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE secrets SET description = $2, updated_at = NOW() WHERE id = $1",
			id, *description); err != nil {
			return fmt.Errorf("updating secret description: %w", err)
		}
	}
	if encryptedValue != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE secrets SET encrypted_value = $2, updated_at = NOW() WHERE id = $1",
			id, encryptedValue); err != nil {
			return fmt.Errorf("updating secret value: %w", err)
		}
	}
	if tags != nil {
		tagsJSON, _ := json.Marshal(*tags)
		if _, err := r.pool.Exec(ctx,
			"UPDATE secrets SET tags = $2, updated_at = NOW() WHERE id = $1",
			id, tagsJSON); err != nil {
			return fmt.Errorf("updating secret tags: %w", err)
		}
	}
	return nil
}

func (r *SecretRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM secrets WHERE id = $1", id)
	return err
}

// --- Secret Managers ---

func (r *SecretRepository) GetManagerByID(ctx context.Context, id uuid.UUID) (*model.SecretManager, error) {
	var m model.SecretManager
	var configJSON []byte
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, type, config, is_active, created_by, created_at, updated_at
		 FROM secret_managers WHERE id = $1`, id,
	).Scan(&m.ID, &m.Name, &m.Type, &configJSON, &m.IsActive, &m.CreatedBy, &m.CreatedAt, &m.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting secret manager: %w", err)
	}
	json.Unmarshal(configJSON, &m.Config)
	return &m, nil
}

func (r *SecretRepository) ListManagers(ctx context.Context) ([]model.SecretManager, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, type, config, is_active, created_by, created_at, updated_at
		 FROM secret_managers ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("listing secret managers: %w", err)
	}
	defer rows.Close()

	var managers []model.SecretManager
	for rows.Next() {
		var m model.SecretManager
		var configJSON []byte
		if err := rows.Scan(&m.ID, &m.Name, &m.Type, &configJSON, &m.IsActive, &m.CreatedBy, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning secret manager: %w", err)
		}
		json.Unmarshal(configJSON, &m.Config)
		managers = append(managers, m)
	}
	return managers, nil
}

func (r *SecretRepository) CreateManager(ctx context.Context, m *model.SecretManager) error {
	configJSON, _ := json.Marshal(m.Config)
	return r.pool.QueryRow(ctx,
		`INSERT INTO secret_managers (name, type, config, is_active, created_by)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at`,
		m.Name, m.Type, configJSON, m.IsActive, m.CreatedBy,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
}

func (r *SecretRepository) UpdateManager(ctx context.Context, id uuid.UUID, req *model.UpdateSecretManagerRequest) error {
	if req.Name != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE secret_managers SET name = $2, updated_at = NOW() WHERE id = $1",
			id, *req.Name); err != nil {
			return err
		}
	}
	if req.Config != nil {
		configJSON, _ := json.Marshal(*req.Config)
		if _, err := r.pool.Exec(ctx,
			"UPDATE secret_managers SET config = $2, updated_at = NOW() WHERE id = $1",
			id, configJSON); err != nil {
			return err
		}
	}
	if req.IsActive != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE secret_managers SET is_active = $2, updated_at = NOW() WHERE id = $1",
			id, *req.IsActive); err != nil {
			return err
		}
	}
	return nil
}

func (r *SecretRepository) DeleteManager(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM secret_managers WHERE id = $1", id)
	return err
}
