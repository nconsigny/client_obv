/**
 * This file shows the exact modifications needed in:
 *   kohaku-extension/src/web/modules/settings/screens/NetworksSettingsScreen/NetworkForm/NetworkForm.tsx
 *
 * CHANGES:
 * 1. Add `obliviousProofServerUrl` to NetworkFormValues
 * 2. Add `isObliviousSupportedChain` import
 * 3. Add Checkbox toggle + URL input for Oblivious Proof Server
 * 4. Wire the new field into add/update dispatch
 *
 * The toggle appears BELOW the RPC verifier section (after Colibri fields),
 * matching the existing pattern of conditional fields.
 */

// ============================================================
// DIFF INSTRUCTIONS (apply to existing NetworkForm.tsx)
// ============================================================

// ─── 1. Add import at the top ────────────────────────────────
//
// After:
//   import { isColibriSupportedChain } from '@ambire-common/services/provider'
//
// Add:
//   import { isObliviousSupportedChain } from 'oblivious-execution-client'
//
// If using local copy instead of npm package:
//   import { isObliviousSupportedChain } from '@ambire-common/services/provider/ObliviousProofOverlay'

// ─── 2. Add to NetworkFormValues type ────────────────────────
//
// After:
//   proverRpcUrl: string
//
// Add:
//   obliviousProofServerUrl: string

// ─── 3. Add form default + initial values ────────────────────
//
// In useForm defaultValues, add:
//   obliviousProofServerUrl: ''
//
// In useForm values, add:
//   obliviousProofServerUrl: selectedNetwork?.obliviousProofServerUrl || ''

// ─── 4. Add computed flag ────────────────────────────────────
//
// After:
//   const canUseColibri = useMemo(...)
//
// Add:
//   const canUseOblivious = useMemo(() => {
//     try {
//       if (!chainIdValue) return false
//       return isObliviousSupportedChain(BigInt(chainIdValue))
//     } catch {
//       return false
//     }
//   }, [chainIdValue])

// ─── 5. Add obliviousProofServerUrl to dispatch params ───────
//
// In MAIN_CONTROLLER_ADD_NETWORK dispatch, add to params:
//   obliviousProofServerUrl: networkFormValues.obliviousProofServerUrl
//
// In MAIN_CONTROLLER_UPDATE_NETWORK dispatch, add to params.network:
//   obliviousProofServerUrl: networkFormValues.obliviousProofServerUrl

// ─── 6. Add UI section in the form ──────────────────────────
//
// After the Colibri proverRpcUrl conditional block:
//   {shouldShowColibriFields && ( ... )}
//
// Add the following JSX block:

// ============================================================
// NEW JSX BLOCK — paste after {shouldShowColibriFields && (...)}
// ============================================================

/*
              {canUseOblivious && (
                <>
                  <Text
                    appearance="secondaryText"
                    fontSize={14}
                    weight="regular"
                    style={spacings.mbMi}
                  >
                    {t('Privacy overlay')}
                  </Text>
                  <View style={[styles.rpcUrlsContainer, spacings.mb]}>
                    <Pressable
                      style={[
                        styles.selectRpcItem,
                        { height: 40 },
                      ]}
                      onPress={() => {
                        const current = watch('obliviousProofServerUrl')
                        if (current) {
                          setValue('obliviousProofServerUrl', '', { shouldDirty: true })
                        } else {
                          setValue(
                            'obliviousProofServerUrl',
                            process.env.OBLIVIOUS_PROOF_SERVER_URL || 'http://127.0.0.1:8545',
                            { shouldDirty: true }
                          )
                        }
                      }}
                    >
                      <Checkbox
                        value={!!watch('obliviousProofServerUrl')}
                        onValueChange={(checked: boolean) => {
                          if (checked) {
                            setValue(
                              'obliviousProofServerUrl',
                              process.env.OBLIVIOUS_PROOF_SERVER_URL || 'http://127.0.0.1:8545',
                              { shouldDirty: true }
                            )
                          } else {
                            setValue('obliviousProofServerUrl', '', { shouldDirty: true })
                          }
                        }}
                        style={spacings.mrTy}
                      />
                      <View>
                        <Text fontSize={14} weight="medium" appearance="secondaryText">
                          {t('Oblivious Proof Server (Privacy)')}
                        </Text>
                        <Text fontSize={11} appearance="secondaryText">
                          {t('State proofs fetched privately via TEE — the server cannot see your queries')}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                  {!!watch('obliviousProofServerUrl') && (
                    <Controller
                      control={control}
                      render={({ field: { onChange, onBlur, value } }: ControllerRenderArgs) => (
                        <Input
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          inputWrapperStyle={{ height: 40 }}
                          inputStyle={{ height: 40 }}
                          containerStyle={{ ...spacings.mb, flex: 1 }}
                          label={t('Oblivious Proof Server URL')}
                          placeholder="http://127.0.0.1:8545"
                          error={handleErrors(errors.obliviousProofServerUrl)}
                        />
                      )}
                      name="obliviousProofServerUrl"
                    />
                  )}
                </>
              )}
*/

