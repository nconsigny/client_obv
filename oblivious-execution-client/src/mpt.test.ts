import { describe, it, expect } from "vitest";
import { keccak_256 } from "@noble/hashes/sha3";
import { verifyProof, verifyAccountProof, parseAccountRLP } from "./mpt.js";
import { hexToBytes, bytesToHex } from "./hex.js";
import { encode as rlpEncode } from "./rlp.js";

describe("MPT proof verification", () => {
  it("returns null for empty proof with empty trie root", () => {
    const emptyRoot = keccak_256(new Uint8Array([0x80]));
    const path = new Uint8Array(32);
    const result = verifyProof(emptyRoot, path, []);
    expect(result).toBeNull();
  });

  it("throws for empty proof with non-empty root", () => {
    const nonEmptyRoot = new Uint8Array(32).fill(0xab);
    const path = new Uint8Array(32);
    expect(() => verifyProof(nonEmptyRoot, path, [])).toThrow("empty proof but non-empty root");
  });

  it("verifies a simple leaf-only proof", () => {
    // Create a simple trie with one leaf.
    // The path in verifyProof is 32 bytes = 64 nibbles.
    // Leaf compact encoding: 0x20 prefix (even leaf) + 32 bytes of path nibble pairs.
    const path = new Uint8Array(32); // all zeros = 64 zero nibbles
    const value = new Uint8Array([1, 2, 3, 4]);

    // Compact path: 0x20 (even leaf prefix) followed by 32 zero bytes
    // This encodes 64 zero nibbles as a leaf.
    const compactPath = new Uint8Array(33);
    compactPath[0] = 0x20; // even leaf prefix, rest are zeros

    const leafRLP = rlpEncode([compactPath, value]);
    const leafHash = keccak_256(leafRLP);

    const result = verifyProof(leafHash, path, [bytesToHex(leafRLP)]);
    expect(result).not.toBeNull();
    expect(bytesToHex(result!)).toBe(bytesToHex(value));
  });
});

describe("parseAccountRLP", () => {
  it("parses an RLP-encoded account", () => {
    // Encode a sample account: [nonce=1, balance=42, storageRoot, codeHash]
    const nonce = new Uint8Array([1]);
    const balance = new Uint8Array([42]);
    const storageRoot = new Uint8Array(32).fill(0xaa);
    const codeHash = new Uint8Array(32).fill(0xbb);

    const rlp = rlpEncode([nonce, balance, storageRoot, codeHash]);
    const account = parseAccountRLP(rlp);

    expect(account.nonce).toBe(1n);
    expect(account.balance).toBe(42n);
    expect(bytesToHex(account.storageRoot)).toBe(bytesToHex(storageRoot));
    expect(bytesToHex(account.codeHash)).toBe(bytesToHex(codeHash));
  });

  it("parses zero values", () => {
    const rlp = rlpEncode([
      new Uint8Array(0), // nonce = 0
      new Uint8Array(0), // balance = 0
      new Uint8Array(32),
      new Uint8Array(32),
    ]);
    const account = parseAccountRLP(rlp);
    expect(account.nonce).toBe(0n);
    expect(account.balance).toBe(0n);
  });
});
