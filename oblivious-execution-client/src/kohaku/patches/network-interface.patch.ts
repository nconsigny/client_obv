/**
 * This file shows the exact modifications needed in:
 *   kohaku-commons/src/interfaces/network.ts
 *
 * CHANGE: Add `obliviousProofServerUrl` optional field to the Network interface.
 * This field stores the URL of the oblivious_node proof server for privacy-preserving
 * state reads. When set, getRpcProvider wraps the inner provider with ObliviousProofOverlay.
 */

// ============================================================
// DIFF: Add to the Network interface
// ============================================================
//
// After:
//   heliosCheckpoint?: string
// }
//
// Add (before the closing brace):
//   obliviousProofServerUrl?: string

// ============================================================
// DIFF: Add to AddNetworkRequestParams
// ============================================================
//
// After:
//   heliosCheckpoint?: Network['heliosCheckpoint']
// }
//
// Add:
//   obliviousProofServerUrl?: Network['obliviousProofServerUrl']

// ============================================================
// Result: The full Network interface with the new field
// ============================================================

export interface Network_Patched {
  chainId: bigint;
  name: string;
  nativeAssetSymbol: string;
  nativeAssetName: string;
  rpcUrls: string[];
  explorerUrl: string;
  selectedRpcUrl: string;
  consensusRpcUrl?: string;
  proverRpcUrl?: string;
  rpcProvider?: "rpc" | "helios" | "colibri";
  // ... other existing fields omitted for brevity ...
  features: any[];
  hasRelayer: boolean;
  predefined: boolean;
  has7702: boolean;
  batchMaxCount?: number;
  heliosCheckpoint?: string;

  // ┌─────────────────────────────────────────────────────────┐
  // │ NEW FIELD — Oblivious proof server URL for privacy       │
  // │                                                          │
  // │ When set, getRpcProvider wraps the inner provider with   │
  // │ ObliviousProofOverlay. The overlay fetches proofs from   │
  // │ this URL (via oblivious_node running in a TEE) while     │
  // │ headers still come from the inner provider (integrity).  │
  // │                                                          │
  // │ Set to '' or undefined to disable.                       │
  // └─────────────────────────────────────────────────────────┘
  obliviousProofServerUrl?: string;
}

export interface AddNetworkRequestParams_Patched {
  name: string;
  rpcUrls: string[];
  selectedRpcUrl: string;
  chainId: bigint;
  nativeAssetSymbol: string;
  nativeAssetName: string;
  explorerUrl: string;
  iconUrls?: string[];
  rpcProvider?: "rpc" | "helios" | "colibri";
  heliosCheckpoint?: string;

  // ┌─────────────────────────────────────────────────────────┐
  // │ NEW FIELD                                                │
  // └─────────────────────────────────────────────────────────┘
  obliviousProofServerUrl?: string;
}
