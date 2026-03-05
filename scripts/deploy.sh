#!/bin/bash
# =============================================================================
# FuseOne API Gateway - Deployment Helper
# =============================================================================

set -euo pipefail

RELEASE_NAME="${1:-fuseone}"
NAMESPACE="${2:-fuseone}"
VALUES_FILE="${3:-}"
CHART_DIR="$(cd "$(dirname "$0")/.." && pwd)/charts/fuseone"

usage() {
  cat <<EOF
Usage: $0 [release-name] [namespace] [values-file]

Deployment modes:

  1. Full Platform (default):
     $0

  2. Gateway Only:
     $0 fuseone-gw fuseone-gw values-gateway-only.yaml

  3. Console Only (manage remote gateways):
     $0 fuseone-console fuseone-console values-console-only.yaml

  4. With ClickHouse Analytics:
     $0 fuseone fuseone values-with-clickhouse.yaml

Examples:
  $0                                    # Full platform in 'fuseone' namespace
  $0 fuseone production                 # Full platform in 'production' namespace
  $0 fuseone fuseone my-values.yaml     # Full platform with custom values
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

echo "==================================================================="
echo "  FuseOne API Gateway - Deploying"
echo "==================================================================="
echo "  Release:   ${RELEASE_NAME}"
echo "  Namespace: ${NAMESPACE}"
echo "  Chart:     ${CHART_DIR}"
echo "==================================================================="

# Create namespace
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Update chart dependencies
echo ""
echo "==> Updating chart dependencies..."
helm dependency update "${CHART_DIR}"

# Build helm command
HELM_CMD="helm upgrade --install ${RELEASE_NAME} ${CHART_DIR} \
  --namespace ${NAMESPACE} \
  --create-namespace \
  --wait \
  --timeout 10m"

if [[ -n "${VALUES_FILE}" ]]; then
  HELM_CMD="${HELM_CMD} -f ${VALUES_FILE}"
fi

# Deploy
echo ""
echo "==> Deploying..."
eval "${HELM_CMD}"

echo ""
echo "==> Deployment complete!"
echo ""
kubectl get pods -n "${NAMESPACE}" -l "app.kubernetes.io/instance=${RELEASE_NAME}"
