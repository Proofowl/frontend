# Known limitations — every currently-open item, all three repos

A plain-language index. Nothing here is invented for this document —
each item is pulled from a repo's own documentation, with the source
named. "Open" means open as of **2026-09-09**.

For severity and full analysis of the contract items, see
`proofowl-contracts/docs/security/known-risks-v1.md` (its R-numbers are
kept below) and `docs/security/threat-model-v1.md`.

---

## Contract (`proofowl-contracts`)

| # | Limitation | Source | Status |
|---|---|---|---|
| C1 (R2) | **Single trusted attestor key.** It can fabricate *that* a contribution happened or misreport its complexity for any linked identity. It **cannot** redirect credit to an unlinked wallet or steal an identity (contract-enforced). Central, deliberate trust anchor. | `known-risks-v1.md` R2; `SECURITY.md`; ADR 0001/0002 | Open. `set_attestor` exists to rotate to a multisig/threshold scheme; that has not happened. Mainnet prerequisite. |
| C2 (R3) | **Admin key loss is permanent and total.** There is no `set_admin`. Lose the admin key and `set_attestor` can never be called again — the attestor is frozen forever. | `known-risks-v1.md` R3; ADR 0003 | Open by design. Only mitigation is custody discipline (hardware signer — a mainnet prerequisite). |
| C3 (R4) | **No independent third-party audit.** Every test, threat-model entry, and measurement is internal. | `known-risks-v1.md` R4; `PRODUCTION_READINESS.md` 5.6 | Open, not scheduled. Hard mainnet prerequisite. |
| C4 (R10) | **Lost wallet key has no recovery path.** A contributor who loses their wallet key can never unlink (and so never re-link) their GitHub identity. | `known-risks-v1.md` R10; `SECURITY.md` §4.2 | Accepted trade-off. An attestor override would reintroduce the redirect risk ADR 0002 closed. |
| C5 (R11) | **Cross-*wallet* history does not migrate.** Re-linking an identity to a new wallet does not carry the old wallet's attestation history forward. | `known-risks-v1.md` R11 | Accepted — "past reputation stays with the wallet that earned it" is a tested invariant. |
| C6 | **Cross-*identity* reputation is fully readable.** A wallet that relinks from identity A to identity B shows its entire A-era history and score under B. `get_reputation_score` is unchanged. Attestations are now *tagged* with the identity active at submission time, but tagging is information, not enforcement — a passport UI that doesn't filter by `githubIdHash` shows the full total. | ADR 0005 ("What this does not resolve") | Accepted — the registry records facts; downstream consumers decide how to weight a multi-identity wallet. This frontend does **not** currently filter history by identity tag. |
| C7 | **No upgrade path.** Soroban has no contract upgrade; immutability is accepted. A new version = a new contract id and empty state. | `migrations/v0.1-to-v0.2.md`; `PRODUCTION_READINESS.md` 6.8 | Accepted. |
| C8 | **The current instance is disposable.** The v0.3 testnet instance is documented "Disposable; may be replaced." A redeploy resets event history to a new id and deploy ledger. | contracts README "Deployed contracts"; investigation `04` | Open — structural. |
| C9 (R1) | **Large-history behaviour not reproduced live.** The paginated redesign is measured to hold 1000+ attestations off-chain, but no live testnet run has exceeded two attestations for one wallet at any schema version. `resource-profile-v2.md` also flags a small, not-root-caused write-cost growth with total entry count in the test harness. | `known-risks-v1.md` R1; `migrations/v0.1-to-v0.2.md`; `PRODUCTION_READINESS.md` 6.6 | "Resolved in the local candidate, pending live validation." |
| C10 (R6) | **GitHub Actions pinned to major tags, not commit SHAs** — in all three repos. A moved tag changes CI without changing the pin. | `known-risks-v1.md` R6; `phase2-retrospective.md` | Open in every repo. |
| C11 (R7) | **No `npm audit` gate for the TypeScript SDK's dependencies.** CI installs with `--no-audit`. The Rust side has `cargo deny` / `cargo audit`; the TS side has only a committed lockfile. | `known-risks-v1.md` R7 | Open; interim mitigation is manual review on dependency changes. |
| C12 (R8) | **TTL archival's real failure mode is not locally testable.** The in-process Soroban `Env` models TTL *decay* but not a live network's archive-on-expiry (a read failing until `RestoreFootprint` runs). TTL tests prove policy, not the archival failure. | `known-risks-v1.md` R8 | Test-tool boundary, not a contract gap. No action item. |
| C13 (R9) | **Backend obligations for archived state are specification-only.** `event-indexer-v2.md` §6 says what a keep-alive sweep *should* do; nothing enforces that a real backend does it. | `known-risks-v1.md` R9 | The contract makes `bump_*` permissionless so anyone can run the sweep; nobody runs one on a schedule. |
| C14 | **No event indexer and no standing instance with a keep-alive job.** The contract repo states this plainly. | `phase2-v0.3-alpha.md` Part D | Not started. |

