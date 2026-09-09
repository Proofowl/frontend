# 01 — What the sibling repos actually say

Read directly from `../proofowl-contracts` @ `efd0d76` and
`../proofowl-backend` @ `1b6fe10`. This is reference for the frontend, not
a dependency the frontend calls (the backend REST API is read for
data-shape parity only).

---

## `proofowl-contracts/docs/integration/contract-api-v2.md`

- Describes the **v2 ABI**, authoritative for crate `0.3.0`. The deployed
  WASM's embedded spec is the real source of truth; this doc is prose.
- The doc body still carries an out-of-date caveat ("The deployed testnet
  instance `CBNEX2CF…` predates `github_id_hash`… A fresh deployment is
  needed… none has been made as of this document"). **That is stale** —
  the README table and `phase2-v0.3-alpha.md` both show a crate-`0.3.0`
  instance (`CAIDTSVP…`) was deployed 2026-09-07, after this doc's caveat
  was written. Trust the README table + the phase-2 record for "what's
  live", the ABI doc for "what the functions do".
- **Functions relevant to the frontend:**
  - Reads (no auth, simulation only): `get_reputation_score(wallet) -> u32`
    (O(1) running counter), `get_attestation_count(wallet) -> u32`,
    `get_attestation(wallet, seq) -> Result<Attestation>`,
    `get_attestations_page(wallet, start, limit) -> Result<Vec<Attestation>>`
    (`limit` 1..=**50** = `MAX_PAGE_SIZE`), `get_github_for_wallet`,
    `get_wallet_for_github`, `get_admin`, `get_attestor`.
  - `link_github(wallet, attestor, github_id_hash) -> Result<()>` is
    **two-party**: `wallet.require_auth()` **and**
    `attestor.require_auth()`, and `attestor` must equal the stored
    attestor. "A single ordinary wallet signature cannot complete these
    calls." Frontend builds the `AssembledTransaction` + collects the
    contributor's wallet auth-entry signature; backend adds the attestor
    entry (after its own GitHub OAuth/challenge); whoever holds the fully
    signed tx submits. Order of the two auth-entry signatures doesn't
    matter.
  - `unlink_github` — same two-party shape.
  - `bump_wallet_core_ttl(wallet)` — permissionless, single-signer, safe to
    expose as a "keep my passport alive" action (needs only the caller's
    own signature as tx source). Note it only refreshes O(1) records;
    full attestation-history keep-alive needs a paged
    `bump_attestations_ttl_page` sweep, which is a backend/indexer job,
    not a frontend one.
  - `submit_attestation` is attestor-only — **not a frontend concern.**
- `Attestation` fields: `github_id_hash: BytesN<32>`, `repo: string`
  (`"owner/repo"`), `pr_number: u32`, `issue_id: u64`, `complexity`
  (`0|100|150|200`; `0` scores as +50), `pr_hash: BytesN<32>`,
  `timestamp: u64` (ledger close time). No `sequence` field on the struct
  — sequence is the address you fetch it by.
- Error codes 1–13 are enumerated; `SequenceOutOfRange` (12) and
  `PageStartOutOfRange` (13) are the ones a passport UI will actually hit
  paging past the end. `start == count` returns `[]`, not an error.

## `proofowl-contracts/docs/integration/event-indexer-v2.md`

- **Explicitly warns** (its §2, verbatim): *"RPC retention is still days,
  not indefinite; the read methods always reflect current state
  regardless."* And §0: *"Contract read methods are authoritative. Events
  and indexer state are a convenience cache."*
- `AttestationRecorded` event: topics `["attestation_recorded", wallet]`,
  data `{ github_id_hash, repo, pr_number, issue_id, complexity, pr_hash,
  timestamp, sequence }`. This is what a leaderboard would aggregate
  (sum `complexity>0 ? complexity : 50` per wallet, or just track
  `get_reputation_score` per seen wallet).
- Building a passport from reads is documented step-by-step (its §7):
  `get_github_for_wallet` → `get_attestation_count` → page
  `get_attestations_page` → optionally verify each `pr_hash` →
  `get_reputation_score`.
- Gap/replay detection via the event `sequence` field is described — an
  indexer concern, not a first-version frontend concern.

## `proofowl-contracts/docs/integration/identifier-spec-v1.md`

- `github_id_hash = SHA-256("proofowl:github-user:v1:" + <decimal id>)` —
  the **numeric** GitHub user id, never the login. Vectors pinned in the
  SDK's `identifiers.test.ts`.
- `pr_hash = SHA-256("github.com/<owner>/<repo>/pull/<number>")` after
  normalization (strip scheme, `@`, `.git`, `#`, lowercase). Reconstruct a
  PR URL from an attestation's cleartext `repo` + `pr_number` as
  `https://github.com/<repo>/pull/<pr_number>`.
- **"`github_id_hash` is opaque, not secret… Do not describe a linked
  identity as 'private' or 'anonymous' anywhere in a product surface."**
  Direct copy constraint for the landing/explainer page.
- The SDK exposes `hashGitHubUserIdV1Hex`, `normalizeGitHubPullRequest`,
  `hashGitHubPullRequestV1Hex`, `verifyAttestationPrHash` — the frontend
  should use these, not re-implement hashing.

## `proofowl-contracts` README — "Deployed contracts" table

| Network | Contract ID | Crate | Notes |
|---|---|---|---|
| Testnet | **`CAIDTSVPQICTA2VLE6BSQYHEELHGPZWQDYWKSDBRW4LYPZH6Q44UTAOA`** | v0.3 (`0.3.0`) | Alpha 2026-09-07, reproducible-build-verified, smoke-tested incl. a live identity-relink. **"Disposable; may be replaced."** |
| Testnet | `CBNEX2CFAKMX2JH24EX2ZJOMKV6KQ5UE5NXAYCN2A2S72IVMFLNWIGC4` | v0.2 (`0.2.0`) | superseded; no `github_id_hash` |
| Testnet | `CCJ7DVU2XYVFNZMHN4VPCYSPJ7HW4RPI544XG5TG42ZX7TDSUIL3SKP6` | v0.1 | superseded; unbounded ABI |

README also lists `proofowl-frontend` as *"passport pages, leaderboard,
wallet linking UI (planned; does not exist yet)"*.

## `proofowl-contracts/docs/testnet/phase2-v0.3-alpha.md`

- The deployment evidence record. **Deploy ledger 4552203**, create+ctor tx
  `efe337a2…`, 2026-09-07T12:36:42Z. WASM SHA-256
  `b407cca4…8ff11b4bd`, matched against the on-chain hash.
- Smoke test: link identity A → attest (seq 0, complexity 100) → unlink →
  link identity B (same wallet) → attest (seq 1, complexity 150) →
  `get_reputation_score` = 250. All via CLI against `CAIDTSVP…`.
- **"Part D: does not close"** — explicitly: *no backend, no standing
  instance with a keep-alive job, no event indexer.* This is the repo's
  own statement that event-indexing infrastructure does not exist.

## `proofowl-backend` README + `docs/testnet/e2e-demo.md`

- **On-chain reads target `CAIDTSVP…` (v0.3) by default**, via
  `@proofowl/contract-sdk`'s `createReadClient`.
- **Documented SDK bug + shim** (`src/chain/attestationDecode.ts`): the
  pinned `@stellar/stellar-sdk` 16.x throws
  `ScSpecType scSpecTypeU64 was not string or symbol` decoding the v0.3
  `Attestation` struct. Scalar reads are unaffected. The backend keeps the
  SDK's generated client for the RPC round-trip and swaps only the final
  ScVal→JS step for the generic `scValToNative`. *"Remove it once the SDK
  bumps `@stellar/stellar-sdk`."* — **the frontend will need the same
  workaround for passport history.**
- **Read-only REST API** (`src/api/`, thin layer over the same on-chain
  reads — useful as a data-shape reference, not a required dependency):
  - `GET /api/reputation/:wallet` → `{ wallet, reputationScore, attestationCount }`
  - `GET /api/attestations/:wallet?cursor=&limit=` → `{ wallet, pagination: { cursor, limit, count, nextCursor, maxPageSize:50 }, attestations: [{ sequence, repo, prNumber, prHashHex, githubIdHashHex, issueId (decimal string), complexity, timestamp (number) }] }`
  - `GET /api/wallet-for-github/:githubIdHash` → `{ githubIdHash, wallet | null }`
  - `GET /api/queue/status` → aggregate counts only
  - Conventions: malformed input → 400 before any RPC; never-seen but valid
    input is **not** an error (`reputationScore: 0`, empty list,
    `wallet: null`); `issueId` serialized as a decimal string (u64 can
    exceed `Number.MAX_SAFE_INTEGER`); 3 s response cache; 60 req/IP/60 s.
  - **No leaderboard endpoint exists.** The API is per-wallet lookups
    only; it does no cross-wallet aggregation and runs no indexer.
- e2e-demo record: real PR `Proofowl/backend#5` merged → pipeline →
  `link_github` (tx `fea4a804…`, ledger 4577301) + `submit_attestation`
  (tx `0e2a7be5…`, ledger 4577318) against `CAIDTSVP…`. Synthetic demo
  wallet `GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER`,
  final on-chain state `get_reputation_score = 50`,
  `get_attestation_count = 1`, `github_id_hash =
  6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51`
  (login `maztah1`, numeric id `267481210`). These are the values the
  browser SDK probe in [`02`](./02-browser-sdk-proof.md) checks against.
