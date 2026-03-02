# ethpandaops Integration Tests

Integration tests for the oblivious execution client using [ethpandaops](https://github.com/ethpandaops) tooling.

## Tools Used

| Tool | Purpose |
|------|---------|
| [ethereum-package](https://github.com/ethpandaops/ethereum-package) | Spin up a local Ethereum testnet via Kurtosis |
| [assertoor](https://github.com/ethpandaops/assertoor) | Orchestrate and run test scenarios |
| [spamoor](https://github.com/ethpandaops/spamoor) | Generate on-chain state (contracts, txs) |

## Test Scenarios

### `assertoor-proof-verification.yaml`
Cross-client `eth_call` verification. Deploys a test contract, then compares results between:
- **Reference geth node** (standard execution)
- **Oblivious execution client** (proof-verified local execution)

Tests: `eth_getBalance`, `eth_getTransactionCount`, `eth_getCode`, `eth_getProof`, `eth_call`

### `assertoor-proof-health.yaml`
Health and error handling. Verifies:
- JSON-RPC basic methods (`eth_chainId`, `eth_blockNumber`)
- Edge cases (non-existent accounts, empty storage, EOA code)
- Error codes for unsupported methods

## Running

### Local (docker-compose)
```bash
# Requires: docker, docker-compose
./run-tests.sh local
```

Uses geth in `--dev` mode as both the proof source and reference node. No consensus layer needed.

### Kurtosis (full testnet)
```bash
# Requires: docker, kurtosis CLI
./run-tests.sh kurtosis
```

Spins up geth + lighthouse with assertoor and spamoor. The assertoor web UI shows test progress in real-time.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Kurtosis Enclave / docker-compose               │
│                                                  │
│  ┌──────┐     ┌───────────┐                      │
│  │ geth │────→│ lighthouse│  (Kurtosis only)     │
│  │ (EL) │     │   (CL)    │                      │
│  └──┬───┘     └───────────┘                      │
│     │                                            │
│     │  eth_getProof / eth_getBlockByNumber        │
│     │  eth_getCode                               │
│     ▼                                            │
│  ┌─────────────────────────────────┐             │
│  │ oblivious-execution-client      │             │
│  │  - fetches proofs from geth     │             │
│  │  - verifies against stateRoot   │             │
│  │  - executes EVM locally         │             │
│  │  - serves JSON-RPC on :8547     │             │
│  └─────────────────────────────────┘             │
│     ▲                                            │
│     │                                            │
│  ┌─────────┐     ┌─────────┐                     │
│  │assertoor│     │ spamoor │                     │
│  │ (tests) │     │ (state) │                     │
│  └─────────┘     └─────────┘                     │
└──────────────────────────────────────────────────┘
```
