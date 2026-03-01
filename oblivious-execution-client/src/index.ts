/**
 * Oblivious Execution Client
 *
 * A minimal browser execution client that provides verified eth_call by:
 * 1. Fetching EIP-1186 proofs from an oblivious_node proof server
 * 2. Verifying proofs locally against a trusted stateRoot
 * 3. Executing EVM bytecode locally using verified state
 *
 * @see https://github.com/obliviouslabs/oblivious_node
 */

// Provider (main entry point)
export { ObliviousProvider, MockHeaderProvider } from "./provider.js";
export type { ProviderEvent } from "./provider.js";

// Verified state backend
export { VerifiedStateBackend } from "./verified-state.js";

// EVM execution
export { executeCall } from "./evm.js";
export type { EVMResult } from "./evm.js";

// Proof verification
export {
  verifyProof,
  verifyAccountProof,
  verifyStorageProof,
  parseAccountRLP,
} from "./mpt.js";

// RPC client
export { jsonRpcCall, fetchProof, fetchCode, fallbackCall } from "./rpc-client.js";

// RLP codec
export { decode as rlpDecode, encode as rlpEncode } from "./rlp.js";

// Hex utilities
export {
  hexToBytes,
  bytesToHex,
  hexToBigInt,
  bigIntToHex,
  normalizeAddress,
  normalizeSlotKey,
} from "./hex.js";

// Types
export type {
  ExecutionClientConfig,
  TrustedHeader,
  TrustedHeaderProvider,
  EIP1193RequestArgs,
  CallParams,
  EthGetProofResponse,
  StorageProofEntry,
  VerifiedAccount,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./types.js";

export { EMPTY_CODE_HASH, EMPTY_TRIE_ROOT } from "./types.js";

// Kohaku extension integration — composable privacy overlay
export {
  ObliviousProofOverlay,
  wrapWithOblivious,
  isObliviousSupportedChain,
} from "./kohaku/ObliviousRpcProvider.js";
export type { ObliviousOverlayOptions } from "./kohaku/ObliviousRpcProvider.js";
