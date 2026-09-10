# Roadmap / status — honest, phase by phase

This mirrors `proofowl-contracts/PRODUCTION_READINESS.md` (its own
go/no-go document) and `proofowl-contracts/docs/testnet/phase2-retrospective.md`
("criteria to advance to Phase 3"), read at 2026-09-09, and adds the
current state of the backend and this frontend. Where the contracts repo
recorded a gate, its verdict is quoted; the "backend / frontend" notes
are this overview's summary of those repos.

Legend: **done** · **partial** · **not started**

---

## The contract's own gates (`PRODUCTION_READINESS.md`)

| Gate                           | Contracts repo's verdict                                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Local validation**       | **GO**                                                             | `make check` (fmt, clippy `-D warnings`, wasm release build, full test suite, bounded-storage guard) green on the pinned Rust `1.91.0`.                                                                                                                                                                                                                                                                                                                                                |
| **2 — CI**                     | **GO with follow-ups**                                             | fmt / clippy / build / tests / supply-chain (`cargo deny`, `cargo audit`) all run. Open: GitHub Actions pinned to major tags, not commit SHAs (2.5).                                                                                                                                                                                                                                                                                                                                   |
| **3 — Testnet deployment**     | **GO, current**                                                    | v0.3 (crate `0.3.0`) disposable alpha deployed 2026-09-07, WASM-hash-verified, smoke-tested, matches `src/`. Superseded v0.2 and v0.1 alphas still live as history. Does **not** extend to a standing service or mainnet.                                                                                                                                                                                                                                                              |
| **4 — End-to-end integration** | **NO-GO** _(verdict text predates the repos existing — see below)_ | The integration spec and SDK exist and are tested. The verdict line still reads "the backend, indexer, and frontend do not" — written before those repos were created. In fact `proofowl-backend` and `proofowl-frontend` **now exist**, an end-to-end run is on record (`e2e-demo.md`), and item 4.5 ("frontend reads passports / leaderboard") is now partially met. No standing indexer exists. Treat Gate 4 as **partial**, not NO-GO, with the contracts repo's own text lagging. |
| **5 — Security review**        | **NO-GO for anything beyond testnet**                              | Internal threat model (16 categories), adversarial + state-machine + TTL + boundary test suites, and genuine property-based/fuzz testing done (Phase 4, 2026-09). That fuzz pass surfaced ADR 0005, now accepted and deployed. **No independent third-party audit** — a hard mainnet prerequisite.                                                                                                                                                                                     |
| **6 — Mainnet readiness**      | **NO-GO**                                                          | Every item is a hard prerequisite and all are NOT MET: Gates 1–5 GO, external audit, multisig/threshold attestor, hardware-signer admin custody, sustained testnet run with real backend+indexer traffic, per-wallet storage scaling reproduced live, incident-response runbook, written acceptance of immutability. Mainnet is out of scope for the current phase.                                                                                                                    |

One-line status the contracts repo gives itself: _the contract runs
correctly on Stellar testnet at crate `0.3.0` (one disposable alpha),
has been through an internal adversarial security-testing pass, and
nothing beyond that is ready — no external review, no audit, no
mainnet._

---

## "Criteria to advance to Phase 3" (`phase2-retrospective.md`)

Phase 2 = testnet alpha. Phase 3 = integration alpha with a real
backend/attestor. The retrospective listed eight criteria; status as of
2026-09-09:

| #   | Criterion                                                                                                        | Status                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Backend exists**, runs a real GitHub OAuth / challenge flow, holds the attestor key on separate infrastructure | **partial** — `proofowl-backend` exists; GitHub _verification_ (5 checks) is real; the **OAuth / challenge flow is not built**; the attestor key is an env var read at submit time, no dedicated infra. |
| 2   | **Canonical `pr_hash` derivation implemented and tested** in the backend, with a fixture test                    | **done** — implemented in `src/hashing/`, cross-checked against the SDK and spec vectors; exercised live in `e2e-demo.md` (`d07879a0…`).                                                                |
| 3   | **`set_attestor` rotation exercised on testnet** end to end                                                      | **done** — rotated on the v0.3 instance 2026-09-07 (ledger 4557687, tx `ba28897c…`); `attestor-rotation-log.md` records it. Older instances keep the old key.                                           |
| 4   | **A standing testnet instance** from a tagged commit, with a scheduled keep-alive and event monitoring           | **not started** — the v0.3 instance is explicitly _disposable_; no tag, no scheduled `bump_*` keep-alive, no monitoring.                                                                                |
| 5   | **An event indexer** (or documented stand-in) that can reconstruct a passport                                    | **not started** — `event-indexer-v2.md` specifies one; nobody has built it. Passports are reconstructed from _reads_ instead (backend REST API, this frontend).                                         |
| 6   | **Internal security review** of the contract + backend trust boundary written up                                 | **partial** — the contract side is done (Phase 4 package). A combined contract+backend trust-boundary write-up is not on record.                                                                        |
| 7   | **CI hardening follow-ups closed** — Actions pinned to commit SHAs                                               | **not started** — still major tags, across all three repos.                                                                                                                                             |
| 8   | **`make check` green and a fresh WASM build reproduces the deployed hash** for the Phase 3 commit                | **done** for the v0.3 deploy commit `ab95af6` (byte-identical two-run build → `b407cca4…`).                                                                                                             |

Phase 3 does **not** include mainnet; Gate 6 above is unchanged.

---

## Component status at a glance

| Component                | Done                                                                                                                                                                                                                                              | Partial                                                            | Not started                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Contract**             | v2/v0.3 ABI, two-party linking, attestor-resolved crediting, global PR de-dup, paginated storage, identity tagging, TTL upkeep primitives, deploy-time constructor, `set_attestor` (+ rotated once on testnet), internal adversarial/fuzz testing | —                                                                  | external audit, multisig attestor, mainnet, upgrade path (accepted as never)                                                               |
| **SDK**                  | published `0.3.0` on npm, read client, unsigned-tx prep, canonical hashing, drift-checked bindings, the two 2026-09-09 source fixes                                                                                                               | contracts README prose still says "nothing released to a registry" | —                                                                                                                                          |
| **Backend**              | GitHub verification (5 checks + self-merge flag), on-chain reads, testnet-only `submit_attestation` with safeguards, SQLite queue, automation pipeline, read-only REST API, one full e2e demo                                                     | trust-boundary security write-up                                   | GitHub OAuth flow, always-on worker, write API, leaderboard endpoint, dedicated attestor-key infra                                         |
| **Frontend** (this repo) | landing/explainer, passport search (wallet + handle), passport detail + paginated history + `pr_hash` verification badge, honest "not yet" leaderboard, `/link` explainer, browser-SDK path proven, deployable, CI green                          | —                                                                  | interactive wallet linking (blocked on backend OAuth + it never signs), real leaderboard (blocked on an indexer), hosting project stood up |
| **Event indexer**        | —                                                                                                                                                                                                                                                 | —                                                                  | the whole thing — spec exists (`event-indexer-v2.md`), no implementation                                                                   |

See [`known-limitations.md`](./known-limitations.md) for the itemized
open-limitations list and the cross-repo inconsistencies.

---

↑ [Project overview](./README.md) · [contracts](./contracts.md) · [backend](./backend.md) · [frontend](./frontend.md) · [SDK & integration](./sdk-and-integration.md) · [data-flow walkthrough](./data-flow-walkthrough.md) · [roadmap / status](./roadmap-status.md) · [known limitations](./known-limitations.md) · [glossary](./glossary.md)
