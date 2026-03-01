# Integrating Oblivious Execution Client into Kohaku Extension

## Core Principle

Helios/Colibri and oblivious_node are **not alternatives** — they're **complementary layers**:

| Layer | Provides | Source |
|-------|----------|--------|
| **Helios / Colibri** | **Integrity** — trusted stateRoot via consensus light client | Inner provider |
| **oblivious_node** | **Privacy** — proof server can't learn what addresses/slots you query | Proof overlay |
| **Local EVM** | **Verified execution** — correct results without trusting any server | This client |

The `ObliviousProofOverlay` wraps your *existing* provider. It does not replace it.

## Architecture

```
dApp page
  → EthereumProvider (inpage, EIP-1193)
    → content-script messenger
      → background.ts (service worker)
        → rpcFlow.ts (middleware: unlock, connect, permissions)
          → ProviderController.ethRpc()
            → provider.send(method, params)
              │
              ├─ ObliviousProofOverlay  ← NEW WRAPPER
              │    │
              │    ├─ eth_call, eth_getBalance, eth_getStorageAt, ...
              │    │    ├─ Header ← from inner provider (INTEGRITY)
              │    │    ├─ Proofs ← from oblivious_node (PRIVACY)
              │    │    ├─ Verify proofs against stateRoot
              │    │    └─ Execute EVM locally (or return proven value)
              │    │
              │    ├─ eth_getCode
              │    │    ├─ codeHash ← from oblivious proof (PRIVACY)
              │    │    ├─ code bytes ← from inner provider (public, not sensitive)
              │    │    └─ Verify keccak256(code) == codeHash
              │    │
              │    └─ All other methods → pass through to inner
              │
              └─ Inner provider (Helios | Colibri | JsonRpc)
                   • Consensus-verified block headers
                   • Code bytes for contracts
                   • Transactions, subscriptions, etc.
```

## What Each Component Sees

| Data | Who sees it | Privacy status |
|------|-------------|---------------|
| Which addresses/slots you query | **oblivious_node only** (TEE-protected) | **Private** |
| Block headers, chain state root | Inner provider (Helios/Colibri) | Public (consensus data) |
| Contract bytecode | Inner provider's RPC | Public (on-chain code) |
| Your balance, storage values | **Nobody** (computed locally from proofs) | **Private** |
| eth_call results | **Nobody** (executed locally) | **Private** |

## Files to Modify (2 files, not 3)

The key insight: no new `RpcProviderKind` is needed. The overlay wraps
whatever provider already exists.

### 1. Install the package in kohaku-commons

```bash
cd src/ambire-common
npm install oblivious-execution-client
```

Or copy `ObliviousProofOverlay.ts` into:
```
kohaku-commons/src/services/provider/ObliviousProofOverlay.ts
```

### 2. Modify `getRpcProvider.ts`

**File:** `kohaku-commons/src/services/provider/getRpcProvider.ts`

Add the import at the top:

```typescript
import {
  wrapWithOblivious,
  isObliviousSupportedChain,
} from 'oblivious-execution-client'
// OR from local file:
// import { wrapWithOblivious, isObliviousSupportedChain } from './ObliviousProofOverlay'
```

Add `obliviousProofServerUrl` to the config type:

```typescript
type MinNetworkConfig = {
  // ...existing fields...
  obliviousProofServerUrl?: string  // NEW
}
```

After the existing switch statement that creates the provider, add the wrapping:

```typescript
  // ...existing switch statement creates `provider`...

  (provider as any).rpcProvider = providerKind

  // NEW: Layer oblivious privacy overlay on top of existing provider
  if (
    config.obliviousProofServerUrl &&
    config.chainId &&
    isObliviousSupportedChain(config.chainId)
  ) {
    provider = wrapWithOblivious(provider as JsonRpcProvider, config.chainId, {
      proofServerUrl: config.obliviousProofServerUrl,
      failurePolicy: 'fallback', // graceful: lose privacy, keep integrity
    })
    ;(provider as any).rpcProvider = providerKind
    ;(provider as any).obliviousEnabled = true
  }

  return provider
```

### 3. Add environment variable

**File:** `kohaku-extension/.env`

```
OBLIVIOUS_PROOF_SERVER_URL=http://127.0.0.1:8545
```

