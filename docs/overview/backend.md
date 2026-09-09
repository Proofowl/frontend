# proofowl-backend — deep dive

Repo: <https://github.com/Proofowl/backend> · read at commit `4cb71b7`
(2026-09-09).

The verification service. It checks GitHub's public API for merged
Stellar Wave contributions and submits them as on-chain attestations to
the deployed v0.3 registry. Its own README is blunt about what it is:
**"closer to a scaffold than a hosted service."**

---

## What exists, and what is deliberately not wired up

**Exists and works:**

- the project structure, the canonical hashing module, the GitHub
  verification logic (five checks + a self-merge flag);
- on-chain **reads** via `@proofowl/contract-sdk`'s `createReadClient`;
- the testnet-only `submit_attestation` call with its safeguards
  (`src/chain/submit.ts`);
- a one-table SQLite queue (`src/queue/`);
- the automation pipeline that ties discovery → verification →
  submission/queue → retry together (`src/pipeline/`);
- a **read-only** REST API (`src/api/`);
- tests (offline unit + opt-in live integration) and CI.

**Deliberately not wired up:**

- **No always-on worker.** The pipeline runs only when an operator types
  `npm run pipeline:once` / `pipeline:loop`. `npm start` / `npm run dev`
  serve only `/health`, `/ready`, and the read-only `/api` — no polling,
  no scheduler.
- **No write HTTP API.** No route submits an attestation, signs
  anything, touches `ATTESTOR_SECRET_KEY`, or writes to the queue. The
  `ApiDeps` type is `Pick<>`-narrowed so this is a compile-time
  guarantee, not a convention.
- **No GitHub OAuth / challenge flow.** The submit path assumes the
  contributor's wallet is *already* linked on-chain and short-circuits
  to "needs queueing" when it is not. Nothing in this repo runs the
  wallet-linking OAuth flow ADR 0002 describes.
- Submission and the pipeline are **testnet-only** and refuse any other
  network by name.

---

## The verification pipeline

### Discovery → verification → routing (`runOnce()`)

One idempotent pass:

1. **Drain the queue first.** For each `WAITING_FOR_WALLET_LINK` row
   (up to `PIPELINE_MAX_QUEUE_DRAIN`), re-read `get_wallet_for_github`.
   Still unlinked → leave queued. Now linked → hand to
   `submitAttestation`.
2. **Discover.** For each repo on the approved-orgs allowlist seed, find
   closed Wave issues with a linked, merged PR
   (`src/pipeline/discover.ts`, GitHub REST + GraphQL), bounded by
   `PIPELINE_MAX_ISSUES_PER_REPO`. Discovery produces candidates only.
3. **Verify + route.** Run `verifyContribution` on each candidate.
   Not attestable / indeterminate → log and skip, **never queue**.
   Attestable → `submitAttestation`, then route on the result kind:
   `submitted` → log; `already-attested` → no-op; `not-submittable`
   (wallet not linked) → enqueue after a duplicate/`DISMISSED` check;
   `contract-rejected` / `submission-failed` / `rpc-error` → log
   distinctly, **no retry within the pass** (the next pass picks it up).
4. **Return a summary** — outcome counts for both phases, plus
   `realSubmissionAttempts` and `submittedTxHashes`.

The pass is idempotent: `enqueue` upserts on `pr_hash`,
`submitAttestation` short-circuits an already-credited PR before
assembling anything, and a just-submitted row is no longer `WAITING`.

### The loop (`createScheduler()`)

`pipeline:loop` runs a pass immediately, then every
`PIPELINE_POLL_INTERVAL_MS` (default 600000 = 10 min; floor 60000). A
tick that fires while the previous pass is still running is **skipped** —
passes never stack. `SIGINT` / `SIGTERM` stop it cleanly.

### The five verification checks

`verifyContribution` returns each as its own
`{ status, detail, evidence }` — never one opaque boolean. `status` is
`pass`, `fail`, or `indeterminate`.

| id | checks |
|---|---|
| `repo_in_approved_orgs` | live Wave list first, then an operator-asserted allowlist fallback (see below) |
| `issue_has_wave_label` | the resolved issue carries the Wave label |
| `wave_label_predates_pr_merge` | the label's applied-at timestamp is before the PR's merge timestamp |
| `pr_closes_issue` | the PR is linked to the issue via GitHub's own closing-issue mechanism (GraphQL `closingIssuesReferences`) |
| `pr_is_merged` | `pull_request.merged === true`, not merely `closed` |

Plus `flags.selfMerge` — whether the PR's author and merger are the same
account. This is a **flag, not a gating check**: `attestable` is true iff
every gating check is `pass`; the flag does not affect it. Policy on
self-merges is left to a downstream consumer.

### Known limitation: `repo_in_approved_orgs` is not fully automatable

