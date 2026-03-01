/**
 * Minimal RLP (Recursive Length Prefix) decoder.
 * Implements only decoding — sufficient for proof verification.
 * Reference: https://ethereum.org/en/developers/docs/data-structures-and-encoding/rlp/
 */
export type RLPItem = Uint8Array | RLPItem[];
export declare function decode(input: Uint8Array): RLPItem;
/** Encode a single item (bytes or list) to RLP. Used for hashing nodes during verification. */
export declare function encode(input: RLPItem): Uint8Array;
//# sourceMappingURL=rlp.d.ts.map