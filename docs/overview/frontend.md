# proofowl-frontend — this repo's role in the whole system

This is the public, read-only web explorer for ProofOwl. Its own
[`README.md`](../../README.md) is the authority on running and building
it; this document places it in the three-repo picture and is explicit
about what it deliberately does _not_ do.

Stack: Next.js 15 (App Router) + React 19 + TypeScript. Reads run
**in the browser** against the live v0.3 testnet contract via
`@proofowl/contract-sdk`'s `createReadClient`.

---

## The one hard rule

**This repo never signs or submits anything, and never holds a private
key of any kind.** It is a public, client-side app — anything it holds
ships to every visitor's browser. There is no server-side signing path.
An ESLint `no-restricted-syntax` rule bans the wallet
`signTransaction` / `signAuthEntry` / `signMessage` /
`signAndSubmitTransaction` identifiers project-wide, so a signing flow
cannot be added by accident. The only wallet interaction is
`connectForAddress()` in `src/lib/wallet/connect.ts`, which reads the
connected wallet's **public address** and nothing else.

Attestation submission and the attestor key live in
[`proofowl-backend`](https://github.com/Proofowl/backend), never here.

---

## What ships in this version

| Route                | What it is                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | Landing / explainer — the problem, the solution, the trust boundaries. Substance drawn from the contracts README and `SECURITY.md`.                                                                                                                                                                                                                                              |
| `/passport`          | Search by wallet address **or** GitHub handle. A handle is resolved to its numeric id via `api.github.com` (unauthenticated), then hashed client-side to a `github_id_hash` and looked up on-chain with `get_wallet_for_github`. Every distinct outcome — unknown handle, valid handle not linked, rate-limited, wallet is a bad strkey — is its own state with its own wording. |
| `/passport/[wallet]` | Reputation score, attestation count, the currently-linked identity hash, and the full **paginated** attestation history (`get_attestations_page`, "load more" in pages of 50). Each row rebuilds the PR URL from the cleartext `repo` + `pr_number` and recomputes `pr_hash` client-side to show a "pr_hash verified" / "mismatch" badge.                                        |
| `/leaderboard`       | An honest **"not available yet"** — no sample data standing in for a real one. Explains what a real leaderboard needs.                                                                                                                                                                                                                                                           |
| `/link`              | How the two-party linking flow works, in plain language, pointing at the CLI flow in the backend README and `contract-api-v2.md`. Shows the current on-chain attestor for reference, with the caveat that `get_attestor()` is authoritative.                                                                                                                                     |

### How it talks to the chain

- **Reads run client-side** via `createReadClient` — proven, not
  assumed: `docs/investigation/02-browser-sdk-proof.md` ran a real
  headless-Chrome page against the live contract.
- **Browser bundler shim.** The SDK barrel pulls in its
  `identifiers.ts`, which does `import { createHash } from "node:crypto"`;
  this app's own ported hashing module
  (`src/lib/hashing/identifiers.ts`) does the same. `next.config.ts`
  aliases `node:crypto` (client build only) to
  `src/lib/hashing/sha256-browser.ts` — a ~40-line `createHash("sha256")`
  over `@noble/hashes` — plus a `NormalModuleReplacementPlugin` for the
  `node:` scheme and a `ProvidePlugin` for `Buffer`. `npm run smoke`
  (local only) proves the whole client path with one live read.
- **Canonical hashing is a verbatim port** of `proofowl-backend`'s
  module — same discipline the backend follows: keep an independent
  implementation and pin it in tests against both the
  `identifier-spec-v1` vectors and the SDK's own exports, so a
  divergence fails CI rather than surfacing as a bad lookup.

See [`sdk-and-integration.md`](./sdk-and-integration.md) for why the
consumer-side attestation-decode shim this repo used to carry is now
gone.

---

## What is deliberately deferred, and why

### Interactive wallet linking

There is no button here that completes a `link_github`. Linking is a
**two-party** contract call (ADR 0002): it needs the attestor's
auth-entry co-signature, which only the backend can produce, and only
_after_ its own GitHub OAuth / challenge flow. This repo cannot sign
anything at all, and the backend has no OAuth flow yet. A button that
silently failed would be worse than no button. The `/link` page explains
the CLI flow instead.

The investigation confirmed the _tooling_ for an eventual interactive
flow is real: `@creit.tech/stellar-wallets-kit` (v2.6.0) exposes
`signAuthEntry`, whose shape plugs into the SDK's
`AssembledTransaction.signAuthEntries()` and the ProofOwl SDK's
`prepareLinkGithub` with no glue code
(`docs/investigation/03-wallet-connection.md`). It is deferred on the
missing backend half, not on a client-side unknown.

### A real leaderboard

A leaderboard is a **cross-wallet** aggregation problem: the contract
has no "list all wallets" read, so you only learn a wallet exists by
having seen its events. The public Soroban testnet RPC keeps events in a
**rolling ~7-day window** (`docs/investigation/04-leaderboard-feasibility.md`
measured it: ~120,980 ledgers, sliding forward continuously). A
leaderboard built on live `getEvents` scans would be correct today and
then **silently go partial** as history ages out — a wallet whose
activity fell out of range would just stop appearing, with no error, its
on-chain score still correct and unreachable to the ranking. Doing this
properly needs a standing event-indexing service that has been
persisting since a contract's deployment. **No such service exists** —
`proofowl-contracts`' own `phase2-v0.3-alpha.md` Part D and
`proofowl-backend` both say so. Rather than ship a ranking that quietly
rots, this version leaves it out and says why on the page.

**There are no stubs that look functional but aren't.**

---

## Current deployability state

The repo **is deployable**. The earlier blocker —
`@proofowl/contract-sdk` was a `file:` path to a sibling checkout absent
from a hosted build environment — is gone: the SDK now installs from the
npm registry (`^0.3.0`), so a plain `npm ci` followed by `next build`
runs anywhere. CI (`.github/workflows/ci.yml`) is a single job:
`npm ci` → `format:check` → `lint` → `typecheck` → `test` → `build`, on
Node 24, with no cross-repo checkout.

Zero `.env` is required — `src/lib/config.ts` ships working testnet
defaults (contract `CAIDTSVP…`, `soroban-testnet.stellar.org`, the
testnet passphrase). Every configurable value is a public
`NEXT_PUBLIC_*` var. The Stellar **mainnet** passphrase is rejected at
startup — this is a testnet explorer by construction.

**Standing up the actual hosting project (import, env vars, domain) is a
separate task that has not been done.** This repo removes the blocker;
it does not itself deploy.

---

## Relationship to `docs/investigation/`

`docs/investigation/00`–`04` are a **dated historical record** (2026-09-09)
of the technical facts this build rests on, confirmed against the live
testnet contract before any UI was written. They are a point-in-time
snapshot and are not maintained — in particular, they describe
`@proofowl/contract-sdk` as an unpublished `0.2.0` package needing a
consumer-side decode shim, which was true when they were written and
changed hours later (see
[`sdk-and-integration.md`](./sdk-and-integration.md)). This
`docs/overview/` directory is the current, maintained picture; the
investigation records are left exactly as they were.

---

↑ [Project overview](./README.md) · [contracts](./contracts.md) · [backend](./backend.md) · [frontend](./frontend.md) · [SDK & integration](./sdk-and-integration.md) · [data-flow walkthrough](./data-flow-walkthrough.md) · [roadmap / status](./roadmap-status.md) · [known limitations](./known-limitations.md) · [glossary](./glossary.md)
