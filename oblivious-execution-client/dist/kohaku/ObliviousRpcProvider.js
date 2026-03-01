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
import { JsonRpcProvider, Network } from "ethers";
import { VerifiedStateBackend } from "../verified-state.js";
import { executeCall } from "../evm.js";
import { hexToBytes, bytesToHex, bigIntToHex } from "../hex.js";
import { fetchProof } from "../rpc-client.js";
import { verifyAccountProof, verifyStorageProof } from "../mpt.js";
import { EMPTY_CODE_HASH } from "../types.js";
/**
 * Methods where we replace the proof source with oblivious_node
 * while keeping the inner provider for headers, code, and everything else.
 */
const PRIVACY_ROUTED_METHODS = new Set([
    "eth_call",
    "eth_getBalance",
    "eth_getTransactionCount",
    "eth_getStorageAt",
    "eth_getCode",
    "eth_getProof",
]);
/** Should this specific call bypass the oblivious layer? */
function shouldBypass(method, params) {
    // eth_call with state overrides (3rd param) needs the inner provider's
    // Deployless support — can't run these locally.
    if (method === "eth_call") {
        if (Array.isArray(params) && params.length >= 3 && params[2] && typeof params[2] === "object") {
            return true;
        }
    }
    return false;
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
export class ObliviousProofOverlay extends JsonRpcProvider {
    #inner;
    #proofServerUrl;
    #failurePolicy;
    #chainId;
    /**
     * @param inner - The existing provider (Helios, Colibri, or JsonRpcProvider).
     *                Used for trusted headers, code bytes, and non-verifiable methods.
     * @param chainId - Chain ID for EVM environment construction.
     * @param options - Oblivious overlay configuration.
     */
    constructor(inner, chainId, options) {
        // We extend JsonRpcProvider so that code relying on _getConnection().url,
        // destroy(), etc. still works. We forward to the inner provider for the
        // actual connection URL.
        const rpcUrl = inner?._getConnection?.()?.url ?? "http://localhost:8545";
        const staticNetwork = Network.from(Number(chainId));
        super(rpcUrl, staticNetwork, { staticNetwork });
        this.#inner = inner;
        this.#proofServerUrl = options.proofServerUrl;
        this.#failurePolicy = options.failurePolicy ?? "fail-closed";
        this.#chainId = BigInt(chainId);
    }
    /**
     * Override send() — the single chokepoint for all RPC traffic in ethers.
     *
     * Privacy-sensitive reads → oblivious_node (proofs) + local execution.
     * Everything else → inner provider (Helios/Colibri/RPC).
     */
    async send(method, params = []) {
        const paramArray = Array.isArray(params) ? params : [params];
        // If not a privacy-routed method, or if it needs bypass, use inner directly
        if (!PRIVACY_ROUTED_METHODS.has(method) || shouldBypass(method, paramArray)) {
            return this.#inner.send(method, params);
        }
        try {
            return await this.#handlePrivate(method, paramArray);
        }
        catch (error) {
            if (this.#failurePolicy === "fallback") {
                // Fallback to inner provider — still verified by Helios/Colibri,
                // but loses privacy (the inner provider's RPC sees the query).
                return this.#inner.send(method, params);
            }
            throw error;
        }
    }
    /**
     * Override destroy() to also clean up the inner provider.
     */
    destroy() {
        this.#inner.destroy();
        super.destroy();
    }
    // ─── Private verified+private method implementations ───
    async #handlePrivate(method, params) {
        switch (method) {
            case "eth_call":
                return this.#privateEthCall(params);
            case "eth_getBalance":
                return this.#privateGetBalance(params);
            case "eth_getTransactionCount":
                return this.#privateGetTransactionCount(params);
            case "eth_getStorageAt":
                return this.#privateGetStorageAt(params);
            case "eth_getCode":
                return this.#privateGetCode(params);
            case "eth_getProof":
                return this.#privateGetProof(params);
            default:
                return this.#inner.send(method, params);
        }
    }
    /**
     * Get a trusted block header from the INNER provider.
     *
     * When the inner provider is Helios/Colibri, this header is consensus-verified.
     * The stateRoot from this header is the trust anchor for all proof verification.
     */
    async #getTrustedHeader(blockTag) {
        const tag = blockTag === "latest" ? "latest" : blockTag;
        const block = await this.#inner.send("eth_getBlockByNumber", [tag, false]);
        return {
            number: BigInt(block.number),
            stateRoot: block.stateRoot,
            timestamp: BigInt(block.timestamp),
            baseFeePerGas: block.baseFeePerGas ? BigInt(block.baseFeePerGas) : 0n,
            gasLimit: BigInt(block.gasLimit),
            coinbase: block.miner,
            prevRandao: block.mixHash ?? block.prevRandao ?? "0x" + "0".repeat(64),
            chainId: this.#chainId,
        };
    }
    /**
     * Verified + Private eth_call.
     *
     * 1. Get trusted header from inner provider (Helios/Colibri → integrity)
     * 2. During EVM execution, each SLOAD/BALANCE fetches proofs from
     *    oblivious_node (→ privacy: the proof server doesn't learn patterns)
     * 3. Each proof is verified against the trusted stateRoot (→ integrity)
     * 4. Code bytes are fetched from inner provider and verified via codeHash
     */
    async #privateEthCall(params) {
        const [txObj, blockTag] = params;
        const header = await this.#getTrustedHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        // Code bytes come from the inner provider (not privacy-sensitive —
        // contract code is public), but are verified against codeHash from the proof.
        const innerUrl = this.#inner?._getConnection?.()?.url ?? "";
        const state = new VerifiedStateBackend(stateRoot, header.number, this.#proofServerUrl, // proofs from oblivious_node (PRIVATE)
        innerUrl // code from inner provider (verified via codeHash)
        );
        const callParams = {
            from: txObj.from,
            to: txObj.to,
            data: txObj.data ?? txObj.input,
            value: txObj.value,
            gas: txObj.gas ?? txObj.gasLimit,
        };
        const result = await executeCall(callParams, header, state);
        if (!result.success) {
            const error = new Error(result.error ?? "execution reverted");
            error.data = bytesToHex(result.returnData);
            error.code = "CALL_EXCEPTION";
            throw error;
        }
        return bytesToHex(result.returnData);
    }
    /**
     * Private eth_getBalance — proof from oblivious_node, verified against
     * stateRoot from inner provider.
     */
    async #privateGetBalance(params) {
        const [address, blockTag] = params;
        const header = await this.#getTrustedHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        // Proof fetched from oblivious_node (PRIVATE)
        const proof = await fetchProof(this.#proofServerUrl, address, [], header.number);
        // Verified against trusted stateRoot (INTEGRITY)
        const result = verifyAccountProof(stateRoot, hexToBytes(address), proof.accountProof);
        if (!result.exists)
            return "0x0";
        return bigIntToHex(result.balance);
    }
    async #privateGetTransactionCount(params) {
        const [address, blockTag] = params;
        const header = await this.#getTrustedHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const proof = await fetchProof(this.#proofServerUrl, address, [], header.number);
        const result = verifyAccountProof(stateRoot, hexToBytes(address), proof.accountProof);
        if (!result.exists)
            return "0x0";
        return bigIntToHex(result.nonce);
    }
    async #privateGetStorageAt(params) {
        const [address, slot, blockTag] = params;
        const header = await this.#getTrustedHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const proof = await fetchProof(this.#proofServerUrl, address, [slot], header.number);
        const accountResult = verifyAccountProof(stateRoot, hexToBytes(address), proof.accountProof);
        if (!accountResult.exists || proof.storageProof.length === 0) {
            return "0x" + "0".repeat(64);
        }
        const sp = proof.storageProof[0];
        const storageResult = verifyStorageProof(accountResult.storageRoot, hexToBytes(slot), sp.proof);
        return "0x" + storageResult.value.toString(16).padStart(64, "0");
    }
    /**
     * Private eth_getCode — codeHash proven via oblivious_node, code bytes
     * fetched from inner provider and verified by hash comparison.
     *
     * Note: eth_getCode itself is not privacy-sensitive (contract code is public),
     * but we still verify it against the proven codeHash for integrity.
     */
    async #privateGetCode(params) {
        const [address, blockTag] = params;
        const header = await this.#getTrustedHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        // Get codeHash from oblivious proof (PRIVATE)
        const proof = await fetchProof(this.#proofServerUrl, address, [], header.number);
        const accountResult = verifyAccountProof(stateRoot, hexToBytes(address), proof.accountProof);
        if (!accountResult.exists)
            return "0x";
        if (bytesToHex(accountResult.codeHash) === EMPTY_CODE_HASH)
            return "0x";
        // Fetch actual code bytes from inner provider (not privacy-sensitive)
        const code = await this.#inner.send("eth_getCode", [address, blockTag ?? "latest"]);
        const codeBytes = hexToBytes(code);
        // Verify code against proven codeHash (INTEGRITY)
        const { keccak_256 } = await import("@noble/hashes/sha3");
        const computedHash = bytesToHex(keccak_256(codeBytes));
        if (computedHash !== bytesToHex(accountResult.codeHash)) {
            throw new Error(`Code verification failed for ${address}: ` +
                `expected ${bytesToHex(accountResult.codeHash)}, got ${computedHash}`);
        }
        return code;
    }
    /**
     * Private eth_getProof — fetched from oblivious_node, verified locally.
     */
    async #privateGetProof(params) {
        const [address, storageKeys, blockTag] = params;
        const header = await this.#getTrustedHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const proof = await fetchProof(this.#proofServerUrl, address, storageKeys ?? [], header.number);
        // Verify before returning
        verifyAccountProof(stateRoot, hexToBytes(address), proof.accountProof);
        return proof;
    }
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
export function wrapWithOblivious(inner, chainId, options) {
    return new ObliviousProofOverlay(inner, chainId, options);
}
/**
 * Chains supported by oblivious_node.
 */
export function isObliviousSupportedChain(chainId) {
    if (!chainId)
        return false;
    const supported = [1, 11155111]; // mainnet + sepolia
    return supported.includes(Number(chainId));
}
//# sourceMappingURL=ObliviousRpcProvider.js.map