Drips' Wave approved-orgs list lives at
`drips.network/wave/stellar/orgs`, a client-rendered app with **no
reachable public data endpoint** (its data URL needs a `waveAccessToken`).
So the live source can only ever return `indeterminate` today.

The fallback is an **operator-asserted allowlist**
(`config/approved-orgs-allowlist.json`): each entry carries `repo`,
`assertedBy`, `assertedAt`, and `evidenceUrl`. A manual "pass" means a
named person asserted on a date that the repo is Wave-approved and left a
link — it is **not** independently re-derivable from public data the way
a live-sourced pass (or an on-chain attestation) is, and it is marked
`confidence: "manually-asserted-allowlist"` in the returned data. The
committed seed asserts exactly two repos:
`proofowl/proofowl-contracts` and `proofowl/proofowl-backend`. Every
other repo is `indeterminate` (`operator-allowlist-absent`) — not
reviewed, not rejected. This check never returns `fail` from the
allowlist path.

---

## The submission path (`submitAttestation`)

`src/chain/submit.ts` turns one verified, **attestable** contribution
into a real `submit_attestation` call on the v0.3 registry. It is the
**only** state-changing path in the repo and is **not reachable from the
HTTP layer**. It drives the SDK's `prepareSubmitAttestation` through an
injected submitter that signs with `ATTESTOR_SECRET_KEY`.

Safeguards, enforced not just documented:

- **Testnet only** — the submitter refuses to construct unless the
  network passphrase is the Stellar testnet one; `submitAttestation`
  re-checks before any I/O.
- **Dry-run first, always** — every call is simulated before it can be
  sent; a contract rejection is classified from that simulation, before
  any signature or fee.
- **Two hard pre-conditions, re-read live every call** — *not-linked*
  (`get_wallet_for_github` returns `null` → `not-submittable`, that's
  the queue's job) and *already-attested* (→ `already-attested`, no
  transaction assembled).
- **The attestor secret is never logged** — not in a result, an error,
  or a log line; it is kept off the shared `AppConfig` object (only the
  boolean `attestorSecretKeyIsSet` is exposed).

The result is exactly one of: `submitted`, `dry-run-ok`,
`already-attested`, `not-submittable`, `not-attestable`,
`contract-rejected`, `submission-failed`, `rpc-error`.

---

## The queue

One Prisma model, `PendingContribution` (SQLite). A row exists iff, at
enqueue time, every gating check passed **and**
`get_wallet_for_github(githubIdHash)` returned `null` on-chain. Fields:
the canonical `githubIdHash` / `githubUserId` / `prHash` (unique) /
`repo` / `prNumber` / `issueId` / `complexity`, the full
`verificationJson`, `selfMergeFlagged`, a `status` string
(`WAITING_FOR_WALLET_LINK` → `READY_TO_SUBMIT` / `ALREADY_ATTESTED` /
`DISMISSED`), and audit timestamps. The README is explicit that this is
the *only* persisted thing — **no leaderboard cache, no attestation
mirror, no REST-API tables.**

---

## The read-only REST API

`src/api/` — a thin HTTP surface over on-chain state and local queue
counts. Base path `/api`. Order per request: response cache (3 s) →
per-IP rate limiter (60 req / IP / 60 s) → route. It has **no write
capability at all**.

| Method & path | Returns |
|---|---|
| `GET /api/reputation/:wallet` | `{ wallet, reputationScore, attestationCount }` |
| `GET /api/attestations/:wallet?cursor=&limit=` | `{ wallet, pagination: { cursor, limit, count, nextCursor, maxPageSize: 50 }, attestations: [{ sequence, repo, prNumber, prHashHex, githubIdHashHex, issueId (decimal string), complexity, timestamp (number) }] }` |
| `GET /api/wallet-for-github/:githubIdHash` | `{ githubIdHash, wallet \| null }` |
| `GET /api/queue/status` | `{ counts: { …per status… }, total }` — **aggregate counts only** |

Conventions: malformed input → 400 before any RPC; a syntactically valid
but never-seen wallet/hash is **not** an error (`reputationScore: 0`,
empty list, `wallet: null`) — there is no 404 for "unseen"; `issueId` is
a decimal string because a `u64` can exceed `Number.MAX_SAFE_INTEGER`;
`?limit` defaults to and is capped at `MAX_PAGE_SIZE = 50`. **There is
no leaderboard endpoint** — the API does no cross-wallet aggregation and
runs no indexer.

This frontend does **not** call this API — it reads the chain directly.
The API is useful to this repo as a **data-shape reference** (the
frontend's `docs/investigation/01-grounding.md` used it that way).

---

## Current state, in one line

The verification logic, the submit call with its safeguards, the queue,
the pipeline, and the read-only API all exist and are tested. Nothing
runs unattended, nothing writes over HTTP, and there is no OAuth flow.
One full end-to-end run is on record — see
[`data-flow-walkthrough.md`](./data-flow-walkthrough.md).
