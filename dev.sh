#!/usr/bin/env bash
set -e

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "Shutting down..."
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    wait 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

# 1. Start infrastructure
echo "==> Starting infrastructure (PostgreSQL + APISIX + etcd)..."
docker compose up -d

# 2. Wait for PostgreSQL
echo "==> Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U gateway -d fuseone_gateway >/dev/null 2>&1; do
    sleep 1
done
echo "    PostgreSQL is ready."

# 3. Wait for APISIX (check port is open, then verify admin API)
echo "==> Waiting for APISIX..."
RETRIES=0
until curl -so /dev/null -w '%{http_code}' http://localhost:9180/apisix/admin/routes -H "X-API-KEY: fuseone-gateway-admin-key" 2>/dev/null | grep -q "200"; do
    RETRIES=$((RETRIES + 1))
    if [ "$RETRIES" -gt 60 ]; then
        echo "    APISIX failed to start after 60s. Check: docker compose logs apisix"
        exit 1
    fi
    sleep 1
done
echo "    APISIX is ready."

# 4. Start backend
echo "==> Starting backend (Go) on :8080..."
cd backend
if command -v air >/dev/null 2>&1; then
    air &
else
    go run ./cmd/gateway-api &
fi
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
until curl -sf http://localhost:8080/health/live >/dev/null 2>&1; do
    sleep 1
done
echo "    Backend is ready."

# 5. Start frontend
echo "==> Starting frontend (Next.js) on :3000..."
cd frontend
pnpm dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "============================================"
echo "  FuseOne API Gateway - Dev Environment"
echo "============================================"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8080"
echo "  APISIX:    http://localhost:9180"
echo "  Login:     admin / changeme"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "============================================"

wait
