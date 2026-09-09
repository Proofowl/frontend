# proofowl-contracts — deep dive

Repo: <https://github.com/Proofowl/proofowl-contracts> · read at commit
`9fd88d0` (2026-09-09).

The Soroban smart contract and everything that describes it: the
integration spec, the architecture decision records, the security
package, the testnet evidence records, and — under `sdk/typescript/` —
the published `@proofowl/contract-sdk` TypeScript package. This is the
**on-chain source of truth** for the whole project.

---

## Purpose

The contract is a minimal registry of two things: **wallet ↔ GitHub
identity links** and **per-contribution attestations**, plus a running
reputation score and permanent global de-duplication of already-credited
pull requests. It has no network access, so it cannot verify GitHub
itself — it enforces authorization procedure and stores verified facts;
everything about *proving* GitHub ownership happens off-chain (the
backend) and is vouched for on-chain by the attestor co-signature.

The contract crate is at version **`0.3.0`**. `src/lib.rs` is the real
behaviour; the deployed WASM's embedded spec is authoritative once an
instance exists; `docs/integration/contract-api-v2.md` is the prose
description of both.

---

## Key design decisions (from the repo's own ADRs)

`docs/adr/` holds five accepted ADRs. In brief:

### ADR 0001 — the attestor resolves the wallet, it never chooses it

`submit_attestation` takes a `github_id_hash`, **not** a wallet address.
The contract resolves the credited wallet itself, via the on-chain link
that `link_github` created. Consequence: a compromised or careless
attestor key can forge *that* a contribution happened or misreport its
complexity, but it **cannot** redirect credit to a wallet the GitHub
identity has not itself linked. The trade-off: you cannot attest for a
contributor who has not linked a wallet yet — that is what the backend's
queue is for.

### ADR 0002 — links require wallet **and** attestor authorization

An earlier design let a wallet link itself to any `github_id_hash` with
a single signature. That let anyone squat `hash("torvalds")` and have
every future attestation for that identity resolve to the squatter's
wallet. `link_github` and `unlink_github` are now **two-party**:
`wallet.require_auth()` *and* `attestor.require_auth()`, with the
caller-supplied attestor checked against the stored one. The attestor
co-signs only after its own off-chain GitHub OAuth / challenge flow. The
cost: linking now needs the contributor and the backend to co-sign one
transaction. Recovery from a *lost* wallet key is deliberately out of
scope — an attestor override would reintroduce exactly the redirect
power ADR 0002 removes.

### ADR 0003 — initialization is a deploy-time constructor, not `init`

There is **no `init` function**. `__constructor(admin, attestor)` runs
inside the `CreateContract` host operation, in the same transaction that
creates the instance, and calls `admin.require_auth()`. This closes an
initialization-takeover window: a front-runner who deploys their own
copy only gets a *different* contract id. Configuration is passed as
`stellar contract deploy … -- --admin <A> --attestor <B>`; there is no
follow-up call.

### ADR 0004 — paginated per-attestation storage (v0.2)

v0.1 kept a wallet's whole history in one `Vec<Attestation>` entry.
Phase-4 resource testing measured a hard ceiling: **286 attestations
succeed, the 287th fails outright** (the entry exceeds Soroban's
65,536-byte per-entry limit), after which that wallet is permanently
stuck with no admin override. v0.2 replaces this with **one persistent
entry per attestation** plus fixed-size `AttestationCount` and
`ReputationScore` counters. Reads become bounded: `get_attestation`
(O(1)), `get_attestations_page` (`limit` 1..=`MAX_PAGE_SIZE` = 50).
`get_reputation_score` becomes an O(1) counter read instead of a
re-fold. The unbounded `get_attestations` and `bump_wallet_ttl` are
**removed** (not silently redefined); TTL upkeep is now
`bump_wallet_core_ttl` (O(1)) + a paginated
`bump_attestations_ttl_page` sweep. Error codes 10–13 were appended;
1–9 keep their exact v0.1 meaning.

### ADR 0005 — reputation persists across a wallet's relink, tagged per-identity

Property-based fuzz testing surfaced a mirror-image of the ADR 0002
scenario: because storage is keyed **purely by wallet address**, a
wallet that links identity A, earns points, unlinks, then links identity
B shows its *full* history under B too. Options weighed: reset on unlink
(rejected — punishes legitimate recovery), admin-gated relink (rejected
— reverses self-sovereignty), or **tag each attestation with the
identity active when it was recorded** (accepted). `Attestation` and the
`AttestationRecorded` event gained a `github_id_hash` field.
`get_reputation_score` is **unchanged** — still a full aggregate across
every identity. The tag lets a reader *break down* the aggregate; it
does not stop the full history from being readable under a new identity.
This is a **breaking storage-schema change**, and is why the crate went
`0.2.0` → `0.3.0`.

---

## Current live deployment state

**Testnet only. No mainnet instance exists, ever, for any version.** All
accounts are disposable and friendbot-funded. Three instances coexist
on testnet — nothing was torn down:

