#!/bin/bash
# =============================================================================
# Install Altinity ClickHouse Operator
# This script installs the operator cluster-wide (run once per cluster)
# =============================================================================

set -euo pipefail

OPERATOR_VERSION="${1:-0.24.0}"
NAMESPACE="${2:-clickhouse-operator}"

echo "==> Installing Altinity ClickHouse Operator v${OPERATOR_VERSION}"
echo "    Namespace: ${NAMESPACE}"
echo ""

# Create namespace
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Install from official manifests
kubectl apply -f "https://raw.githubusercontent.com/Altinity/clickhouse-operator/${OPERATOR_VERSION}/deploy/operator/clickhouse-operator-install-bundle.yaml" \
  -n "${NAMESPACE}"

echo ""
echo "==> Waiting for operator to be ready..."
kubectl rollout status deployment/clickhouse-operator -n "${NAMESPACE}" --timeout=120s

echo ""
echo "==> ClickHouse Operator v${OPERATOR_VERSION} installed successfully!"
echo ""
echo "    CRDs installed:"
kubectl get crd | grep clickhouse || true
echo ""
echo "    You can now deploy ClickHouse clusters using:"
echo "      helm install fuseone charts/fuseone --set clickhouse.enabled=true"