**File:** `kohaku-extension/webpack.config.js` (DefinePlugin section):

```javascript
'process.env.OBLIVIOUS_PROOF_SERVER_URL': JSON.stringify(
  process.env.OBLIVIOUS_PROOF_SERVER_URL || ''
),
```

### 4. Wire into network config

**File:** `kohaku-commons/src/interfaces/network.ts`

Add the optional field to the Network interface:

```typescript
export interface Network {
  // ...existing fields...
  obliviousProofServerUrl?: string  // NEW
}
```

For each network that should use privacy-preserving proofs:

```typescript
{
  chainId: 1,
  rpcProvider: 'colibri',  // KEEP existing provider for integrity
  obliviousProofServerUrl: process.env.OBLIVIOUS_PROOF_SERVER_URL, // ADD for privacy
  // ...rest unchanged...
}
```

---

## Composition Examples

### Colibri + Oblivious (recommended for Sepolia)

```
Colibri (ZK proofs from prover → integrity)
  └─ ObliviousProofOverlay
       ├─ Proofs from oblivious_node (TEE → privacy)
       └─ Local EVM execution (verified + private)
```

Config:
```typescript
{
  rpcProvider: 'colibri',
  obliviousProofServerUrl: 'https://proof.obliviouslabs.com',
}
```

### Helios + Oblivious (recommended for mainnet)

```
Helios (consensus light client → integrity)
  └─ ObliviousProofOverlay
       ├─ Proofs from oblivious_node (TEE → privacy)
       └─ Local EVM execution (verified + private)
```

Config:
```typescript
{
  rpcProvider: 'helios',
  obliviousProofServerUrl: 'https://proof.obliviouslabs.com',
}
```

### Plain RPC + Oblivious (fallback, integrity from RPC trust)

```
JsonRpcProvider (direct RPC → trusting the RPC for headers)
  └─ ObliviousProofOverlay
       ├─ Proofs from oblivious_node (TEE → privacy)
       └─ Local EVM execution (verified against RPC header)
```

Config:
```typescript
{
  rpcProvider: 'rpc',
  obliviousProofServerUrl: 'https://proof.obliviouslabs.com',
}
```

