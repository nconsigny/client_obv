/**
 * EIP-1193 / ethers-compatible provider.
 *
 * Implements spec section 3: the external interface that dApps interact with.
 * Supports verified eth_call, getBalance, getStorageAt, getTransactionCount, getCode,
 * and eth_getProof via local proof verification.
 *
 * All state reads are backed by proofs verified against a trusted stateRoot.
 */
import { keccak_256 } from "@noble/hashes/sha3";
import { hexToBytes, bytesToHex, bigIntToHex, normalizeAddress, normalizeSlotKey } from "./hex.js";
import { VerifiedStateBackend } from "./verified-state.js";
import { executeCall } from "./evm.js";
import { fetchProof, fetchCode, fallbackCall } from "./rpc-client.js";
import { verifyAccountProof, verifyStorageProof } from "./mpt.js";
import { EMPTY_CODE_HASH } from "./types.js";
/**
 * ObliviousProvider — the main entry point for dApps.
 *
 * Usage:
 *   const provider = new ObliviousProvider({ proofServerUrl: "http://127.0.0.1:8545", ... });
 *   const balance = await provider.request({ method: "eth_getBalance", params: ["0x...", "latest"] });
 */
export class ObliviousProvider {
    config;
    headerProvider;
    listeners = new Map();
    constructor(config) {
        this.config = {
            proofServerUrl: config.proofServerUrl,
            chainId: config.chainId ?? 1n,
            failurePolicy: config.failurePolicy ?? "fail-closed",
            fallbackRpcUrl: config.fallbackRpcUrl,
            trustedHeaderProvider: config.trustedHeaderProvider,
        };
        this.headerProvider = config.trustedHeaderProvider ?? new DefaultHeaderProvider(config.fallbackRpcUrl ?? config.proofServerUrl, config.chainId ?? 1n);
    }
    /**
     * EIP-1193 request handler.
     */
    async request(args) {
        const { method, params = [] } = args;
        switch (method) {
            case "eth_call":
                return this.ethCall(params[0], params[1]);
            case "eth_getBalance":
                return this.ethGetBalance(params[0], params[1]);
            case "eth_getTransactionCount":
                return this.ethGetTransactionCount(params[0], params[1]);
            case "eth_getStorageAt":
                return this.ethGetStorageAt(params[0], params[1], params[2]);
            case "eth_getCode":
                return this.ethGetCode(params[0], params[1]);
            case "eth_getProof":
                return this.ethGetProof(params[0], params[1], params[2]);
            case "eth_chainId":
                return bigIntToHex(this.config.chainId);
            case "eth_blockNumber": {
                const header = await this.headerProvider.getHeader("latest");
                return bigIntToHex(header.number);
            }
            case "net_version":
                return this.config.chainId.toString();
            default:
                return this.handleUnsupported(method, params);
        }
    }
    /** Subscribe to provider events. */
    on(event, listener) {
        if (!this.listeners.has(event))
            this.listeners.set(event, new Set());
        this.listeners.get(event).add(listener);
    }
    /** Unsubscribe from provider events. */
    off(event, listener) {
        this.listeners.get(event)?.delete(listener);
    }
    emit(event, ...args) {
        this.listeners.get(event)?.forEach((fn) => fn(...args));
    }
    // --- Method implementations ---
    /**
     * Verified eth_call (spec section 8).
     * 1. Resolve block → trusted header
     * 2. Create VerifiedStateBackend
     * 3. Execute locally
     * 4. Return result
     */
    async ethCall(callParams, blockTag) {
        const header = await this.headerProvider.getHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const codeSourceUrl = this.config.fallbackRpcUrl ?? this.config.proofServerUrl;
        const stateBackend = new VerifiedStateBackend(stateRoot, header.number, this.config.proofServerUrl, codeSourceUrl);
        try {
            const result = await executeCall(callParams, header, stateBackend);
            this.emit("stateVerified", {
                method: "eth_call",
                blockNumber: header.number,
                cacheStats: stateBackend.stats(),
            });
            if (!result.success) {
                const error = new Error(result.error ?? "EVM execution reverted");
                error.data = bytesToHex(result.returnData);
                throw error;
            }
            return bytesToHex(result.returnData);
        }
        catch (error) {
            if (this.config.failurePolicy === "fallback" && this.config.fallbackRpcUrl) {
                return fallbackCall(this.config.fallbackRpcUrl, "eth_call", [callParams, blockTag ?? "latest"]);
            }
            throw error;
        }
    }
    /**
     * eth_getBalance via verified eth_getProof.
     */
    async ethGetBalance(address, blockTag) {
        const header = await this.headerProvider.getHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const addr = normalizeAddress(address);
        const proof = await fetchProof(this.config.proofServerUrl, addr, [], header.number);
        const result = verifyAccountProof(stateRoot, hexToBytes(addr), proof.accountProof);
        this.emit("proofFetched", { method: "eth_getBalance", address: addr });
        if (!result.exists)
            return "0x0";
        return bigIntToHex(result.balance);
    }
    /**
     * eth_getTransactionCount via verified eth_getProof.
     */
    async ethGetTransactionCount(address, blockTag) {
        const header = await this.headerProvider.getHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const addr = normalizeAddress(address);
        const proof = await fetchProof(this.config.proofServerUrl, addr, [], header.number);
        const result = verifyAccountProof(stateRoot, hexToBytes(addr), proof.accountProof);
        this.emit("proofFetched", { method: "eth_getTransactionCount", address: addr });
        if (!result.exists)
            return "0x0";
        return bigIntToHex(result.nonce);
    }
    /**
     * eth_getStorageAt via verified eth_getProof.
     */
    async ethGetStorageAt(address, position, blockTag) {
        const header = await this.headerProvider.getHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const addr = normalizeAddress(address);
        const slot = normalizeSlotKey(position);
        const proof = await fetchProof(this.config.proofServerUrl, addr, [slot], header.number);
        // First verify account
        const accountResult = verifyAccountProof(stateRoot, hexToBytes(addr), proof.accountProof);
        if (!accountResult.exists)
            return "0x" + "0".repeat(64);
        // Then verify storage
        if (proof.storageProof.length === 0)
            return "0x" + "0".repeat(64);
        const sp = proof.storageProof[0];
        const storageResult = verifyStorageProof(accountResult.storageRoot, hexToBytes(slot), sp.proof);
        this.emit("proofFetched", { method: "eth_getStorageAt", address: addr, slot });
        return "0x" + storageResult.value.toString(16).padStart(64, "0");
    }
    /**
     * eth_getCode — fetch code bytes and verify against proven codeHash.
     */
    async ethGetCode(address, blockTag) {
        const header = await this.headerProvider.getHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const addr = normalizeAddress(address);
        const codeSourceUrl = this.config.fallbackRpcUrl ?? this.config.proofServerUrl;
        // Get verified codeHash
        const proof = await fetchProof(this.config.proofServerUrl, addr, [], header.number);
        const accountResult = verifyAccountProof(stateRoot, hexToBytes(addr), proof.accountProof);
        if (!accountResult.exists)
            return "0x";
        const codeHashHex = bytesToHex(accountResult.codeHash);
        if (codeHashHex === EMPTY_CODE_HASH)
            return "0x";
        // Fetch code and verify
        const codeHex = await fetchCode(codeSourceUrl, addr, header.number);
        const codeBytes = hexToBytes(codeHex);
        const computedHash = bytesToHex(keccak_256(codeBytes));
        if (computedHash !== codeHashHex) {
            throw new Error(`Code verification failed for ${addr}`);
        }
        return codeHex;
    }
    /**
     * eth_getProof — forward to oblivious server AND verify locally.
     */
    async ethGetProof(address, storageKeys, blockTag) {
        const header = await this.headerProvider.getHeader(blockTag ?? "latest");
        const stateRoot = hexToBytes(header.stateRoot);
        const addr = normalizeAddress(address);
        const proof = await fetchProof(this.config.proofServerUrl, addr, storageKeys, header.number);
        // Verify account proof
        verifyAccountProof(stateRoot, hexToBytes(addr), proof.accountProof);
        this.emit("proofFetched", { method: "eth_getProof", address: addr, storageKeys });
        return proof;
    }
    /** Handle unsupported methods — fallback or error. */
    async handleUnsupported(method, params) {
        if (this.config.fallbackRpcUrl) {
            return fallbackCall(this.config.fallbackRpcUrl, method, params);
        }
        throw new Error(`Unsupported method: ${method}`);
    }
}
/**
 * Default header provider that fetches headers from a standard Ethereum RPC.
 *
 * In production, this should be replaced with Helios or another light-client
 * verifier that provides cryptographic trust guarantees.
 */
class DefaultHeaderProvider {
    url;
    chainId;
    constructor(url, chainId) {
        this.url = url;
        this.chainId = chainId;
    }
    async getHeader(blockTag) {
        const tag = typeof blockTag === "bigint" ? ("0x" + blockTag.toString(16)) : blockTag;
        const block = await fallbackCall(this.url, "eth_getBlockByNumber", [tag, false]);
        return {
            number: BigInt(block.number),
            stateRoot: block.stateRoot,
            timestamp: BigInt(block.timestamp),
            baseFeePerGas: block.baseFeePerGas ? BigInt(block.baseFeePerGas) : 0n,
            gasLimit: BigInt(block.gasLimit),
            coinbase: block.miner,
            prevRandao: block.mixHash ?? block.prevRandao ?? "0x" + "0".repeat(64),
            chainId: this.chainId,
        };
    }
}
/**
 * Mock header provider for testing / demo without a real chain.
 */
export class MockHeaderProvider {
    header;
    constructor(header) {
        this.header = header;
    }
    async getHeader(_blockTag) {
        return this.header;
    }
    setHeader(header) {
        this.header = header;
    }
}
//# sourceMappingURL=provider.js.map