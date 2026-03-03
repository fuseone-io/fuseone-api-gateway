.PHONY: dev stop backend frontend portal infra build clean test-plugins sync-plugins

# Start infrastructure (APISIX + etcd + PostgreSQL)
infra:
	docker compose up -d

infra-kafka:
	docker compose --profile kafka up -d

infra-down:
	docker compose down

# Backend
backend:
	cd backend && air

backend-run:
	cd backend && go run ./cmd/gateway-api

backend-build:
	cd backend && go build -o gateway-api ./cmd/gateway-api

backend-test:
	cd backend && go test ./...

# Frontend (Admin Dashboard)
frontend:
	cd frontend && pnpm dev

frontend-build:
	cd frontend && pnpm build

# Developer Portal
portal:
	cd developer-portal && pnpm dev

portal-build:
	cd developer-portal && pnpm build

# Development: starts infra, waits for readiness, then runs backend + frontend
dev:
	@bash dev.sh

# Stop everything (backend + frontend + infra)
stop:
	@echo "Stopping backend..."
	@-pkill -f "gateway-api" 2>/dev/null || true
	@-pkill -f "air" 2>/dev/null || true
	@echo "Stopping frontend..."
	@-pkill -f "next-server" 2>/dev/null || true
	@-pkill -f "next dev" 2>/dev/null || true
	@echo "Stopping infrastructure..."
	@docker compose down
	@echo "All stopped."

# Custom Plugins
test-plugins:
	@echo "Running backend tests..."
	cd backend && go test ./internal/handler/ -run TestPlugin -v
	cd backend && go test ./internal/handler/ -run TestReload -v

# Sync custom plugins to Helm chart files directory
sync-plugins:
	@echo "Syncing custom plugins to Helm chart..."
	cp custom-plugins/apisix/plugins/*.lua charts/apisix/files/
	@echo "Done. Files synced to charts/apisix/files/"

# Hot-reload plugins in running APISIX (dev mode)
reload-plugins:
	curl -s -X PUT http://localhost:9180/apisix/admin/plugins/reload \
		-H "X-API-KEY: fuseone-gateway-admin-key" | jq .

# Clean
clean:
	rm -f backend/gateway-api
	rm -rf backend/tmp
	rm -rf frontend/.next
	rm -rf developer-portal/.next
