import { describe, it, expect } from "vitest";
import { decode, encode, type RLPItem } from "./rlp.js";
import { hexToBytes, bytesToHex } from "./hex.js";

describe("RLP decode", () => {
  it("decodes single byte", () => {
    const result = decode(new Uint8Array([0x42]));
    expect(result).toBeInstanceOf(Uint8Array);
    expect((result as Uint8Array)[0]).toBe(0x42);
  });

  it("decodes empty string", () => {
    const result = decode(new Uint8Array([0x80]));
    expect(result).toBeInstanceOf(Uint8Array);
    expect((result as Uint8Array).length).toBe(0);
  });

  it("decodes short string", () => {
    // "dog" = [0x83, 0x64, 0x6f, 0x67]
    const result = decode(new Uint8Array([0x83, 0x64, 0x6f, 0x67]));
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(result as Uint8Array).toString()).toBe("dog");
  });

  it("decodes empty list", () => {
    const result = decode(new Uint8Array([0xc0]));
    expect(Array.isArray(result)).toBe(true);
    expect((result as RLPItem[]).length).toBe(0);
  });

  it("decodes list with items", () => {
    // [ "cat", "dog" ] = [0xc8, 0x83, 0x63, 0x61, 0x74, 0x83, 0x64, 0x6f, 0x67]
    const result = decode(new Uint8Array([0xc8, 0x83, 0x63, 0x61, 0x74, 0x83, 0x64, 0x6f, 0x67]));
    expect(Array.isArray(result)).toBe(true);
    const items = result as RLPItem[];
    expect(items.length).toBe(2);
    expect(Buffer.from(items[0] as Uint8Array).toString()).toBe("cat");
    expect(Buffer.from(items[1] as Uint8Array).toString()).toBe("dog");
  });

  it("decodes nested list", () => {
    // [ [], [[]], [ [], [[]] ] ] = 0xc7c0c1c0c3c0c1c0
    const input = hexToBytes("0xc7c0c1c0c3c0c1c0");
    const result = decode(input) as RLPItem[];
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
  });

  it("throws on extra bytes", () => {
    expect(() => decode(new Uint8Array([0x42, 0x43]))).toThrow("extra bytes");
  });
});

describe("RLP encode", () => {
  it("encodes single byte", () => {
    const encoded = encode(new Uint8Array([0x42]));
    expect(encoded).toEqual(new Uint8Array([0x42]));
  });

  it("encodes empty string", () => {
    const encoded = encode(new Uint8Array(0));
    expect(encoded).toEqual(new Uint8Array([0x80]));
  });

  it("encodes short string", () => {
    const encoded = encode(new Uint8Array([0x64, 0x6f, 0x67])); // "dog"
    expect(encoded).toEqual(new Uint8Array([0x83, 0x64, 0x6f, 0x67]));
  });

  it("encodes empty list", () => {
    const encoded = encode([]);
    expect(encoded).toEqual(new Uint8Array([0xc0]));
  });

  it("round-trips a branch node", () => {
    // Decode a real trie node then re-encode and check hash matches
    const nodeHex = "f8669d3802a763f7db875346d03fbf86f137de55814b191c069e721f47474733b846f844012aa062e0c37938ff1036ff792ac8fb646bb80f823f962f29bdf873fe3047f3dfceaca0b44fb4e949d0f78f87f79ee46428f23a2a5713ce6fc6e0beb3dda78c2ac1ea55";
    const bytes = hexToBytes("0x" + nodeHex);
    const decoded = decode(bytes);
    const reEncoded = encode(decoded);
    expect(bytesToHex(reEncoded)).toBe(bytesToHex(bytes));
  });
});
