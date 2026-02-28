# FuseOne API Gateway

Modern dashboard for Apache APISIX management.

## Architecture

- **Backend**: Go (Gin + pgx/v5 + Viper) at `backend/`
- **Frontend**: Next.js 16 (App Router) + shadcn/ui (radix-nova) at `frontend/`
- **Database**: PostgreSQL 16 (users, roles, audit, settings only)
- **Gateway**: Apache APISIX 3.x (source of truth for API resources via etcd)

## Development

```bash
# Start infrastructure
make infra  # docker compose up (APISIX + etcd + PostgreSQL)

# Backend (separate terminal)
make backend  # uses air for hot reload

# Frontend (separate terminal)
make frontend  # pnpm dev
```

Environment: copy `.env.example` to `.env` and configure.

## Conventions

### Backend (Go)
- Entry point: `backend/cmd/gateway-api/main.go`
- Clean architecture: `handler/` → `service/` → `repository/`
- APISIX communication: `internal/service/apisix_client.go` (generic CRUD)
- All handlers use `handler.APISIXResourceHandler` for APISIX resources
- JWT auth middleware at `internal/middleware/auth.go`
- RBAC permissions: `{resource}:read` and `{resource}:write`
- Audit logging via `middleware.AuditLogger` (async, non-blocking)
- Migrations: embedded SQL in `migrations/` directory
- Config: Viper with YAML file + env var overrides

### Frontend (Next.js)
- shadcn/ui with **radix-nova** style (see `components.json`)
- Design tokens from FuseOne brand in `src/app/globals.css`
- Primary: `#0f5fb8` (blue), Secondary: `#950fb8` (purple)
- Sidebar always dark (`#0a1628`), content follows theme
- Icons: Lucide React
- API client: `src/lib/api-client.ts` with typed `request<T>()` wrapper
- APISIX types: `src/types/apisix.ts`
- Auth types: `src/types/auth.ts`
- Route groups: `(auth)` for login, `(dashboard)` for authenticated pages
- Use pnpm as package manager

### Adding new APISIX resource
1. Backend: Create a `NewAPISIXResourceHandler(apisixClient, auditLogger, "resource_name")` in main.go
2. Backend: Register with `registerResourceRoutes(api, "apisix/resource-name", handler, "permBase")`
3. Frontend: Create page at `src/app/(dashboard)/resource-name/page.tsx`
4. Frontend: Add navigation item in `src/components/app-sidebar.tsx`

### Adding shadcn components
```bash
cd frontend && pnpm dlx shadcn@latest add <component-name>
```