| Version | Contract ID | Source | Deployed | Notes |
|---|---|---|---|---|
| **v0.3 (crate `0.3.0`)** — current, matches `src/` | `CAIDTSVPQICTA2VLE6BSQYHEELHGPZWQDYWKSDBRW4LYPZH6Q44UTAOA` | `ab95af6` | 2026-09-07T12:36:42Z, ledger **4552203** | WASM SHA-256 `b407cca4…8ff11b4bd`, reproducible-build-verified and matched on-chain. Carries `Attestation.github_id_hash`. **"Disposable; may be replaced."** This is the instance all three repos target. |
| v0.2 (crate `0.2.0`) — superseded | `CBNEX2CFAKMX2JH24EX2ZJOMKV6KQ5UE5NXAYCN2A2S72IVMFLNWIGC4` | `aa65426` | 2026-09-07 | Paginated storage, **no** `github_id_hash`. Still live, unedited, as history. |
| v0.1 — superseded | `CCJ7DVU2XYVFNZMHN4VPCYSPJ7HW4RPI544XG5TG42ZX7TDSUIL3SKP6` | `d030908` | 2026-09-01 | Unbounded v0.1 ABI. Still live, unedited, as history. |

Do not point a client at the two older instances — they speak older
ABIs.

### Deployment evidence

`docs/testnet/phase2-v0.3-alpha.md` is the primary record for the
current instance: build environment, the create+constructor tx
`efe337a2…`, the on-chain WASM-hash match, config verification
(`get_admin` / `get_attestor`), and a hand-run smoke sequence that
specifically exercises identity tagging — link identity A → attest
(complexity 100, seq 0) → unlink → relink the **same wallet** to
identity B → attest (complexity 150, seq 1) → read both records back
(two distinct `github_id_hash` values) → `get_reputation_score` = 250 →
negative cases (`InvalidComplexity` #8, `DuplicateAttestation` #6 across
identities) both rejected at simulation.

### Attestor rotation

On **2026-09-07T20:13:42Z** (ledger 4557687, tx `ba28897c…`), the v0.3
instance's attestor was rotated:

- **old** `GD4AV554CBCMUXSVKSJG35J6OHJMCYAP56VZEBVBC5YFYPMB7ZSNC3VW` —
  the identity used for manual CLI smoke-testing since v0.1;
- **new** `GAVHDK6V2LBGBCBWIZXEHDJAW6ZZKPCKLDANURKJZU4NFDCAV2BYFXEF` —
  a dedicated identity for `proofowl-backend`'s automated submission
  pipeline.

Admin (`GDHGAVUNEGGKBL5Z6PIDK3KXQO42J7SHFIHYYT22W5YCV5UQ6DQV5CY6`) was
unchanged. **The two older instances still have the old attestor** and
were not touched. Any client that builds a `link_github` transaction
must use whatever `get_attestor()` returns live, not a hardcoded value —
`docs/testnet/attestor-rotation-log.md` is the record.

---

## The published SDK's role

`sdk/typescript/` is `@proofowl/contract-sdk` (version `0.3.0`). It is a
typed, **read-only, non-signing** consumer of the contract:

- `createReadClient(config)` — view-method calls (score, count, link
  lookups, `getAttestation` / `getAttestationsPage`), built with no
  signer and no public key, so it can only simulate.
- `prepare*` helpers — return **unsigned** `AssembledTransaction`s for
  the caller to sign and submit with its own signer; the two-party ones
  report which addresses still must sign. The SDK never signs, submits,
  or reads a keystore.
- Canonical hashing — `hashGitHubUserIdV1`, `normalizeGitHubPullRequest`,
  `hashGitHubPullRequestV1`, `verifyAttestationPrHash`, implementing
  `docs/integration/identifier-spec-v1.md` with pinned test vectors.
- Generated bindings under `src/generated/` are drift-checked in CI
  against the WASM.

Both `proofowl-backend` and this frontend depend on it from the npm
registry. Its version `0.3.0` "aligns the SDK minor with the contract
crate minor it now speaks." The two bugs fixed at its source on
2026-09-09, and the consumer-side shims that removal made redundant, are
covered in [`sdk-and-integration.md`](./sdk-and-integration.md).

---

## What the contract does *not* do

- No mainnet deployment; no upgrade path (immutability is accepted).
- No `set_admin` — a lost admin key permanently freezes the attestor at
  its current value.
- Single trusted attestor key (not yet a multisig / threshold scheme).
- No event indexer, no standing instance with a keep-alive job — the
  contract's own `phase2-v0.3-alpha.md` Part D says so explicitly.
- No independent third-party audit.

These and the rest are collected in
[`known-limitations.md`](./known-limitations.md) and tracked against the
gates in [`roadmap-status.md`](./roadmap-status.md).

---

↑ [Project overview](./README.md) · [contracts](./contracts.md) · [backend](./backend.md) · [frontend](./frontend.md) · [SDK & integration](./sdk-and-integration.md) · [data-flow walkthrough](./data-flow-walkthrough.md) · [roadmap / status](./roadmap-status.md) · [known limitations](./known-limitations.md) · [glossary](./glossary.md)
