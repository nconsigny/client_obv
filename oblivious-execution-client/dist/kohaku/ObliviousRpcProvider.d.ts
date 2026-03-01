/**
 * ObliviousProofOverlay — Composable privacy layer for Kohaku wallet providers.
 *
 * DESIGN PRINCIPLE (per spec §2.1):
 *   Helios/Colibri provide INTEGRITY (trusted stateRoot via consensus verification).
 *   oblivious_node provides PRIVACY (server can't learn what you're querying).
 *   Local EVM provides VERIFIED EXECUTION (correct results without trusting anyone).
 *
 * These are NOT alternatives — they're layers in the same stack:
 *
 *   ┌───────────────────────────────────────────────────────┐
 *   │  dApp / ethers                                        │
 *   │    ↓ eth_call, eth_getBalance, ...                    │
 *   ├───────────────────────────────────────────────────────┤
 *   │  ObliviousProofOverlay                                │
 *   │    • Gets trusted header from inner provider          │
 *   │    • Fetches proofs from oblivious_node (PRIVATE)     │
 *   │    • Verifies proofs against trusted stateRoot        │
 *   │    • Executes EVM locally on verified state           │
 *   ├───────────────────────────────────────────────────────┤
 *   │  Inner provider (Helios | Colibri | JsonRpc)          │
 *   │    • Provides trusted headers (INTEGRITY)             │
 *   │    • Serves eth_getCode (code bytes)                  │
 *   │    • Handles all non-verifiable methods                │
 *   └───────────────────────────────────────────────────────┘
 *
 * Integration:
 *   The overlay wraps an EXISTING provider. It does not replace Helios/Colibri.
 *   In getRpcProvider.ts, after creating the inner provider, wrap it:
 *
 *     let provider = createInnerProvider(config)  // helios, colibri, or rpc
 *     if (config.obliviousProofServerUrl) {
 *       provider = wrapWithOblivious(provider, config)
 *     }
 *
 * This file is designed to live at:
 *   kohaku-commons/src/services/provider/ObliviousProofOverlay.ts
 */
import { JsonRpcProvider } from "ethers";
export interface ObliviousOverlayOptions {
    /**
     * URL of the oblivious_node proof server.
     * This is the ONLY server that receives eth_getProof queries —
     * the privacy-sensitive part of the pipeline.
     */
    proofServerUrl: string;
    /**
     * Failure policy.
     * "fail-closed" (default): abort on proof/verification failure.
     * "fallback": fall through to inner provider on failure (loses privacy).
     */
    failurePolicy?: "fail-closed" | "fallback";
}
/**
 * ObliviousProofOverlay — wraps any ethers JsonRpcProvider to add
 * privacy-preserving proof fetching from oblivious_node.
 *
 * The inner provider (Helios, Colibri, or plain RPC) is used for:
 *  - Trusted block headers (stateRoot from consensus light client)
 *  - Code bytes (eth_getCode, verified via codeHash from proof)
 *  - All non-state-read methods (eth_sendTransaction, eth_subscribe, etc.)
 *
 * oblivious_node is used ONLY for:
 *  - eth_getProof (the privacy-sensitive query)
 *
 * Local execution handles:
 *  - eth_call (EVM runs locally on proof-verified state)
 *  - eth_getBalance, eth_getTransactionCount, eth_getStorageAt
 *    (derived from verified account/storage proofs)
 */
export declare class ObliviousProofOverlay extends JsonRpcProvider {
    #private;
    /**
     * @param inner - The existing provider (Helios, Colibri, or JsonRpcProvider).
     *                Used for trusted headers, code bytes, and non-verifiable methods.
     * @param chainId - Chain ID for EVM environment construction.
     * @param options - Oblivious overlay configuration.
     */
    constructor(inner: JsonRpcProvider, chainId: bigint | number, options: ObliviousOverlayOptions);
    /**
     * Override send() — the single chokepoint for all RPC traffic in ethers.
     *
     * Privacy-sensitive reads → oblivious_node (proofs) + local execution.
     * Everything else → inner provider (Helios/Colibri/RPC).
     */
    send(method: string, params?: Array<any> | Record<string, any>): Promise<any>;
    /**
     * Override destroy() to also clean up the inner provider.
     */
    destroy(): void;
}
/**
 * Wrap an existing provider with the oblivious proof overlay.
 *
 * This is the primary integration function for getRpcProvider.ts:
 *
 *   let provider = createProvider(config)   // helios, colibri, or rpc
 *   if (config.obliviousProofServerUrl) {
 *     provider = wrapWithOblivious(provider, config.chainId, {
 *       proofServerUrl: config.obliviousProofServerUrl,
 *     })
 *   }
 */
export declare function wrapWithOblivious(inner: JsonRpcProvider, chainId: bigint | number, options: ObliviousOverlayOptions): ObliviousProofOverlay;
/**
 * Chains supported by oblivious_node.
 */
export declare function isObliviousSupportedChain(chainId?: bigint | number): boolean;
//# sourceMappingURL=ObliviousRpcProvider.d.ts.map