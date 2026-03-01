/**
 * EIP-1193 / ethers-compatible provider.
 *
 * Implements spec section 3: the external interface that dApps interact with.
 * Supports verified eth_call, getBalance, getStorageAt, getTransactionCount, getCode,
 * and eth_getProof via local proof verification.
 *
 * All state reads are backed by proofs verified against a trusted stateRoot.
 */
import type { ExecutionClientConfig, TrustedHeader, TrustedHeaderProvider, EIP1193RequestArgs } from "./types.js";
/**
 * Event types emitted by the provider.
 */
export type ProviderEvent = "connect" | "disconnect" | "chainChanged" | "stateVerified" | "proofFetched";
/**
 * ObliviousProvider — the main entry point for dApps.
 *
 * Usage:
 *   const provider = new ObliviousProvider({ proofServerUrl: "http://127.0.0.1:8545", ... });
 *   const balance = await provider.request({ method: "eth_getBalance", params: ["0x...", "latest"] });
 */
export declare class ObliviousProvider {
    private config;
    private headerProvider;
    private listeners;
    constructor(config: ExecutionClientConfig);
    /**
     * EIP-1193 request handler.
     */
    request(args: EIP1193RequestArgs): Promise<unknown>;
    /** Subscribe to provider events. */
    on(event: ProviderEvent, listener: (...args: any[]) => void): void;
    /** Unsubscribe from provider events. */
    off(event: ProviderEvent, listener: (...args: any[]) => void): void;
    private emit;
    /**
     * Verified eth_call (spec section 8).
     * 1. Resolve block → trusted header
     * 2. Create VerifiedStateBackend
     * 3. Execute locally
     * 4. Return result
     */
    private ethCall;
    /**
     * eth_getBalance via verified eth_getProof.
     */
    private ethGetBalance;
    /**
     * eth_getTransactionCount via verified eth_getProof.
     */
    private ethGetTransactionCount;
    /**
     * eth_getStorageAt via verified eth_getProof.
     */
    private ethGetStorageAt;
    /**
     * eth_getCode — fetch code bytes and verify against proven codeHash.
     */
    private ethGetCode;
    /**
     * eth_getProof — forward to oblivious server AND verify locally.
     */
    private ethGetProof;
    /** Handle unsupported methods — fallback or error. */
    private handleUnsupported;
}
/**
 * Mock header provider for testing / demo without a real chain.
 */
export declare class MockHeaderProvider implements TrustedHeaderProvider {
    private header;
    constructor(header: TrustedHeader);
    getHeader(_blockTag: string | bigint): Promise<TrustedHeader>;
    setHeader(header: TrustedHeader): void;
}
//# sourceMappingURL=provider.d.ts.map