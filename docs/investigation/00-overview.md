# 00 — Investigation overview

**Date:** 2026-09-09
**Purpose:** confirm real technical facts before any `proofowl-frontend`
application code is written. Investigation only — nothing was scaffolded,
no architectural decision was made under this task's authority.

**Method:** read the sibling repos (`../proofowl-contracts`,
`../proofowl-backend`) directly; ran a throwaway Vite build + headless
Chrome page against the live SDK and the live testnet RPC; queried the
public Soroban testnet RPC's `getEvents` directly; checked current wallet
packages on npm and current Stellar docs. Throwaway test project lives in
a scratch dir, not committed.

---

## The hard facts (one page)

### Contract
- **Live v0.3 testnet contract ID:** `CAIDTSVPQICTA2VLE6BSQYHEELHGPZWQDYWKSDBRW4LYPZH6Q44UTAOA`
  (crate `0.3.0`, deployed 2026-09-07T12:36:42Z at **ledger 4552203**).
  Confirmed identical in three sources: `proofowl-contracts` README
  "Deployed contracts" table, `docs/testnet/phase2-v0.3-alpha.md`, and
  `proofowl-backend/docs/testnet/e2e-demo.md`.
- Network: testnet, RPC `https://soroban-testnet.stellar.org`, passphrase
  `Test SDF Network ; September 2015`, protocol 28.
- Current on-chain attestor (after a 2026-09-07 rotation):
  `GAVHDK6V2LBGBCBWIZXEHDJAW6ZZKPCKLDANURKJZU4NFDCAV2BYFXEF`. The frontend
  must feed this exact address into the SDK's `prepareLinkGithub`.
- Two older instances (v0.1 `CCJ7DVU2…`, v0.2 `CBNEX2CF…`) are still live
  but speak older ABIs — do **not** point the frontend at them.

### Browser SDK — proven, not assumed
- `@proofowl/contract-sdk` (`0.2.0`, dep `@stellar/stellar-sdk@^16.0.1`,
  actually resolves 16.3.0) **does not bundle for the browser out of the
  box.** `vite build` fails hard: `identifiers.ts` does
  `import { createHash } from "node:crypto"`, which Vite externalizes and
  then the named import throws `"createHash" is not exported by
  __vite-browser-external"`. The package's only `exports` entry is `.`, so
  a consumer can't dodge it by deep-importing just the read client — the
  barrel drags `identifiers.ts` in.
- **Minimal shim that fixed it:** one Vite `resolve.alias` mapping
  `node:crypto` → a ~20-line local `createHash("sha256")` backed by
  `@noble/hashes` (already present transitively). **No `Buffer` polyfill
  was needed** — the SDK's generated bindings `import { Buffer } from
  "buffer"` (the userland package, hoisted via stellar-sdk) and self-assign
  `window.Buffer`. No `global`/`process`/`stream` polyfill needed for the
  read path.
- With that one alias, a **real headless-Chrome page** hit the live v0.3
  contract and returned real data:
  - `getReputationScore("GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER")` → **`50`** (expected 50 ✓)
  - `getAttestationCount(...)` → **`1`** ✓
  - `getGithubForWallet(...)` → `6054b7be…071a51` ✓ (matches the e2e demo)
- **But `getAttestationsPage()` / `getAttestation()` throw** — same in the
  browser as in Node — with
  `ScSpecType scSpecTypeU64 was not string or symbol, but {scvString …}`.
  This is a **known, documented decode bug** in `@stellar/stellar-sdk` 16.x
  against the v0.3 `Attestation` struct; `proofowl-backend` already carries
  a `scValToNative` shim (`src/chain/attestationDecode.ts`) for exactly
  this. The frontend will need the same shim to render passport history.
- Read-path bundle weight: ~381 KB raw / ~101 KB gzip.

### Wallet connection
- **Current standard:** `@creit.tech/stellar-wallets-kit` — latest
  **2.6.0**, published **2026-08-28**. Multi-wallet (Freighter, xBull,
  Albedo, Rabet, Lobstr, Hana, WalletConnect, Ledger, hardware, …) behind
  one API, with a built-in connect modal.
- **It supports the flow this project needs.** v2.6.0 exposes both
  `signTransaction(xdr, {networkPassphrase, address})` and
  `signAuthEntry(authEntry, {networkPassphrase, address})`. The
  auth-entry method is exactly what the two-party `link_github` needs —
  the frontend collects the contributor wallet's Soroban auth-entry
  signature, the backend adds the attestor's. Method shapes line up
  drop-in with the SDK's `AssembledTransaction.sign()` /
  `.signAuthEntries()`.
- Stellar's own docs still point at **Freighter** (`@stellar/freighter-api`
  6.0.1) as the reference browser wallet for `signAuthEntry` on Soroban
  invocations; the Wallets Kit wraps it.

### Leaderboard — the critical open question
- The public testnet RPC keeps a **live, rolling ~7-day event window**
  (~120,980 ledgers). Observed the retention floor advance from ledger
  4457027 → 4457052 → 4457056 over a few minutes. `startLedger` below the
  floor is a hard RPC error (`-32600 startLedger must be within the ledger
  range: <floor> - <latest>`).
- **Today, the entire v0.3 history IS inside the window.** Deploy ledger
  4552203 sits ~95k ledgers above the current floor. A cursor-paginated
  `getEvents` scan from the deploy ledger returned **all 13 events** the
  contract has emitted so far (ledgers 4552203–4577318).
- **The constraint:** that deploy ledger falls out of retention **around
  2026-09-14** (deploy + ~7 days). After that, a cold `getEvents` scan can
  never reconstruct the early history — there is no RPC path to events
  older than the window. And the contract is documented "disposable; may
  be replaced." So a live-`getEvents` leaderboard works *now* but is
  structurally fragile.
- `getEvents` pagination gotcha (hit during testing): a short page — even
  **zero** events — does **not** mean end-of-stream. Each request scans a
  bounded ledger span; you must follow `result.cursor` until it stops
  advancing / reaches `latestLedger`, or you silently miss events.

Options for the leaderboard are laid out in
[`04-leaderboard-feasibility.md`](./04-leaderboard-feasibility.md) — no
recommendation is made here.
