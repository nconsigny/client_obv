/**
 * This file shows the exact modifications needed in:
 *   kohaku-commons/src/services/provider/getRpcProvider.ts
 *
 * KEY CHANGE: The oblivious layer is NOT a new provider kind.
 * It's a WRAPPER applied on top of any existing provider (helios, colibri, rpc).
 * This means you keep your existing provider kind for integrity/headers,
 * and layer oblivious on top for private proof fetching.
 */

// ============================================================
// PATCHED FILE: getRpcProvider.ts
// ============================================================

import { JsonRpcProvider, Network } from "ethers";

// Existing imports (unchanged)...
import { BrowserProvider } from "./BrowserProvider";
import {
  ColibriRpcProvider,
  ColibriRpcProviderOptions,
  isColibriSupportedChain,
} from "./ColibriRpcProvider";
import { HeliosEthersProvider } from "./HeliosEthersProvider";

// ┌─────────────────────────────────────────────────────────┐
// │ NEW IMPORT — privacy overlay, not a replacement          │
// └─────────────────────────────────────────────────────────┘
import {
  wrapWithOblivious,
  isObliviousSupportedChain,
} from "./ObliviousProofOverlay";

type MinNetworkConfig = {
  rpcUrls: string[];
  chainId?: bigint | number;
  selectedRpcUrl?: string;
  batchMaxCount?: number;
  rpcProvider?: string; // UNCHANGED: still 'rpc' | 'helios' | 'colibri'
  proverRpcUrl?: string;
  // ┌───────────────────────────────────────────────────────┐
  // │ NEW FIELD — when set, wraps the provider with privacy │
  // └───────────────────────────────────────────────────────┘
  obliviousProofServerUrl?: string;
};

export type GetRpcProviderConfig = MinNetworkConfig & ColibriRpcProviderOptions;

export function getRpcProvider(
  config: GetRpcProviderConfig,
  forceBypassHelios: boolean = false
) {
  if (!config.rpcUrls.length) {
    throw new Error("rpcUrls must be a non-empty array");
  }

  let rpcUrl = config.rpcUrls[0];
  if (config.selectedRpcUrl) {
    const prefUrl = config.rpcUrls.find((u: string) => u === config.selectedRpcUrl);
    if (prefUrl) rpcUrl = prefUrl;
  }
  if (!rpcUrl) throw new Error("Invalid RPC URL provided");

  let staticNetwork: Network | undefined;
  if (config.chainId) {
    staticNetwork = Network.from(Number(config.chainId));
  }

  const providerKind = forceBypassHelios
    ? "rpc"
    : config.rpcProvider ?? "rpc";

  // ─── Step 1: Create the inner provider (UNCHANGED) ───
  let provider: JsonRpcProvider | BrowserProvider | ColibriRpcProvider;

  switch (providerKind) {
    case "rpc":
      provider = new JsonRpcProvider(rpcUrl, staticNetwork, {
        staticNetwork,
        batchMaxCount: config.batchMaxCount,
      });
      break;

    case "helios":
      if (!staticNetwork) {
        throw new Error("Cannot use Helios without staticNetwork");
      }
      // eslint-disable-next-line no-case-declarations
      const heliosProvider = new HeliosEthersProvider(
        config as any,
        rpcUrl,
        staticNetwork
      );
      provider = new BrowserProvider(heliosProvider, rpcUrl);
      break;

    case "colibri":
      if (!config.chainId || !isColibriSupportedChain(config.chainId)) {
        throw new Error(
          `Colibri is not supported for chain ${config.chainId}`
        );
      }
      // eslint-disable-next-line no-case-declarations
      const colibriOverrides = config.proverRpcUrl?.trim()
        ? { ...(config.colibri || {}), prover: [config.proverRpcUrl.trim()] }
        : config.colibri;
      provider = new ColibriRpcProvider(rpcUrl, config.chainId, {
        batchMaxCount: config.batchMaxCount,
        colibri: colibriOverrides,
      });
      break;

    default:
      throw new Error(`Invalid provider kind: ${providerKind}`);
  }

  (provider as any).rpcProvider = providerKind;

  // ┌─────────────────────────────────────────────────────────────┐
  // │ Step 2: Wrap with oblivious privacy overlay if configured   │
  // │                                                             │
  // │ This does NOT replace the inner provider. It layers on top: │
  // │   • Headers still come from Helios/Colibri (INTEGRITY)      │
  // │   • Proofs now come from oblivious_node (PRIVACY)           │
  // │   • EVM runs locally on verified state (EXECUTION)          │
  // │   • Non-verifiable methods pass through to inner provider   │
  // └─────────────────────────────────────────────────────────────┘
  if (
    config.obliviousProofServerUrl &&
    config.chainId &&
    isObliviousSupportedChain(config.chainId)
  ) {
    provider = wrapWithOblivious(
      provider as JsonRpcProvider,
      config.chainId,
      {
        proofServerUrl: config.obliviousProofServerUrl,
        failurePolicy: "fallback", // graceful: lose privacy, keep integrity
      }
    );
    (provider as any).rpcProvider = providerKind; // preserve inner kind
    (provider as any).obliviousEnabled = true;
  }

  return provider;
}
