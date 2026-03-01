/**
 * Local EVM execution engine.
 *
 * This module provides a minimal EVM interpreter for executing eth_call locally
 * using verified state from the VerifiedStateBackend.
 *
 * Architecture:
 *  - Phase 1 uses a portable TypeScript EVM that supports the most critical opcodes
 *    needed for typical eth_call (view functions, balanceOf, etc.)
 *  - The design is pluggable: when revm-wasm becomes available, the EVMEngine
 *    interface can be swapped without changing the provider layer.
 *
 * All state reads (SLOAD, BALANCE, EXTCODESIZE, etc.) go through the
 * VerifiedStateBackend, ensuring every value is backed by a verified proof.
 */
import type { VerifiedStateBackend } from "./verified-state.js";
import type { TrustedHeader, CallParams } from "./types.js";
/** Result of EVM execution. */
export interface EVMResult {
    success: boolean;
    returnData: Uint8Array;
    gasUsed: bigint;
    error?: string;
}
/**
 * Execute an eth_call locally using verified state.
 *
 * Implements spec section 8.1 execution flow.
 */
export declare function executeCall(params: CallParams, header: TrustedHeader, state: VerifiedStateBackend): Promise<EVMResult>;
//# sourceMappingURL=evm.d.ts.map