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

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

const userSelectColumns = `u.id, u.username, u.email, u.display_name, u.password_hash,
	u.role_id, r.name as role_name, u.is_active, u.avatar_url,
	u.totp_secret, u.totp_enabled, u.last_login_at, u.created_at, u.updated_at`

func scanUser(row pgx.Row) (*model.User, error) {
	var u model.User
	err := row.Scan(
		&u.ID, &u.Username, &u.Email, &u.DisplayName, &u.PasswordHash,
		&u.RoleID, &u.RoleName, &u.IsActive, &u.AvatarURL,
		&u.TOTPSecret, &u.TOTPEnabled, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := fmt.Sprintf(`SELECT %s FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, userSelectColumns)
	user, err := scanUser(r.pool.QueryRow(ctx, query, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting user by id: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	query := fmt.Sprintf(`SELECT %s FROM users u JOIN roles r ON r.id = u.role_id WHERE u.username = $1`, userSelectColumns)
	user, err := scanUser(r.pool.QueryRow(ctx, query, username))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting user by username: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	query := fmt.Sprintf(`SELECT %s FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = $1`, userSelectColumns)
	user, err := scanUser(r.pool.QueryRow(ctx, query, email))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting user by email: %w", err)
	}
	return user, nil
}

func (r *UserRepository) List(ctx context.Context, page, pageSize int) ([]model.User, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting users: %w", err)
	}

	query := fmt.Sprintf(`SELECT %s FROM users u JOIN roles r ON r.id = u.role_id
		ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, userSelectColumns)
	rows, err := r.pool.Query(ctx, query, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("listing users: %w", err)
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning user: %w", err)
		}
		users = append(users, *u)
	}

	return users, total, nil
}

