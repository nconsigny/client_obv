/**
 * JSON-RPC transport client for communicating with oblivious_node.
 *
 * Handles:
 *  - HTTP(S) JSON-RPC 2.0 POST requests
 *  - eth_getProof calls with proper parameter formatting
 *  - Request ID management
 *  - Error handling and typed responses
 */
import type { EthGetProofResponse } from "./types.js";
/**
 * Send a JSON-RPC 2.0 request.
 */
export declare function jsonRpcCall<T = unknown>(url: string, method: string, params: unknown[]): Promise<T>;
/**
 * Fetch an EIP-1186 proof from the oblivious_node server.
 *
 * Per spec section 4.2: uses explicit blockNumber (not "latest") to prevent
 * header/proof mismatch races.
 *
 * @param url - Proof server URL
 * @param address - 0x-prefixed Ethereum address
 * @param storageKeys - Array of 0x-prefixed 32-byte storage keys
 * @param blockNumber - Explicit block number to query
 */
export declare function fetchProof(url: string, address: string, storageKeys: string[], blockNumber: bigint): Promise<EthGetProofResponse>;
/**
 * Fetch code bytes from a fallback RPC via eth_getCode.
 *
 * @param url - RPC URL (can be the proof server if it supports eth_getCode, or a fallback)
 * @param address - 0x-prefixed address
 * @param blockNumber - Block number (hex-encoded for standard RPCs)
 */
export declare function fetchCode(url: string, address: string, blockNumber: bigint): Promise<string>;
/**
 * Pass-through any JSON-RPC method to a fallback provider.
 */
export declare function fallbackCall<T = unknown>(url: string, method: string, params: unknown[]): Promise<T>;
//# sourceMappingURL=rpc-client.d.ts.map