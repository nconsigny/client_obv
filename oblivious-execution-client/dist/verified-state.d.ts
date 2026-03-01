/**
 * Verified State Backend.
 *
 * Implements spec sections 7.2, 8, and 9:
 *  - Fetches account/storage proofs from oblivious_node via eth_getProof
 *  - Verifies proofs locally against a trusted stateRoot
 *  - Caches verified results keyed by (stateRoot, address) / (stateRoot, address, slot)
 *  - Verifies code bytes against codeHash from verified account proof
 *  - Supports SLOAD batching within a microtask (spec section 9.2)
 */
import type { VerifiedAccount } from "./types.js";
export declare class VerifiedStateBackend {
    private stateRoot;
    private blockNumber;
    private proofServerUrl;
    private codeSourceUrl;
    private accountCache;
    private storageCache;
    private codeCache;
    private pendingSlots;
    private batchTimerSet;
    constructor(stateRoot: Uint8Array, blockNumber: bigint, proofServerUrl: string, codeSourceUrl: string);
    /**
     * Get verified account data (spec: get_account_basic).
     * On cache miss: fetches eth_getProof(address, [], blockNumber) and verifies.
     */
    getAccountBasic(address: string): Promise<VerifiedAccount>;
    /**
     * Get verified storage value (spec: get_storage).
     * On miss: fetches eth_getProof(address, [slotKey], blockNumber) and verifies.
     * Uses microtask batching for multiple slots on the same address.
     */
    getStorage(address: string, slotKey: string): Promise<bigint>;
    /**
     * Get verified code bytes (spec: get_code).
     * Ensures account is verified first (to know codeHash), then fetches and verifies code.
     */
    getCode(address: string): Promise<Uint8Array>;
    /** Flush all pending SLOAD requests for an address into one eth_getProof call. */
    private flushPendingSlots;
    /** Verify an eth_getProof response and cache the account. */
    private verifyAndCacheAccount;
    /** Clear all caches. */
    clear(): void;
    /** Get cache statistics for debugging. */
    stats(): {
        accounts: number;
        storageSlots: number;
        codeEntries: number;
    };
}
//# sourceMappingURL=verified-state.d.ts.map