func (r *UserRepository) Create(ctx context.Context, u *model.User) error {
	query := `INSERT INTO users (username, email, display_name, password_hash, role_id, is_active)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		u.Username, u.Email, u.DisplayName, u.PasswordHash, u.RoleID, u.IsActive,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

func (r *UserRepository) Update(ctx context.Context, u *model.User) error {
	query := `UPDATE users SET username = $2, email = $3, display_name = $4,
		role_id = $5, is_active = $6, avatar_url = $7, updated_at = NOW()
		WHERE id = $1`
	_, err := r.pool.Exec(ctx, query,
		u.ID, u.Username, u.Email, u.DisplayName, u.RoleID, u.IsActive, u.AvatarURL,
	)
	return err
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error {
	_, err := r.pool.Exec(ctx, "UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1", id, hash)
	return err
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "UPDATE users SET last_login_at = NOW() WHERE id = $1", id)
	return err
}

func (r *UserRepository) UpdateTOTP(ctx context.Context, id uuid.UUID, secret string, enabled bool) error {
	_, err := r.pool.Exec(ctx, "UPDATE users SET totp_secret = $2, totp_enabled = $3, updated_at = NOW() WHERE id = $1",
		id, secret, enabled)
	return err
}

func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	return err
}

func (r *UserRepository) ListWithSearch(ctx context.Context, search string, page, pageSize int) ([]model.User, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int
	var args []interface{}
	countQuery := "SELECT COUNT(*) FROM users"
	listQuery := fmt.Sprintf(`SELECT %s FROM users u JOIN roles r ON r.id = u.role_id`, userSelectColumns)

	if search != "" {
		filter := " WHERE (u.username ILIKE $1 OR u.email ILIKE $1 OR u.display_name ILIKE $1)"
		pattern := "%" + search + "%"
		args = append(args, pattern)
		countQuery = "SELECT COUNT(*) FROM users u" + filter
		listQuery += filter
		listQuery += " ORDER BY u.created_at DESC LIMIT $2 OFFSET $3"
		args = append(args, pageSize, offset)
	} else {
		listQuery += " ORDER BY u.created_at DESC LIMIT $1 OFFSET $2"
		args = append(args, pageSize, offset)
	}

	if search != "" {
		err := r.pool.QueryRow(ctx, countQuery, "%"+search+"%").Scan(&total)
		if err != nil {
			return nil, 0, fmt.Errorf("counting users: %w", err)
		}
	} else {
		err := r.pool.QueryRow(ctx, countQuery).Scan(&total)
		if err != nil {
			return nil, 0, fmt.Errorf("counting users: %w", err)
		}
	}

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing users: %w", err)
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning user: %w", err)
		}
		users = append(users, *u)
	}

	return users, total, nil
}

// Roles

func (r *UserRepository) GetRoleByID(ctx context.Context, id uuid.UUID) (*model.Role, error) {
	var role model.Role
	var permJSON []byte
	err := r.pool.QueryRow(ctx,
		"SELECT id, name, description, permissions, is_system, created_at, updated_at FROM roles WHERE id = $1", id,
	).Scan(&role.ID, &role.Name, &role.Description, &permJSON, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting role: %w", err)
	}
	json.Unmarshal(permJSON, &role.Permissions)
	return &role, nil
}

func (r *UserRepository) GetRoleByName(ctx context.Context, name string) (*model.Role, error) {
	var role model.Role
	var permJSON []byte
	err := r.pool.QueryRow(ctx,
		"SELECT id, name, description, permissions, is_system, created_at, updated_at FROM roles WHERE name = $1", name,
	).Scan(&role.ID, &role.Name, &role.Description, &permJSON, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting role by name: %w", err)
	}
	json.Unmarshal(permJSON, &role.Permissions)
	return &role, nil
}

func (r *UserRepository) ListRoles(ctx context.Context) ([]model.Role, error) {
	rows, err := r.pool.Query(ctx,
		"SELECT id, name, description, permissions, is_system, created_at, updated_at FROM roles ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("listing roles: %w", err)
	}
	defer rows.Close()

	var roles []model.Role
	for rows.Next() {
		var role model.Role
		var permJSON []byte
		if err := rows.Scan(&role.ID, &role.Name, &role.Description, &permJSON, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning role: %w", err)
		}
		json.Unmarshal(permJSON, &role.Permissions)
		roles = append(roles, role)
	}
	return roles, nil
}

func (r *UserRepository) CreateRole(ctx context.Context, role *model.Role) error {
	permJSON, err := json.Marshal(role.Permissions)
	if err != nil {
		return fmt.Errorf("marshaling permissions: %w", err)
	}
	query := `INSERT INTO roles (name, description, permissions)
		VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query, role.Name, role.Description, permJSON).
		Scan(&role.ID, &role.CreatedAt, &role.UpdatedAt)
}

func (r *UserRepository) UpdateRole(ctx context.Context, role *model.Role) error {
	permJSON, err := json.Marshal(role.Permissions)
	if err != nil {
		return fmt.Errorf("marshaling permissions: %w", err)
	}
	_, err = r.pool.Exec(ctx,
		`UPDATE roles SET name = $2, description = $3, permissions = $4, updated_at = NOW() WHERE id = $1`,
		role.ID, role.Name, role.Description, permJSON)
	return err
}

func (r *UserRepository) DeleteRole(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM roles WHERE id = $1", id)
	return err
}

func (r *UserRepository) CountUsersWithRole(ctx context.Context, roleID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE role_id = $1", roleID).Scan(&count)
	return count, err
}

// Refresh Tokens

func (r *UserRepository) CreateRefreshToken(ctx context.Context, rt *model.RefreshToken) error {
	_, err := r.pool.Exec(ctx,
		"INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
		rt.ID, rt.UserID, rt.TokenHash, rt.ExpiresAt,
	)
	return err
}

func (r *UserRepository) GetRefreshToken(ctx context.Context, tokenHash string) (*model.RefreshToken, error) {
	var rt model.RefreshToken
	err := r.pool.QueryRow(ctx,
		"SELECT id, user_id, token_hash, expires_at, created_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL",
		tokenHash,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.CreatedAt, &rt.RevokedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting refresh token: %w", err)
	}
	return &rt, nil
}

func (r *UserRepository) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	_, err := r.pool.Exec(ctx, "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1", tokenHash)
	return err
}

func (r *UserRepository) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", userID)
	return err
}
