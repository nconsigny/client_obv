import { describe, it, expect } from "vitest";
import { executeCall, type EVMResult } from "./evm.js";
import type { TrustedHeader, CallParams } from "./types.js";
import type { VerifiedAccount } from "./types.js";
import { hexToBytes, bytesToHex } from "./hex.js";
import { EMPTY_CODE_HASH } from "./types.js";

// Mock VerifiedStateBackend for testing
class MockState {
  private accounts = new Map<string, VerifiedAccount>();
  private storage = new Map<string, bigint>();
  private codes = new Map<string, Uint8Array>();

  setAccount(address: string, account: Partial<VerifiedAccount>) {
    const addr = address.toLowerCase();
    this.accounts.set(addr, {
      address: addr,
      nonce: account.nonce ?? 0n,
      balance: account.balance ?? 0n,
      storageRoot: account.storageRoot ?? new Uint8Array(32),
      codeHash: account.codeHash ?? hexToBytes(EMPTY_CODE_HASH),
      code: account.code,
    });
    if (account.code) {
      this.codes.set(addr, account.code);
    }
  }

  setStorage(address: string, slot: string, value: bigint) {
    this.storage.set(`${address.toLowerCase()}:${slot.toLowerCase()}`, value);
  }

  async getAccountBasic(address: string): Promise<VerifiedAccount> {
    const addr = address.toLowerCase();
    return this.accounts.get(addr) ?? {
      address: addr,
      nonce: 0n,
      balance: 0n,
      storageRoot: new Uint8Array(32),
      codeHash: hexToBytes(EMPTY_CODE_HASH),
    };
  }

  async getStorage(address: string, slotKey: string): Promise<bigint> {
    const key = `${address.toLowerCase()}:${slotKey.toLowerCase()}`;
    return this.storage.get(key) ?? 0n;
  }

  async getCode(address: string): Promise<Uint8Array> {
    return this.codes.get(address.toLowerCase()) ?? new Uint8Array(0);
  }

  stats() { return { accounts: 0, storageSlots: 0, codeEntries: 0 }; }
}

const mockHeader: TrustedHeader = {
  number: 18000000n,
  stateRoot: "0x" + "aa".repeat(32),
  timestamp: 1700000000n,
  baseFeePerGas: 30000000000n,
  gasLimit: 30000000n,
  coinbase: "0x" + "00".repeat(20),
  prevRandao: "0x" + "bb".repeat(32),
  chainId: 1n,
};

describe("EVM execution", () => {
  it("returns empty for EOA (no code)", async () => {
    const state = new MockState();
    const result = await executeCall(
      { to: "0x" + "11".repeat(20) },
      mockHeader,
      state as any
    );
    expect(result.success).toBe(true);
    expect(result.returnData.length).toBe(0);
  });

  it("executes PUSH1 + PUSH1 + ADD + PUSH1 + MSTORE + PUSH1 + PUSH1 + RETURN", async () => {
    // Bytecode: push1 3, push1 5, add (=8), push1 0, mstore, push1 32, push1 0, return
    // Returns 32 bytes with value 8 at the end
    const code = hexToBytes("0x600360050160005260206000f3");
    // More correct bytecode:
    // PUSH1 0x03  -> 60 03
    // PUSH1 0x05  -> 60 05
    // ADD         -> 01
    // PUSH1 0x00  -> 60 00
    // MSTORE      -> 52
    // PUSH1 0x20  -> 60 20
    // PUSH1 0x00  -> 60 00
    // RETURN      -> f3
    const correctCode = hexToBytes("0x600360050160005260206000f3");
    const state = new MockState();
    const addr = "0x" + "cc".repeat(20);
    state.setAccount(addr, { code: correctCode });

    const result = await executeCall({ to: addr }, mockHeader, state as any);
    expect(result.success).toBe(true);
    expect(result.returnData.length).toBe(32);
    // Last byte should be 8 (3 + 5)
    expect(result.returnData[31]).toBe(8);
  });

  it("executes CALLER opcode", async () => {
    // PUSH1 0x00, CALLER, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
    const code = hexToBytes("0x3360005260206000f3");
    const state = new MockState();
    const addr = "0x" + "dd".repeat(20);
    const from = "0x" + "ab".repeat(20);
    state.setAccount(addr, { code });

    const result = await executeCall(
      { to: addr, from },
      mockHeader,
      state as any
    );
    expect(result.success).toBe(true);
    expect(result.returnData.length).toBe(32);
    // Caller address should be in the last 20 bytes
    const callerHex = bytesToHex(result.returnData.subarray(12, 32));
    expect(callerHex).toBe(from);
  });

  it("executes SLOAD from verified storage", async () => {
    // PUSH1 0x00 (slot), SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
    const code = hexToBytes("0x600054600052602060" + "00f3");
    const state = new MockState();
    const addr = "0x" + "ee".repeat(20);
    state.setAccount(addr, { code });
    state.setStorage(
      addr,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      42n
    );

    const result = await executeCall({ to: addr }, mockHeader, state as any);
    expect(result.success).toBe(true);
    expect(result.returnData.length).toBe(32);
    expect(result.returnData[31]).toBe(42);
  });

  it("handles REVERT", async () => {
    // PUSH1 0x00, PUSH1 0x00, REVERT
    const code = hexToBytes("0x60006000fd");
    const state = new MockState();
    const addr = "0x" + "ff".repeat(20);
    state.setAccount(addr, { code });

    const result = await executeCall({ to: addr }, mockHeader, state as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Revert");
  });

  it("handles PUSH0 (EIP-3855)", async () => {
    // PUSH0, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
    const code = hexToBytes("0x5f60005260206000f3");
    const state = new MockState();
    const addr = "0x" + "aa".repeat(20);
    state.setAccount(addr, { code });

    const result = await executeCall({ to: addr }, mockHeader, state as any);
    expect(result.success).toBe(true);
    // All zeros
    expect(result.returnData.every((b) => b === 0)).toBe(true);
  });

  it("executes CHAINID opcode", async () => {
    // CHAINID, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
    const code = hexToBytes("0x4660005260206000f3");
    const state = new MockState();
    const addr = "0x" + "bb".repeat(20);
    state.setAccount(addr, { code });

    const result = await executeCall({ to: addr }, mockHeader, state as any);
    expect(result.success).toBe(true);
    expect(result.returnData[31]).toBe(1); // chainId = 1
  });
});