Note: This mode still provides privacy (the proof server doesn't see queries)
but integrity depends on the RPC being honest about headers.

---

## Failure Modes

| Failure | `failurePolicy: 'fallback'` | `failurePolicy: 'fail-closed'` |
|---------|----------------------------|-------------------------------|
| oblivious_node unreachable | Falls through to inner provider (loses privacy, keeps integrity) | Error thrown |
| Proof verification fails | Falls through to inner provider | Error thrown |
| Inner provider (Helios) not synced | Helios's own fallback kicks in first | Helios's own fallback kicks in first |
| State override eth_call | Always bypasses overlay (uses inner directly) | Same |

With `'fallback'` policy, the wallet gracefully degrades:
**Full stack** → verified + private → **Inner only** → verified → **RPC only** → unverified

---

## Settings UI — Enable/Disable Oblivious Server

The toggle appears in the **NetworkForm** component, below the RPC verifier section
(next to where Helios and Colibri settings already live).

### What the user sees

```
RPC verifier
  ○ Unverified (not trustless)
  ○ verified by Helios (LightClient)
  ○ verified by Colibri (Stateless Client)

Privacy overlay                              ← NEW SECTION
  ☑ Oblivious Proof Server (Privacy)
    State proofs fetched privately via TEE —
    the server cannot see your queries

  Oblivious Proof Server URL                 ← shown when enabled
  ┌──────────────────────────────────────┐
  │ http://127.0.0.1:8545               │
  └──────────────────────────────────────┘
```

When the checkbox is **off**, `obliviousProofServerUrl` is empty and `getRpcProvider`
creates the inner provider without wrapping. When **on**, the URL is saved to the
network config and the overlay is applied at provider creation time.

### Files to modify for the Settings UI

#### 1. `kohaku-commons/src/interfaces/network.ts`

Add the optional field to `Network` and `AddNetworkRequestParams`:

```typescript
export interface Network {
  // ...existing fields...
  heliosCheckpoint?: string
  obliviousProofServerUrl?: string  // NEW
}

export interface AddNetworkRequestParams {
  // ...existing fields...
  heliosCheckpoint?: Network['heliosCheckpoint']
  obliviousProofServerUrl?: Network['obliviousProofServerUrl']  // NEW
}
```

#### 2. `NetworkForm.tsx` — add import

```typescript
import { isObliviousSupportedChain } from 'oblivious-execution-client'
```

#### 3. `NetworkForm.tsx` — add to form type

```typescript
type NetworkFormValues = {
  // ...existing fields...
  obliviousProofServerUrl: string  // NEW
}
```

#### 4. `NetworkForm.tsx` — add default/initial values

In `useForm()`:

```typescript
defaultValues: {
  // ...existing...
  obliviousProofServerUrl: '',
},
values: {
  // ...existing...
  obliviousProofServerUrl: selectedNetwork?.obliviousProofServerUrl || '',
}
```

#### 5. `NetworkForm.tsx` — add computed flag

After `canUseColibri`:

```typescript
const canUseOblivious = useMemo(() => {
  try {
    if (!chainIdValue) return false
    return isObliviousSupportedChain(BigInt(chainIdValue))
  } catch {
    return false
  }
}, [chainIdValue])
```

#### 6. `NetworkForm.tsx` — add JSX

After the `{shouldShowColibriFields && (...)}` block, add:

```tsx
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
        style={[styles.selectRpcItem, { height: 40 }]}
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
          onValueChange={(checked) => {
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
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            inputWrapperStyle={{ height: 40 }}
            inputStyle={{ height: 40 }}
            containerStyle={{ ...spacings.mb, flex: 1 }}
            label={t('Oblivious Proof Server URL')}
            placeholder="http://127.0.0.1:8545"
          />
        )}
        name="obliviousProofServerUrl"
      />
    )}
  </>
)}
```

#### 7. `NetworkForm.tsx` — add URL validation

In the `watch()` subscription effect, add:

```typescript
if (name === 'obliviousProofServerUrl') {
  if (!value.obliviousProofServerUrl) {
    clearErrors('obliviousProofServerUrl')
    return
  }
  try {
    const url = new URL(value.obliviousProofServerUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      setError('obliviousProofServerUrl', {
        type: 'custom-error',
        message: 'URL must start with http:// or https://'
      })
      return
    }
  } catch {
    setError('obliviousProofServerUrl', { type: 'custom-error', message: 'Invalid URL' })
    return
  }
  clearErrors('obliviousProofServerUrl')
}
```

#### 8. `NetworkForm.tsx` — wire into dispatch

In `MAIN_CONTROLLER_ADD_NETWORK` params, add:

```typescript
obliviousProofServerUrl: networkFormValues.obliviousProofServerUrl,
```

In `MAIN_CONTROLLER_UPDATE_NETWORK` params.network, add:

```typescript
obliviousProofServerUrl: networkFormValues.obliviousProofServerUrl,
```

#### 9. `NetworkForm/helpers.ts` — track changes

In `getAreDefaultsChanged`, the existing logic already handles string fields.
The `obliviousProofServerUrl` field will be detected as changed automatically
because the fallback check `values[key] !== selectedNetwork[key]` covers it.

---

## CSP Compatibility

The oblivious execution client uses:
- `@noble/hashes` for keccak256 — pure JS, no WASM, CSP-safe
- No `eval()` or dynamic code generation
- No WebAssembly (the EVM runs in pure TypeScript)

Compatible with the extension's CSP:
```
script-src 'self' 'wasm-unsafe-eval'
```

If revm-WASM replaces the TypeScript EVM later, `wasm-unsafe-eval` is already permitted.

---

## Testing

1. Start `oblivious_node` locally:
   ```bash
   cd oblivious_node && cargo run -p eth_privatestate --release
   ```

2. Load test state via admin endpoints (see `integration.rs` in the repo).

3. Set `.env`:
   ```
   RPC_PROVIDER=colibri
   OBLIVIOUS_PROOF_SERVER_URL=http://127.0.0.1:8545
   ```

4. Build: `yarn web:webkit`

5. Load in Chrome. The overlay wraps the Colibri provider automatically.
   State reads (balance, storage, eth_call) now go through oblivious_node
   for proofs while headers come from Colibri.
