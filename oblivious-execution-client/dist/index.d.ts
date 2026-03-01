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
export { ObliviousProvider, MockHeaderProvider } from "./provider.js";
export type { ProviderEvent } from "./provider.js";
export { VerifiedStateBackend } from "./verified-state.js";
export { executeCall } from "./evm.js";
export type { EVMResult } from "./evm.js";
export { verifyProof, verifyAccountProof, verifyStorageProof, parseAccountRLP, } from "./mpt.js";
export { jsonRpcCall, fetchProof, fetchCode, fallbackCall } from "./rpc-client.js";
export { decode as rlpDecode, encode as rlpEncode } from "./rlp.js";
export { hexToBytes, bytesToHex, hexToBigInt, bigIntToHex, normalizeAddress, normalizeSlotKey, } from "./hex.js";
export type { ExecutionClientConfig, TrustedHeader, TrustedHeaderProvider, EIP1193RequestArgs, CallParams, EthGetProofResponse, StorageProofEntry, VerifiedAccount, JsonRpcRequest, JsonRpcResponse, } from "./types.js";
export { EMPTY_CODE_HASH, EMPTY_TRIE_ROOT } from "./types.js";
export { ObliviousProofOverlay, wrapWithOblivious, isObliviousSupportedChain, } from "./kohaku/ObliviousRpcProvider.js";
export type { ObliviousOverlayOptions } from "./kohaku/ObliviousRpcProvider.js";
//# sourceMappingURL=index.d.ts.map