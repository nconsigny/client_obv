/**
 * Merkle Patricia Trie (MPT) proof verification.
 *
 * Implements verification of EIP-1186 proofs against a trusted root hash.
 * Supports:
 *  - Branch nodes (17 items)
 *  - Extension nodes (2 items, even-prefixed path)
 *  - Leaf nodes (2 items, odd-prefixed path)
 *  - Existence and non-existence proofs
 *
 * Reference: https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
 */
/**
 * Verify an MPT proof.
 *
 * @param rootHash - The trusted root hash (32 bytes).
 * @param path - The key path in the trie (keccak256 of the key).
 * @param proofNodes - Array of RLP-encoded trie nodes (hex strings from EIP-1186).
 * @returns The RLP-encoded value at the leaf, or null if the proof shows non-existence.
 */
export declare function verifyProof(rootHash: Uint8Array, path: Uint8Array, proofNodes: string[]): Uint8Array | null;
/**
 * Parse an RLP-encoded Ethereum account value into its components.
 * Account RLP: [nonce, balance, storageRoot, codeHash]
 */
export declare function parseAccountRLP(rlpBytes: Uint8Array): {
    nonce: bigint;
    balance: bigint;
    storageRoot: Uint8Array;
    codeHash: Uint8Array;
};
/**
 * Parse an RLP-encoded storage value into a bigint.
 * Storage values are RLP-encoded byte strings.
 */
export declare function parseStorageValue(rlpBytes: Uint8Array): bigint;
/**
 * Verify an account proof from eth_getProof response.
 */
export declare function verifyAccountProof(stateRoot: Uint8Array, address: Uint8Array, accountProof: string[]): {
    exists: boolean;
    nonce?: bigint;
    balance?: bigint;
    storageRoot?: Uint8Array;
    codeHash?: Uint8Array;
};
/**
 * Verify a storage proof from eth_getProof response.
 */
export declare function verifyStorageProof(storageRoot: Uint8Array, slotKey: Uint8Array, storageProofNodes: string[]): {
    exists: boolean;
    value: bigint;
};
//# sourceMappingURL=mpt.d.ts.map