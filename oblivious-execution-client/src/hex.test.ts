import { describe, it, expect } from "vitest";
import {
  hexToBytes,
  bytesToHex,
  hexToBigInt,
  bigIntToHex,
  normalizeAddress,
  normalizeSlotKey,
  stripLeadingZeros,
} from "./hex.js";

describe("hex utilities", () => {
  it("hexToBytes", () => {
    expect(hexToBytes("0x0102")).toEqual(new Uint8Array([1, 2]));
    expect(hexToBytes("abcd")).toEqual(new Uint8Array([0xab, 0xcd]));
  });

  it("bytesToHex", () => {
    expect(bytesToHex(new Uint8Array([0xab, 0xcd]))).toBe("0xabcd");
    expect(bytesToHex(new Uint8Array([]))).toBe("0x");
  });

  it("round-trips", () => {
    const hex = "0xdeadbeef";
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });

  it("hexToBigInt", () => {
    expect(hexToBigInt("0x0")).toBe(0n);
    expect(hexToBigInt("0x2a")).toBe(42n);
    expect(hexToBigInt("0xff")).toBe(255n);
  });

  it("bigIntToHex", () => {
    expect(bigIntToHex(0n)).toBe("0x0");
    expect(bigIntToHex(42n)).toBe("0x2a");
    expect(bigIntToHex(255n)).toBe("0xff");
  });

  it("normalizeAddress", () => {
    expect(normalizeAddress("0xABCDEF")).toBe("0x0000000000000000000000000000000000abcdef");
    expect(normalizeAddress("dAC17F958D2ee523a2206206994597C13D831ec7")).toBe(
      "0xdac17f958d2ee523a2206206994597c13d831ec7"
    );
  });

  it("normalizeSlotKey", () => {
    expect(normalizeSlotKey("0x0")).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    expect(normalizeSlotKey("0x1")).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000001"
    );
  });

  it("stripLeadingZeros", () => {
    expect(stripLeadingZeros("0x0042")).toBe("0x42");
    expect(stripLeadingZeros("0x0000")).toBe("0x0");
  });

  it("throws on odd-length hex", () => {
    expect(() => hexToBytes("0x123")).toThrow("Odd-length hex");
  });
});
