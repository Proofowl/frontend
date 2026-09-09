# One concrete end-to-end trace

This is a single real run through all three repos — **not a hypothetical
example**. Every value below is public data taken verbatim from
`proofowl-backend/docs/testnet/e2e-demo.md` (the `e2e-demo` evidence
record, dated **2026-09-08**), cross-checked against
`proofowl-contracts/docs/testnet/attestor-rotation-log.md` and this
repo's `docs/investigation/`. Nothing here is invented. Two real testnet
transactions were made.

Target contract: **v0.3**
`CAIDTSVPQICTA2VLE6BSQYHEELHGPZWQDYWKSDBRW4LYPZH6Q44UTAOA` on Stellar
testnet. On-chain attestor at the time:
`GAVHDK6V2LBGBCBWIZXEHDJAW6ZZKPCKLDANURKJZU4NFDCAV2BYFXEF` (the rotated
backend-service identity).

---

## Step 0 — a real merged GitHub PR (the fixture)

| Artifact | Value |
|---|---|
| Fixture issue | [`Proofowl/backend#4`](https://github.com/Proofowl/backend/issues/4) — created `2026-09-08T23:13:31Z` |
| `wave` label applied to #4 | `2026-09-08T23:13:33Z` (timeline `labeled` event, actor `maztah1`) |
| Fixture PR | [`Proofowl/backend#5`](https://github.com/Proofowl/backend/pull/5) — opened `2026-09-08T23:15:28Z`, body contains `Closes #4` |
| PR merged | `2026-09-08T23:16:24Z`, by `maztah1`, merge commit `10341d54…` |
| Issue #4 auto-closed | `2026-09-08T23:16:28Z` |

Order matters for one of the checks: the Wave label was applied
**before** the PR was opened and merged.

## Step 1 — the identity

The account that both opened and merged the PR:

| Field | Value |
|---|---|
| GitHub login | `maztah1` |
| GitHub numeric user id | `267481210` |
| Canonical string (`identifier-spec-v1` §1.2) | `proofowl:github-user:v1:267481210` |
| `github_id_hash` (SHA-256, lowercase hex) | `6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51` |

The id is not secret; anyone can recompute the hash. It was produced by
the backend's own `hashGitHubUserIdV1Hex` and cross-checked against a
raw `sha256`. This frontend's `/passport` search does the *same*
computation client-side when you look someone up by handle.

## Step 2 — live discovery + verification (0 transactions)

`proofowl-backend`'s pipeline (`npm run pipeline:once`), run live
against the GitHub API — not mocked:

```
discovery.candidate — proofowl/backend#4 <- merged PR #5
candidate = { owner: "proofowl", repo: "backend", issueNumber: 4, prNumber: 5 }
```

`verifyContribution` — real result, all reads live from GitHub:

| # | check | status | detail |
|---|---|---|---|
| a | `repo_in_approved_orgs` | **pass** | `confidence: "manually-asserted-allowlist"` — `proofowl/backend` is on the operator allowlist; the live Drips source was `indeterminate` (no public JSON endpoint). |
| b | `issue_has_wave_label` | **pass** | issue #4 carries `wave` |
| c | `wave_label_predates_pr_merge` | **pass** | label `23:13:33Z` < merge `23:16:24Z` (`deltaSeconds: 171`) |
| d | `pr_closes_issue` | **pass** | `closingIssueNumbers: [4]` |
| e | `pr_is_merged` | **pass** | `merged_at 2026-09-08T23:16:24Z` |
| f | `flags.selfMerge` | **flagged `true`** | `maztah1` (id `267481210`) authored *and* merged PR #5 |

`attestable: true`. The self-merge flag fired `true` — its **first live
observation in the wild** — and did **not** block attestation: it is a
flag, not a gating check.

## Step 3 — pipeline pass #1: enqueue (0 transactions)

The synthetic demo wallet
`GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER` (friendbot-funded)
was not yet linked on-chain, so `submitAttestation` returned
`not-submittable` and the contribution was **queued**:

```
prHash           d07879a0ea96f8f8995a531d4d8792c54b93151b020da468f41bdccf0ff15112
                 = SHA-256("github.com/proofowl/backend/pull/5")
githubIdHash     6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51
repo             proofowl/backend
prNumber         5
issueId          4
complexity       0
status           WAITING_FOR_WALLET_LINK
selfMergeFlagged true
realSubmissionAttempts: 0
```

## Step 4 — transaction #1: `link_github` (two-party)

Signed by the synthetic wallet **and** the attestor. Network re-verified
via `getNetwork` and `get_attestor()` re-read live before sending.

| Field | Value |
|---|---|
| Transaction hash | `fea4a80426fa9b568d7d1f198eb0f10ee1847d1cb647ac1c1e7da84151103e30` |
| Horizon `successful` | `true` |
| Ledger | `4577301` |
| `created_at` | `2026-09-08T23:28:12Z` |
| `get_wallet_for_github(6054b7be…)` before | `null` |
| `get_wallet_for_github(6054b7be…)` after | `GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER` |

This is the step no repo ships a UI for. In the demo it was done via the
CLI / SDK `prepareLinkGithub` path with both keys available.

## Step 5 — pipeline pass #2: drain → submit (transaction #2)

The queue-drain re-check hit a transient `fetch failed` and left the row
queued (no retry, as designed). Discovery re-found the candidate; the
wallet was now linked and the PR not yet attested, so `submit_attestation`
was sent (signed by the attestor only):

| Field | Value |
|---|---|
| Transaction hash | `0e2a7be567fd8b49567b60293b8b9e520cdf25e181d0bbe246ce604a8324fa65` |
| Horizon `successful` | `true` |
| Ledger | `4577318` |
| `created_at` | `2026-09-08T23:29:37Z` |
| `source_account` | `GAVHDK6V2LBGBCBWIZXEHDJAW6ZZKPCKLDANURKJZU4NFDCAV2BYFXEF` (attestor) |

## Step 6 — the on-chain record (read back)

```
get_wallet_for_github(6054b7be…1a51) = GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER
get_attestation_count(wallet)        = 1
get_reputation_score(wallet)         = 50        (complexity 0 → contract credits a flat +50)

attestation[0] = {
  sequence:        0,
  repo:            "proofowl/backend",
  prNumber:        5,
  issueId:         4,
  complexity:      0,
  prHashHex:       "d07879a0ea96f8f8995a531d4d8792c54b93151b020da468f41bdccf0ff15112",
  githubIdHashHex: "6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51",
  timestamp:       1788910177
}
```

The queue row was reconciled to `ALREADY_ATTESTED` with the note
`submitted by pipeline: tx 0e2a7be5…`.

## Step 7 — idempotency: pipeline pass #3 (0 transactions)

A third pass re-discovered the candidate; `submitAttestation` consulted
`isContributionAlreadyAttested`, returned `already-attested`, and
assembled nothing. Running the pipeline again broadcasts nothing.

## Step 8 — through the read-only REST API

`GET /api/reputation/GAXZZJW7…` → `{ reputationScore: 50, attestationCount: 1 }`.
`GET /api/attestations/GAXZZJW7…` → the same single record as step 6,
with `issueId` as the string `"4"` and `timestamp` as the number
`1788910177` (bigint-safe serialization). The API data matches the
on-chain read exactly.

---

## Where this frontend enters the picture

This repo does not appear in the trace above — the demo predates any
frontend involvement and used the CLI / SDK directly. But **every read
in steps 6 and 8 is exactly what this frontend does**, from the browser,
for that same wallet:

- `/passport` — enter `maztah1` → resolves to id `267481210` → hashes to
  `6054b7be…` client-side → `get_wallet_for_github` →
  `GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER`.
- `/passport/GAXZZJW7…` — `get_reputation_score` → `50`,
  `get_attestation_count` → `1`, `get_github_for_wallet` → `6054b7be…`,
  and `get_attestations_page(wallet, 0, 50)` → the one row, with its PR
  link rebuilt as `https://github.com/proofowl/backend/pull/5` and its
  `pr_hash` recomputed client-side to
  `d07879a0…` for the "verified" badge.

The frontend's `npm run smoke` asserts precisely this: it opens
`/passport/GAXZZJW7…` in headless Chrome against the live contract and
checks the rendered reputation score is `50`.

## What this trace does **not** establish

Anything about mainnet (never touched); any security property beyond
"the happy path works"; the `repo_in_approved_orgs` check as
independently verifiable (it passed here via the operator-asserted
allowlist, because Drips publishes no reachable endpoint).
