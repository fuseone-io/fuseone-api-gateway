package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

type PortalRepository struct {
	pool *pgxpool.Pool
}

func NewPortalRepository(pool *pgxpool.Pool) *PortalRepository {
	return &PortalRepository{pool: pool}
}

// Pool returns the underlying connection pool.
func (r *PortalRepository) Pool() *pgxpool.Pool {
	return r.pool
}

// ListVisibleAPIs returns portal-visible active APIs with pagination and search.
func (r *PortalRepository) ListVisibleAPIs(ctx context.Context, search, category string, page, pageSize int) ([]model.PortalApiSummary, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 12
	}
	offset := (page - 1) * pageSize

	baseWhere := `WHERE a.portal_visible = true AND a.lifecycle_status = 'active'`
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		baseWhere += fmt.Sprintf(` AND (a.name ILIKE $%d OR a.description ILIKE $%d)`, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if category != "" {
		baseWhere += fmt.Sprintf(` AND $%d = ANY(a.portal_categories)`, argIdx)
		args = append(args, category)
		argIdx++
	}

	// Count
	var total int
	countQuery := `SELECT COUNT(*) FROM api_definitions a ` + baseWhere
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting portal APIs: %w", err)
	}

	// List
	listQuery := `SELECT a.id, a.name, a.description, a.version, a.lifecycle_status,
		a.portal_categories, (a.openapi_spec != '') as has_openapi_spec, a.created_at
		FROM api_definitions a ` + baseWhere + `
		ORDER BY a.name ASC
		LIMIT $` + fmt.Sprintf("%d", argIdx) + ` OFFSET $` + fmt.Sprintf("%d", argIdx+1)
	args = append(args, pageSize, offset)

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing portal APIs: %w", err)
	}
	defer rows.Close()

	var apis []model.PortalApiSummary
	for rows.Next() {
		var a model.PortalApiSummary
		if err := rows.Scan(&a.ID, &a.Name, &a.Description, &a.Version,
			&a.LifecycleStatus, &a.Categories, &a.HasOpenAPISpec, &a.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scanning portal API: %w", err)
		}
		apis = append(apis, a)
	}

	return apis, total, nil
}

// GetVisibleAPI returns a single portal-visible API with its OpenAPI spec.
func (r *PortalRepository) GetVisibleAPI(ctx context.Context, id uuid.UUID) (*model.PortalApiDetail, error) {
	query := `SELECT a.id, a.name, a.description, a.version, a.lifecycle_status,
		a.portal_categories, (a.openapi_spec != '') as has_openapi_spec, a.created_at,
		a.openapi_spec
		FROM api_definitions a
		WHERE a.id = $1 AND a.portal_visible = true AND a.lifecycle_status = 'active'`

	var d model.PortalApiDetail
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&d.ID, &d.Name, &d.Description, &d.Version,
		&d.LifecycleStatus, &d.Categories, &d.HasOpenAPISpec, &d.CreatedAt,
		&d.OpenAPISpec,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting portal API: %w", err)
	}

	return &d, nil
}

// GetAPIOpenAPISpec returns just the OpenAPI spec for a visible API.
func (r *PortalRepository) GetAPIOpenAPISpec(ctx context.Context, id uuid.UUID) (string, error) {
	var spec string
	err := r.pool.QueryRow(ctx,
		`SELECT openapi_spec FROM api_definitions
		 WHERE id = $1 AND portal_visible = true AND lifecycle_status = 'active'`, id).Scan(&spec)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("getting API spec: %w", err)
	}
	return spec, nil
}