// ─── 7. Add URL validation in the watch effect ───────────────
//
// In the watch() subscription, add a case for obliviousProofServerUrl:
//
//   if (name === 'obliviousProofServerUrl') {
//     if (!value.obliviousProofServerUrl) {
//       clearErrors('obliviousProofServerUrl')
//       return
//     }
//     try {
//       const url = new URL(value.obliviousProofServerUrl)
//       if (url.protocol !== 'http:' && url.protocol !== 'https:') {
//         setError('obliviousProofServerUrl', {
//           type: 'custom-error',
//           message: 'URL must start with http:// or https://'
//         })
//         return
//       }
//     } catch {
//       setError('obliviousProofServerUrl', {
//         type: 'custom-error',
//         message: 'Invalid URL'
//       })
//       return
//     }
//     clearErrors('obliviousProofServerUrl')
//   }

// ============================================================
// FULL PATCHED FILE (for reference — showing the complete form)
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
// import { useTranslation } from 'react-i18next'
import { Pressable, View, ViewStyle } from "react-native";

// Existing imports (showing only what matters for the patch)
import { isColibriSupportedChain } from "@ambire-common/services/provider";
// ┌─────────────────────────────────────────────────────────┐
// │ NEW IMPORT                                               │
// └─────────────────────────────────────────────────────────┘
import { isObliviousSupportedChain } from "oblivious-execution-client";

import Checkbox from "@common/components/Checkbox";
import Input from "@common/components/Input";
import Text from "@common/components/Text";

type NetworkFormValues = {
  name: string;
  rpcUrl: string;
  rpcUrls?: string[];
  selectedRpcUrl?: string;
  consensusRpcUrl: string;
  heliosCheckpoint: string;
  proverRpcUrl: string;
  chainId: string;
  rpcProvider: "rpc" | "helios" | "colibri";
  nativeAssetSymbol: string;
  nativeAssetName: string;
  explorerUrl: string;
  coingeckoPlatformId: string;
  coingeckoNativeAssetId: string;
  // ┌─────────────────────────────────────────────────────────┐
  // │ NEW FIELD                                                │
  // └─────────────────────────────────────────────────────────┘
  obliviousProofServerUrl: string;
};

/**
 * This is a REFERENCE showing only the key sections of NetworkForm
 * that need modification. It is NOT a complete replacement file.
 * Apply the diff instructions above to the actual NetworkForm.tsx.
 */
export function _PatchReference_NetworkForm() {
  // In useForm(), add to defaultValues:
  const { watch, setValue, control, formState } = useForm<NetworkFormValues>({
    defaultValues: {
      // ...existing defaults...
      obliviousProofServerUrl: "", // NEW
    },
    values: {
      // ...existing values...
      name: "",
      rpcUrl: "",
      consensusRpcUrl: "",
      heliosCheckpoint: "",
      proverRpcUrl: "",
      chainId: "",
      rpcProvider: "rpc",
      nativeAssetSymbol: "",
      nativeAssetName: "",
      explorerUrl: "",
      coingeckoPlatformId: "",
      coingeckoNativeAssetId: "",
      // obliviousProofServerUrl: selectedNetwork?.obliviousProofServerUrl || '',  // NEW
      obliviousProofServerUrl: "",
    },
  });

  const chainIdValue = watch("chainId");

  // ┌─────────────────────────────────────────────────────────┐
  // │ NEW: compute whether chain supports oblivious overlay    │
  // └─────────────────────────────────────────────────────────┘
  const canUseOblivious = useMemo(() => {
    try {
      if (!chainIdValue) return false;
      return isObliviousSupportedChain(BigInt(chainIdValue));
    } catch {
      return false;
    }
  }, [chainIdValue]);

  // ... rest of component renders the JSX block shown above ...
  return null;
}