## Backend (`proofowl-backend`)

| # | Limitation | Source | Status |
|---|---|---|---|
| B1 | **`repo_in_approved_orgs` cannot be fully automated and a manual "pass" is not independently verifiable.** Drips' Wave approved-orgs list has no reachable public endpoint. The fallback is an operator-asserted allowlist marked `confidence: "manually-asserted-allowlist"`. Out of the box, only `proofowl/proofowl-contracts` and `proofowl/proofowl-backend` pass; everything else is `indeterminate`. | backend README "Known limitation"; `e2e-demo.md` | Open — needs Drips to publish an endpoint. |
| B2 | **No GitHub OAuth / challenge flow.** The submit path assumes the wallet is already linked and short-circuits to "needs queueing" otherwise. The two-party link's off-chain half (ADR 0002) is unimplemented. | backend README "What this repo does NOT do yet" | Not started. |
| B3 | **No always-on worker.** The pipeline runs only on an explicit `pipeline:once` / `pipeline:loop`; never from `npm start` / `npm run dev`. | backend README | By design for now. |
| B4 | **No write HTTP API.** No route submits, signs, or writes to the queue (compile-time enforced). | backend README; `src/api/` | By design. |
| B5 | **Submission is testnet-only** and refuses any other network by name. | backend README "Submitting attestations" | By design. |
| B6 | **The attestor key is an env var** (`ATTESTOR_SECRET_KEY`) read at submit time. No dedicated key infrastructure; the retrospective's criterion 1 wanted it "on separate infrastructure (not an operator laptop keystore)." | backend README; `phase2-retrospective.md` | Open. |
| B7 | **Only one thing is persisted** — the `PendingContribution` queue. No leaderboard cache, no attestation mirror, no REST-API tables; SQLite (swappable to Postgres later). | `prisma/schema.prisma` | By design; explicit follow-up. |
| B8 | **`/api/queue/status` returns aggregate counts only** — no per-item listing (needs its own pagination/filters). | backend README | Deliberate follow-up. |
| B9 | **REST API rate limiting is demo-sized** (60 req/IP/60 s, socket-IP keyed, no proxy assumed). Not production sizing. | backend README "Rate limiting" | By design for a testnet demo. |
| B10 | **Self-merge is a flag, not a policy.** In the e2e demo the fixture PR was self-merged (`maztah1` authored and merged it) and was attested anyway with the flag set. Whoever consumes attestations decides reject-vs-accept. | backend README; `e2e-demo.md` | By design — but worth knowing when reading a passport. |

## Frontend (`proofowl-frontend`, this repo)

| # | Limitation | Source | Status |
|---|---|---|---|
| F1 | **No interactive wallet linking.** The repo never signs anything (ESLint-enforced), and the backend has no OAuth flow to provide the attestor co-signature. `/link` explains the CLI flow instead. | this repo README; `frontend.md`; investigation `03` | Deferred on the missing backend half. |
| F2 | **No real leaderboard.** Needs a standing event-indexing service; none exists. Live `getEvents` scans would silently go partial as history ages out of the RPC's rolling ~7-day window. `/leaderboard` is an honest "not yet" with no sample data. | this repo README; investigation `04` | Deferred on the missing indexer. |
| F3 | **Hosting project not stood up.** The repo is deployable (`npm ci` + `next build` runs anywhere now that the SDK is on npm), but no hosting project (import, env vars, domain) has been created. | this repo README "Deployment" | Open — separate task. |
| F4 | **GitHub handle resolution is unauthenticated** — `api.github.com` at 60 req/hr/IP. The `/passport` search surfaces a distinct "rate-limited" state, but heavy use will hit it. | `src/lib/github/resolveUser.ts` | Inherent to an unauthenticated client-side call. |
| F5 | **Passport history is not broken down by originating identity.** Given C6, a wallet that earned under multiple identities shows one undifferentiated list/total; the per-row `github_id_hash` is displayed but not used to group or filter. | `src/components/AttestationHistory.tsx`; ADR 0005 | Open — a possible future enhancement. |
| F6 | **`docs/investigation/` is a dated snapshot, not maintained.** It describes the SDK as unpublished `0.2.0` needing a decode shim — true when written (2026-09-09), superseded hours later. | investigation `00`–`04` | By design — kept as history. |