// RegisterDeveloper creates a new user with the developer role.
func (r *PortalRepository) RegisterDeveloper(ctx context.Context, u *model.User) error {
	query := `INSERT INTO users (username, email, display_name, password_hash, role_id, is_active)
		VALUES ($1, $2, $3, $4, $5, true) RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		u.Username, u.Email, u.DisplayName, u.PasswordHash, u.RoleID,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

// GetDeveloperProfile returns a developer profile with stats.
func (r *PortalRepository) GetDeveloperProfile(ctx context.Context, userID uuid.UUID) (*model.DeveloperProfile, error) {
	var p model.DeveloperProfile
	err := r.pool.QueryRow(ctx, `
		SELECT u.id, u.username, u.email, u.display_name, u.last_login_at, u.created_at,
			(SELECT COUNT(*) FROM subscriptions s WHERE s.requested_by = u.id AND s.status = 'active') as active_subs,
			(SELECT COUNT(*) FROM subscriptions s WHERE s.requested_by = u.id AND s.status = 'active') as total_keys
		FROM users u WHERE u.id = $1`, userID,
	).Scan(&p.ID, &p.Username, &p.Email, &p.DisplayName, &p.LastLoginAt, &p.CreatedAt,
		&p.ActiveSubscriptions, &p.TotalAPIKeys)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting developer profile: %w", err)
	}
	return &p, nil
}

// ListDeveloperSubscriptions returns subscriptions for a specific developer.
func (r *PortalRepository) ListDeveloperSubscriptions(ctx context.Context, userID uuid.UUID) ([]model.PortalSubscription, error) {
	query := `SELECT s.id, s.consumer_username, s.api_definition_id, s.plan_id,
		s.status, s.requested_by, s.approved_by, s.requested_at, s.approved_at,
		s.revoked_at, s.notes, s.created_at, s.updated_at,
		COALESCE(a.name, 'Unknown API') as api_name,
		COALESCE(s.plan_id, 'default') as plan_name
		FROM subscriptions s
		LEFT JOIN api_definitions a ON a.id = s.api_definition_id
		WHERE s.requested_by = $1
		ORDER BY s.created_at DESC`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("listing developer subscriptions: %w", err)
	}
	defer rows.Close()

	var result []model.PortalSubscription
	for rows.Next() {
		var ps model.PortalSubscription
		if err := rows.Scan(
			&ps.ID, &ps.ConsumerUsername, &ps.ApiDefinitionID, &ps.PlanID,
			&ps.Status, &ps.RequestedBy, &ps.ApprovedBy, &ps.RequestedAt, &ps.ApprovedAt,
			&ps.RevokedAt, &ps.Notes, &ps.CreatedAt, &ps.UpdatedAt,
			&ps.ApiName, &ps.PlanName,
		); err != nil {
			return nil, fmt.Errorf("scanning developer subscription: %w", err)
		}
		result = append(result, ps)
	}
	return result, nil
}

// UpdatePortalSettings updates the portal visibility, categories, and spec for an API.
func (r *PortalRepository) UpdatePortalSettings(ctx context.Context, apiID uuid.UUID, visible bool, categories []string, spec string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE api_definitions SET portal_visible = $2, portal_categories = $3, openapi_spec = $4, updated_at = NOW()
		 WHERE id = $1`,
		apiID, visible, categories, spec)
	if err != nil {
		return fmt.Errorf("updating portal settings: %w", err)
	}
	return nil
}

// GetPortalStats returns aggregate stats for the landing page.
func (r *PortalRepository) GetPortalStats(ctx context.Context) (apiCount int, developerCount int, err error) {
	err = r.pool.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*) FROM api_definitions WHERE portal_visible = true AND lifecycle_status = 'active'),
			(SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'developer' AND u.is_active = true)`,
	).Scan(&apiCount, &developerCount)
	return
}

// ListCategories returns all distinct categories across portal-visible APIs.
func (r *PortalRepository) ListCategories(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT DISTINCT unnest(portal_categories) as cat
		 FROM api_definitions
		 WHERE portal_visible = true AND lifecycle_status = 'active'
		 ORDER BY cat`)
	if err != nil {
		return nil, fmt.Errorf("listing categories: %w", err)
	}
	defer rows.Close()

	var cats []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return nil, fmt.Errorf("scanning category: %w", err)
		}
		cats = append(cats, c)
	}
	return cats, nil
}
