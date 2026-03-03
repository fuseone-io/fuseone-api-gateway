package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

type OAuthProviderRepository struct {
	pool *pgxpool.Pool
}

func NewOAuthProviderRepository(pool *pgxpool.Pool) *OAuthProviderRepository {
	return &OAuthProviderRepository{pool: pool}
}

const oauthProviderColumns = `id, provider, display_name, client_id, client_secret, scopes,
	extra_config, auto_create_users, default_role_id, is_enabled, created_at, updated_at`

func scanOAuthProvider(row pgx.Row) (*model.OAuthProvider, error) {
	var p model.OAuthProvider
	err := row.Scan(
		&p.ID, &p.Provider, &p.DisplayName, &p.ClientID, &p.ClientSecret, &p.Scopes,
		&p.ExtraConfig, &p.AutoCreateUsers, &p.DefaultRoleID, &p.IsEnabled, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.HasSecret = p.ClientSecret != ""
	return &p, nil
}

func (r *OAuthProviderRepository) List(ctx context.Context) ([]model.OAuthProvider, error) {
	query := fmt.Sprintf(`SELECT %s FROM oauth_providers ORDER BY provider`, oauthProviderColumns)
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("listing oauth providers: %w", err)
	}
	defer rows.Close()

	var providers []model.OAuthProvider
	for rows.Next() {
		p, err := scanOAuthProvider(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning oauth provider: %w", err)
		}
		p.ClientSecret = "" // never expose
		providers = append(providers, *p)
	}
	return providers, nil
}

func (r *OAuthProviderRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.OAuthProvider, error) {
	query := fmt.Sprintf(`SELECT %s FROM oauth_providers WHERE id = $1`, oauthProviderColumns)
	p, err := scanOAuthProvider(r.pool.QueryRow(ctx, query, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting oauth provider by id: %w", err)
	}
	return p, nil
}

func (r *OAuthProviderRepository) GetByProvider(ctx context.Context, provider string) (*model.OAuthProvider, error) {
	query := fmt.Sprintf(`SELECT %s FROM oauth_providers WHERE provider = $1`, oauthProviderColumns)
	p, err := scanOAuthProvider(r.pool.QueryRow(ctx, query, provider))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting oauth provider by slug: %w", err)
	}
	return p, nil
}

func (r *OAuthProviderRepository) GetEnabled(ctx context.Context) ([]model.PublicOAuthProvider, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT provider, display_name FROM oauth_providers WHERE is_enabled = true ORDER BY provider`)
	if err != nil {
		return nil, fmt.Errorf("listing enabled oauth providers: %w", err)
	}
	defer rows.Close()

	var providers []model.PublicOAuthProvider
	for rows.Next() {
		var p model.PublicOAuthProvider
		if err := rows.Scan(&p.Provider, &p.DisplayName); err != nil {
			return nil, fmt.Errorf("scanning enabled oauth provider: %w", err)
		}
		providers = append(providers, p)
	}
	return providers, nil
}

func (r *OAuthProviderRepository) Create(ctx context.Context, p *model.OAuthProvider) error {
	query := `INSERT INTO oauth_providers (provider, display_name, client_id, client_secret, scopes,
		extra_config, auto_create_users, default_role_id, is_enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		p.Provider, p.DisplayName, p.ClientID, p.ClientSecret, p.Scopes,
		p.ExtraConfig, p.AutoCreateUsers, p.DefaultRoleID, p.IsEnabled,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *OAuthProviderRepository) Update(ctx context.Context, p *model.OAuthProvider) error {
	query := `UPDATE oauth_providers SET
		display_name = $2,
		client_id = $3,
		client_secret = CASE WHEN $4 = '' THEN client_secret ELSE $4 END,
		scopes = $5,
		extra_config = $6,
		auto_create_users = $7,
		default_role_id = $8,
		is_enabled = $9,
		updated_at = NOW()
		WHERE id = $1`
	_, err := r.pool.Exec(ctx, query,
		p.ID, p.DisplayName, p.ClientID, p.ClientSecret, p.Scopes,
		p.ExtraConfig, p.AutoCreateUsers, p.DefaultRoleID, p.IsEnabled,
	)
	return err
}

func (r *OAuthProviderRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM oauth_providers WHERE id = $1", id)
	return err
}

func (r *OAuthProviderRepository) GetUserLink(ctx context.Context, provider, providerUID string) (*model.UserOAuthLink, error) {
	var link model.UserOAuthLink
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, provider, provider_uid, email, created_at
		FROM user_oauth_links WHERE provider = $1 AND provider_uid = $2`,
		provider, providerUID,
	).Scan(&link.ID, &link.UserID, &link.Provider, &link.ProviderUID, &link.Email, &link.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting user oauth link: %w", err)
	}
	return &link, nil
}

func (r *OAuthProviderRepository) CreateUserLink(ctx context.Context, link *model.UserOAuthLink) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO user_oauth_links (user_id, provider, provider_uid, email)
		VALUES ($1, $2, $3, $4)`,
		link.UserID, link.Provider, link.ProviderUID, link.Email,
	)
	return err
}