---

## Cross-repo inconsistencies (documentation lag, not code bugs)

These are places where the three repos' own docs disagree with each
other or with reality. Flagged here rather than papered over.

1. **SDK publish status.** `proofowl-contracts`' README says *"Nothing
   has been released to a registry, tagged, or audited"* and its
   `CHANGELOG.md` describes the npm publish as prep that *"goes as far
   as a dry run."* But `@proofowl/contract-sdk@0.3.0` **is** on
   `registry.npmjs.org` — both this repo's and `proofowl-backend`'s
   lockfiles resolve it from there with a real `sha512` integrity hash,
   and the frontend/backend READMEs both describe it as a published npm
   dependency. The SDK *has* been published; the contracts repo's
   top-level prose has not caught up.

2. **`proofowl-contracts` internal docs lag its own deployment state.**
   Several documents still describe a pre-v0.2/v0.3 world:
   - `docs/architecture.md` — *"Only the on-chain contract in this
     repository exists today"*, *"the backend, indexer, and frontend …
     do not exist yet"*, *"only a v0.1 instance is testnet-verified — no
     v0.2 instance has been deployed anywhere."* All three are
     contradicted by the same repo's README "Deployed contracts" table,
     `PRODUCTION_READINESS.md` Gate 3, `CHANGELOG.md`, and the
     `phase2-v0.2-alpha.md` / `phase2-v0.3-alpha.md` records.
   - `docs/testnet/README.md` — *"All records on this page describe the
     v0.1 contract. A local v0.2 candidate … has not been deployed to
     any network."* Contradicted by `phase2-v0.2-alpha.md` and
     `phase2-v0.3-alpha.md` sitting in the same directory.
   - `docs/migrations/v0.1-to-v0.2.md` — *"Neither the backend nor the
     frontend repository exists yet."* Both now exist.
   - `docs/integration/contract-api-v2.md` — *"The deployed testnet
     instance (`CBNEX2CF…`) predates this field … A fresh deployment is
     needed before this field exists anywhere on-chain; none has been
     made as of this document."* The v0.3 instance `CAIDTSVP…` was
     deployed 2026-09-07 **with** `github_id_hash`, and is what all
     three repos target.
   - The README "Repositories" / "Integration" sections still tag
     `proofowl-backend` and `proofowl-frontend` *"planned; does not
     exist yet."*

   The **authoritative** current picture within `proofowl-contracts` is
   its README "Deployed contracts" table, `PRODUCTION_READINESS.md`,
   `CHANGELOG.md`, `docs/testnet/phase2-v0.3-alpha.md`, and
   `docs/testnet/attestor-rotation-log.md` — those five are current.

3. **`PRODUCTION_READINESS.md` Gate 4's verdict text.** It reads
   "NO-GO — … the backend, indexer, and frontend do not [exist]." Two of
   those three now do, with a working end-to-end run on record. The
   *criteria* under Gate 4 are still not all met (no standing indexer),
   so the gate is not GO — but its one-line verdict is stale. Treated as
   **partial** in [`roadmap-status.md`](./roadmap-status.md).

4. **`e2e-demo` date vs. transaction ledgers.** `e2e-demo.md` is headed
   2026-09-08 and its transactions are timestamped `23:28–23:29Z` on
   2026-09-08; the frontend investigation (2026-09-09) refers to the
   same txs. Consistent — noted only because the demo record and the
   investigation were written a day apart and cite the same on-chain
   events (`fea4a804…` / `0e2a7be5…`, ledgers 4577301 / 4577318).

5. **Contract-repo README/config uses two spellings of the backend repo
   URL** — `github.com/Proofowl/proofowl-backend` (older prose) and
   `github.com/Proofowl/backend` (the actual repo, used by the SDK
   README and the frontend). The real repo is
   [`Proofowl/backend`](https://github.com/Proofowl/backend).

---

↑ [Project overview](./README.md) · [contracts](./contracts.md) · [backend](./backend.md) · [frontend](./frontend.md) · [SDK & integration](./sdk-and-integration.md) · [data-flow walkthrough](./data-flow-walkthrough.md) · [roadmap / status](./roadmap-status.md) · [known limitations](./known-limitations.md) · [glossary](./glossary.md)
