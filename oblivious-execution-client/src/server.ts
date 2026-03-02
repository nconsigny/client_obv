/**
 * Standalone JSON-RPC server wrapping the ObliviousProvider.
 *
 * Used by assertoor / ethpandaops integration tests to treat the
 * oblivious execution client as an EL endpoint.
 *
 * Usage:
 *   PROOF_SERVER_URL=http://oblivious-node:8545 \
 *   FALLBACK_RPC_URL=http://geth:8545 \
 *   CHAIN_ID=1337 \
 *   PORT=8547 \
 *   npx tsx src/server.ts
 */

import http from "node:http";
import { ObliviousProvider, MockHeaderProvider } from "./provider.js";
import type { TrustedHeaderProvider } from "./types.js";
import { jsonRpcCall } from "./rpc-client.js";

// ── Configuration ──────────────────────────────────────────────────────
const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:8545";
const FALLBACK_RPC_URL = process.env.FALLBACK_RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = BigInt(process.env.CHAIN_ID ?? "1");
const PORT = Number(process.env.PORT ?? "8547");
const FAILURE_POLICY = (process.env.FAILURE_POLICY ?? "fail-closed") as
  | "fail-closed"
  | "fallback";

// ── Header provider that delegates to the fallback RPC ─────────────────
class RpcHeaderProvider implements TrustedHeaderProvider {
  async getHeader(blockTag: string | bigint) {
    const tag =
      typeof blockTag === "bigint" ? "0x" + blockTag.toString(16) : blockTag;

    const block = await jsonRpcCall<any>(
      FALLBACK_RPC_URL,
      "eth_getBlockByNumber",
      [tag, false]
    );

    return {
      number: BigInt(block.number),
      stateRoot: block.stateRoot,
      timestamp: BigInt(block.timestamp),
      baseFeePerGas: block.baseFeePerGas ? BigInt(block.baseFeePerGas) : 0n,
      gasLimit: BigInt(block.gasLimit),
      coinbase: block.miner,
      prevRandao: block.mixHash ?? block.prevRandao ?? "0x" + "0".repeat(64),
      chainId: CHAIN_ID,
    };
  }
}

// ── Create provider ────────────────────────────────────────────────────
const provider = new ObliviousProvider({
  proofServerUrl: PROOF_SERVER_URL,
  fallbackRpcUrl: FALLBACK_RPC_URL,
  chainId: CHAIN_ID,
  failurePolicy: FAILURE_POLICY,
  trustedHeaderProvider: new RpcHeaderProvider(),
});

// ── JSON-RPC HTTP server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      })
    );
    return;
  }

  const { jsonrpc, method, params, id } = parsed;

  try {
    const result = await provider.request({ method, params: params ?? [] });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
  } catch (err: any) {
    const code = err.code === "CALL_EXCEPTION" ? 3 : -32000;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: {
          code,
          message: err.message ?? "Internal error",
          data: err.data,
        },
      })
    );
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Oblivious execution client JSON-RPC server listening on :${PORT}`);
  console.log(`  Proof server:  ${PROOF_SERVER_URL}`);
  console.log(`  Fallback RPC:  ${FALLBACK_RPC_URL}`);
  console.log(`  Chain ID:      ${CHAIN_ID}`);
  console.log(`  Failure policy: ${FAILURE_POLICY}`);
});
