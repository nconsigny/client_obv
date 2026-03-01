/**
 * Hex encoding/decoding utilities.
 */
export function hexToBytes(hex) {
    const h = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (h.length % 2 !== 0)
        throw new Error(`Odd-length hex: ${hex}`);
    const bytes = new Uint8Array(h.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(h.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
export function bytesToHex(bytes) {
    let hex = "0x";
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
}
export function padHex(hex, bytes) {
    const h = hex.startsWith("0x") ? hex.slice(2) : hex;
    return "0x" + h.padStart(bytes * 2, "0");
}
export function stripLeadingZeros(hex) {
    const h = hex.startsWith("0x") ? hex.slice(2) : hex;
    const stripped = h.replace(/^0+/, "") || "0";
    return "0x" + stripped;
}
/** Convert hex quantity string to bigint. Handles "0x0", "0x2a", etc. */
export function hexToBigInt(hex) {
    const h = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (h === "" || h === "0")
        return 0n;
    return BigInt("0x" + h);
}
export function bigIntToHex(n) {
    if (n === 0n)
        return "0x0";
    return "0x" + n.toString(16);
}
export function hexToNumber(hex) {
    return Number(hexToBigInt(hex));
}
/** Normalize an address to checksumless lowercase 0x-prefixed 40-char form. */
export function normalizeAddress(addr) {
    const h = addr.startsWith("0x") ? addr.slice(2) : addr;
    return "0x" + h.toLowerCase().padStart(40, "0");
}
/** Normalize a 32-byte storage key. */
export function normalizeSlotKey(key) {
    const h = key.startsWith("0x") ? key.slice(2) : key;
    return "0x" + h.toLowerCase().padStart(64, "0");
}
//# sourceMappingURL=hex.js.map