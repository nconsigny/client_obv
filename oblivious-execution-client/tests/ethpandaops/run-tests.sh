#!/usr/bin/env bash
# Run ethpandaops integration tests for the oblivious execution client.
#
# Modes:
#   ./run-tests.sh local     Run with docker-compose (geth devnet, no CL)
#   ./run-tests.sh kurtosis  Run with Kurtosis (full CL+EL testnet)
#
# Requirements:
#   local:    docker, docker-compose
#   kurtosis: docker, kurtosis CLI (https://docs.kurtosis.com/install/)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-local}"

case "$MODE" in
  local)
    echo "=== Running local docker-compose tests ==="
    cd "$SCRIPT_DIR"
    docker compose up --build --abort-on-container-exit --exit-code-from test-runner
    docker compose down
    ;;

  kurtosis)
    echo "=== Running Kurtosis ethereum-package tests ==="
    ENCLAVE="oblivious-test-$(date +%s)"

    echo "Creating enclave: $ENCLAVE"
    kurtosis run --enclave "$ENCLAVE" \
      github.com/ethpandaops/ethereum-package \
      --args-file "$SCRIPT_DIR/network_params.yaml"

    echo ""
    echo "Enclave $ENCLAVE is running."
    echo "Assertoor UI: check 'kurtosis service inspect $ENCLAVE assertoor'"
    echo "Dora explorer: check 'kurtosis service inspect $ENCLAVE dora'"
    echo ""
    echo "To tear down: kurtosis enclave rm -f $ENCLAVE"
    ;;

  *)
    echo "Usage: $0 {local|kurtosis}"
    exit 1
    ;;
esac
