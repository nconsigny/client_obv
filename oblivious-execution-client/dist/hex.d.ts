/**
 * Hex encoding/decoding utilities.
 */
export declare function hexToBytes(hex: string): Uint8Array;
export declare function bytesToHex(bytes: Uint8Array): string;
export declare function padHex(hex: string, bytes: number): string;
export declare function stripLeadingZeros(hex: string): string;
/** Convert hex quantity string to bigint. Handles "0x0", "0x2a", etc. */
export declare function hexToBigInt(hex: string): bigint;
export declare function bigIntToHex(n: bigint): string;
export declare function hexToNumber(hex: string): number;
/** Normalize an address to checksumless lowercase 0x-prefixed 40-char form. */
export declare function normalizeAddress(addr: string): string;
/** Normalize a 32-byte storage key. */
export declare function normalizeSlotKey(key: string): string;
//# sourceMappingURL=hex.d.ts.map