# 02 — Does `@proofowl/contract-sdk` run in a browser? (proven)

Not inferred from `package.json` — a throwaway Vite project was built and
run in real headless Chrome against the live v0.3 testnet contract.

## What the package.json / source review flagged first

`@proofowl/contract-sdk` @ `0.2.0`:
- `"type": "module"`, `"engines": { "node": ">=22.6.0" }`, single `exports`
  entry `"."` → `./dist/index.js`. **No `browser` field, no `module`
  condition, no subpath exports.** A consumer importing `createReadClient`
  from the package root pulls the whole barrel, including `identifiers.js`.
- dep: `@stellar/stellar-sdk@^16.0.1` (resolves to **16.3.0**).
- `src/identifiers.ts`: `import { createHash } from "node:crypto"` — a hard
  Node built-in, used for all the SHA-256 hashing helpers.
- `src/client.ts` + `src/generated/index.ts`: use `Buffer` (`Buffer.from`,
  `.toString("hex")`). The generated bindings do
  `import { Buffer } from "buffer"` (userland pkg) and, in a browser, set
  `window.Buffer = window.Buffer || Buffer`.

## Step 1 — `vite build` with NO polyfill config → HARD FAIL

```
[plugin vite:resolve] Module "node:crypto" has been externalized for
  browser compatibility, imported by ".../dist/identifiers.js".
✗ Build failed
  "createHash" is not exported by "__vite-browser-external",
  imported by ".../dist/identifiers.js".
  13: import { createHash } from "node:crypto";
```

Reproduced identically with the SDK installed two ways (local `file:` link,
and `npm pack` tarball). This is a build-time failure, not a runtime
warning. Because `exports` only exposes `.`, you cannot sidestep it by
importing `dist/client.js` directly.

## Step 2 — minimal shim

One Vite `resolve.alias`:

```js
resolve: {
  alias: [
    { find: /^node:crypto$/,
      replacement: "./shims/node-crypto.js" }, // ~20 lines: createHash("sha256") via @noble/hashes
  ],
}
```

`@noble/hashes` is already in the tree (transitive dep of
`@stellar/stellar-sdk`). `crypto-browserify` + `vite-plugin-node-polyfills`
also work but pull far more; `vite-plugin-node-polyfills` additionally
mis-resolved its own `shims/buffer` import when the SDK was a linked
package (fixed by installing the SDK as a real tarball, but the one-alias
approach avoids the whole class of problem).

**Not needed:** `Buffer` polyfill, `global`, `process`, `stream`, `util`,
`events`. With Vite 6 + stellar-sdk 16.3 the `buffer` userland package
resolves cleanly and the generated bindings self-install `window.Buffer`.
`typeof globalThis.Buffer` was already `"function"` before the read client
was even constructed.

> Caveat: this covers the **read path only** (`createReadClient`). The
> `prepare*` transaction-builder helpers pull in more of stellar-sdk
> (`TransactionBuilder`, XDR, `Keypair`); they may surface additional
> browser needs. That path was not exercised here because the wallet, not
> the SDK, does the signing (see [`03`](./03-wallet-connection.md)) — but
> the frontend will still import `prepareLinkGithub` to assemble the tx,
> so this needs its own check when wallet-linking is built.

## Step 3 — run it in real headless Chrome, against the live contract

`vite build` (succeeds, ~381 KB raw / ~101 KB gzip for the read path),
served via `vite preview`, loaded in `/Applications/Google Chrome.app`
headless via `puppeteer-core`. Target: `CAIDTSVP…` on
`https://soroban-testnet.stellar.org`, wallet
`GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER` (the e2e-demo
wallet).

| Call | Returned | Expected (from `e2e-demo.md` §C7/§D) | Result |
|---|---|---|---|
| `getReputationScore(wallet)` | `50` | `50` | ✅ match |
| `getAttestationCount(wallet)` | `1` | `1` | ✅ match |
| `getGithubForWallet(wallet)` | `6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51` | same hash | ✅ match |
| `getAttestationsPage(wallet, 0, 50)` | **threw** | one entry | ❌ decode bug (below) |

Console (verbatim, trimmed):

```
typeof globalThis.Buffer BEFORE client: function
typeof globalThis.Buffer AFTER  client: function
getReputationScore -> 50
getAttestationCount -> 1
getGithubForWallet -> 6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51
getAttestationsPage -> THREW: ScSpecType scSpecTypeU64 was not string or symbol, but { ... "_switch": { "name": "scvString" ... } "_value": { "type": "Buffer", "data": [112,114,111,111,102,111,119,108,47,98,97,99,107,101,110,100] } }
PROBE_RESULT {"ok":true,"score":50,"count":1}
```

(`[112,114,111,…]` is ASCII `"proofowl/backend"` — the `repo` field the
decoder choked on.)

## Findings

1. **The read client works in a browser** after a single one-line alias
   shim for `node:crypto`. Live scalar reads returned correct values from
   a real browser against the real contract.
2. **No `Buffer`/Stellar-SDK polyfill gymnastics were required** with the
   current Vite — contrary to the usual expectation for Stellar SDKs. This
   should be re-verified if the SDK bumps `@stellar/stellar-sdk` or the
   frontend uses a different bundler (Webpack 5 needs explicit
   `fallback`/`ProvidePlugin` for `buffer`; esbuild-only setups differ).
3. **`getAttestation` / `getAttestationsPage` are broken in the SDK today**
   — the `ScSpecType scSpecTypeU64` decode bug, identical in browser and
   Node, already worked around in `proofowl-backend`. The frontend's
   passport-history view needs the same `scValToNative` shim (port
   `proofowl-backend/src/chain/attestationDecode.ts`), or must wait for an
   SDK release on a newer `@stellar/stellar-sdk`. **Scalar reads
   (score, count, link lookups) are unaffected and safe to build on now.**
4. `@proofowl/contract-sdk` is `"private": true` and unpublished — the
   frontend consumes it via a workspace path / git dependency / `npm
   pack`, not the npm registry.

## Reproduction (throwaway; not committed)

Scratch project: `vite@6`, SDK via `npm pack` tarball,
`@stellar/stellar-sdk@^16` as a direct dep, the `node:crypto` alias shim,
`puppeteer-core` driving system Chrome. `index.html` + `src/main.js` call
the four functions above and stash the result on `window.__PROBE__`.
Deleted after this write-up; recreate from this section if needed.
