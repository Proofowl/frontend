# proofowl-frontend

A **read-only** web explorer for [ProofOwl](https://github.com/Proofowl/proofowl-contracts) —
the on-chain contributor-reputation registry. It simulates contract
reads and, for “view my passport”, asks a wallet extension for its
public address. **It never signs or submits anything.**

Built with Next.js (App Router) + TypeScript.

## What ships in this version

| Route                | What it is                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/`                  | Landing / explainer — the problem, the solution, the trust boundaries (substance from the contracts README).  |
| `/passport`          | Search by wallet address **or** GitHub handle. A handle is resolved to its numeric id and hashed client-side. |
| `/passport/[wallet]` | Reputation score, attestation count, current linked identity, and the full paginated attestation history.     |
| `/leaderboard`       | An honest “not available yet” — no sample data. Explains what a real leaderboard needs.                       |
| `/link`              | How the two-party linking flow works, in plain language, with links to the CLI flow in proofowl-backend.      |

**Deliberately excluded from this version:** any interactive
wallet-linking submission flow (it needs the attestor’s co-signature,
which only the backend can provide), and any real leaderboard (it needs
a standing event-indexing service that does not exist yet). There are no
stubs that look functional but aren’t.

## Setup

No sibling checkout, no local SDK build. `@proofowl/contract-sdk` is a
normal npm dependency (`^0.3.0`, published to the public registry), so a
single install is all it takes:

```sh
npm ci
npm run dev            # http://localhost:3000
```

Node **≥ 22.6** (CI uses 24).

Zero `.env` is required — `src/lib/config.ts` ships working testnet
defaults (v0.3 contract `CAIDTSVP…`, `soroban-testnet.stellar.org`). To
point at a different instance, copy `.env.example` to `.env.local` and
edit.

## Deployment

This repo is now deployable. The earlier blocker — `@proofowl/contract-sdk`
was a `file:` path to a sibling folder that does not exist in a hosted
build environment — is gone now that the SDK installs from npm; `npm ci`

- `next build` runs anywhere. **Standing up the actual Vercel project
  (import, env, domain) is a separate task; this repo only removes the
  blocker.**

## Configuration — public values only

`.env.example` documents three `NEXT_PUBLIC_*` vars: the contract id, the
RPC URL, the network passphrase. **Every one is public** and safe both to
commit and to ship to the browser (the `NEXT_PUBLIC_` prefix does the
latter, which is correct here — on-chain reads run client-side). The
mainnet passphrase is rejected at startup; this is a testnet explorer.

## Security — no private key, ever

**This repo must never contain a private key of any kind** — no
`ATTESTOR_SECRET_KEY`, no wallet seed phrase, no keystore file.

- It is a **public, client-side app**. Anything it holds is shipped to
  every visitor’s browser.
- It has **no server-side signing path** — nothing here builds, signs,
  or submits a transaction or a Soroban auth entry. An ESLint rule
  (`no-restricted-syntax` in `eslint.config.mjs`) bans the wallet
  `signTransaction` / `signAuthEntry` / `signMessage` /
  `signAndSubmitTransaction` identifiers project-wide, so a signing flow
  cannot be added by accident.
- The only wallet interaction is `connectForAddress()` in
  `src/lib/wallet/connect.ts`, which calls the wallet kit’s `init` /
  `authModal` / `getAddress` and reads the connected **public address**
  and nothing else.

Attestation submission and the attestor key live in
[proofowl-backend](https://github.com/Proofowl/backend), never here.

## How it talks to the chain

- **Reads run in the browser** via `@proofowl/contract-sdk`’s
  `createReadClient` (see `docs/investigation/02-browser-sdk-proof.md`).
- **Bundler shim:** the SDK barrel pulls in `identifiers.ts`’s
  `import { createHash } from "node:crypto"`, and this app’s own ported
  hashing module does the same. `next.config.ts` aliases `node:crypto`
  (client build only) to `src/lib/hashing/sha256-browser.ts`, a ~40-line
  `createHash("sha256")` over `@noble/hashes`, plus a
  `NormalModuleReplacementPlugin` for the `node:` scheme and a
  `ProvidePlugin` for `Buffer`. Proven with a live read by
  `npm run smoke` (below).
- **Decode shim:** `@stellar/stellar-sdk` 16.x mis-decodes the v0.3
  `Attestation` struct (`ScSpecType scSpecTypeU64 …`).
  `src/lib/chain/attestationDecode.ts` is a verbatim port of
  proofowl-backend’s `src/chain/attestationDecode.ts` — it keeps the
  SDK’s generated client for the RPC round-trip and swaps only the final
  ScVal→JS step for `scValToNative`. Remove it when the SDK bumps
  `@stellar/stellar-sdk`.
- **Canonical hashing** (`src/lib/hashing/identifiers.ts`) is a verbatim
  port of proofowl-backend’s module and is pinned against both the
  `identifier-spec-v1` vectors and the SDK’s own exports in
  `src/lib/hashing/identifiers.test.ts`.

## Scripts

| Command             | What it does                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`       | Next dev server.                                                                                                                                                                                                                            |
| `npm run build`     | Production build.                                                                                                                                                                                                                           |
| `npm run lint`      | `eslint .`                                                                                                                                                                                                                                  |
| `npm run typecheck` | `tsc --noEmit`                                                                                                                                                                                                                              |
| `npm test`          | Vitest — the framework-free logic modules (hashing, decode, resolution).                                                                                                                                                                    |
| `npm run check`     | `format:check` + `lint` + `typecheck` + `test`.                                                                                                                                                                                             |
| `npm run smoke`     | **Local only.** Starts the dev server, opens `/passport/<demo wallet>` in headless Chrome, asserts the live reputation score renders as `50`. Needs a Chrome binary (`CHROME_PATH` to override); skips cleanly without one. Not part of CI. |

## Grounding

`docs/investigation/00-04` — the technical facts this build rests on
(browser-SDK proof, wallet tooling, event-retention findings), confirmed
against the live testnet contract before any UI was written.
