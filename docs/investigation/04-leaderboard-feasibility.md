# 04 — Leaderboard feasibility: real event-retention data

**No architecture is decided here.** This documents what the public testnet
RPC actually does, then lays out the options with their real costs.

## Why this is the critical question

A leaderboard needs **cross-wallet** data: every wallet that has ever
earned reputation, ranked. The contract has no "list all wallets" read —
`get_reputation_score` / `get_attestation_count` are per-wallet, and you
only know a wallet exists by having seen its `GithubLinked` /
`AttestationRecorded` event. So a leaderboard is fundamentally an
**event-aggregation** problem, and its feasibility rests entirely on
whether the event history is reachable.

There is **no leaderboard endpoint in `proofowl-backend`**, and
`proofowl-contracts` states plainly (`phase2-v0.3-alpha.md` Part D) that
**no event indexer exists**.

## What the public testnet RPC actually does — observed 2026-09-09

Direct JSON-RPC calls to `https://soroban-testnet.stellar.org`.

### Retention is a live, rolling ~7-day window

`getEvents` with `startLedger` below the retained range returns:

```
-32600  startLedger must be within the ledger range: 4457027 - 4577986
```

Observed the **floor advance in real time** across a few minutes:

| Wall-clock probe | floor ledger | latest ledger | window width |
|---|---|---|---|
| t0 | 4457027 | 4577986 | 120,959 ledgers |
| t0 + ~3 min | 4457052 | 4578011 | 120,959 ledgers |
| t0 + ~4 min | 4457056 | 4578015 | 120,959 ledgers |

≈ **120,980 ledgers ≈ 7.0 days** at testnet's ~5.8 s/ledger, sliding
forward continuously. This matches SDF's documented public-RPC retention
policy — it is **not** unlimited history.

### Today, the full v0.3 history is inside the window

- v0.3 deploy ledger: **4552203** (2026-09-07T12:36:42Z).
- Current retention floor: **~4457056**.
- `4552203 − 4457056 ≈ 95,000 ledgers` of headroom → the deploy ledger is
  comfortably retained **right now**.
- A cursor-paginated `getEvents` scan from ledger 4552203 for `CAIDTSVP…`
  returned **all 13 events** the contract has emitted:

  | page | events | ledger span |
  |---|---|---|
  | 1 | 7 | 4552203 – 4557687 |
  | 2 | 4 | 4568623 – 4571939 |
  | 3 | 2 | 4577301 – 4577318 |
  | 4 | 0 | (caught up) |

  distinct event ledgers: `4552203, 4552229, 4552239, 4552246, 4552256,
  4552261, 4557687, 4568623, 4568624, 4571938, 4571939, 4577301, 4577318`
  (constructor `Initialized`, the phase-2 link/attest/unlink/relink/attest
  sequence, the `AttestorRotated` at 4557687, some later testnet exercises,
  and the e2e-demo `link_github` + `submit_attestation` at 4577301/4577318).

### The hard constraint

The deploy ledger **crosses the retention floor around 2026-09-14**
(deploy + ~7 days). After that, a cold `getEvents` scan started from
scratch can retrieve only the trailing ~7 days of events — the early
history (constructor, first links/attestations) becomes **permanently
unreachable via RPC**. There is no `getEvents` parameter, archive
endpoint, or public mechanism to read events older than the window.
(Horizon retains *transactions* longer, but not decoded Soroban *events*,
and mining a leaderboard out of raw Horizon operation payloads is a
different, heavier project.)

Compounding it: the v0.3 instance is documented **"Disposable; may be
replaced."** A redeploy resets the event history to a new contract id and
a new deploy ledger.

### `getEvents` pagination gotcha (hit during testing)

Each `getEvents` request scans only a **bounded ledger span** and returns
what it found there plus a `cursor`. A short page — **including zero
events** — does **not** mean end-of-stream. A naive
`while (page.length === limit)` loop stopped after page 1 and missed 6 of
the 13 events. Correct: follow `result.cursor` until it stops advancing /
its ledger reaches `result.latestLedger`. Any indexer or live-scan code
must get this right.

## Options (tradeoffs, no recommendation)

### (a) Build the leaderboard now, via live `getEvents` scans

- **Viable today** — retention covers the whole v0.3 history, and there
  are ~13 events, so a full scan is 3–4 RPC round-trips.
- **Cost:** implement correct cursor pagination + `AttestationRecorded` /
  `GithubLinked` decoding (`scValToNative`); aggregate per wallet in
  memory or a cache; a refresh loop.
- **What it silently becomes after ~2026-09-14:** a leaderboard that only
  reflects the last ~7 days of on-chain activity. A wallet whose only
  attestation predates the window **drops off entirely** — its score
  still exists on-chain (`get_reputation_score` is authoritative and
  unaffected), but the leaderboard can't discover the wallet to ask.
  No error, just missing rows. This degradation is invisible unless
  explicitly monitored.
- **Mitigation that turns it into option (c):** run the scan on a server
  on a schedule and *persist* what it sees, so wallets discovered while
  in-window are remembered after they age out. That persistence layer is
  a mini event-indexer.
- **Fragile to redeploys:** a new contract id = start over; anything
  learned about the old instance is stranded.

### (b) Scope the leaderboard out of v1

- Ship **passport lookup + wallet linking + explainer/landing** only —
  all three rest on per-wallet scalar reads
  ([`02`](./02-browser-sdk-proof.md) proved these work in-browser today,
  modulo the `Attestation`-struct shim for history).
- Leaderboard becomes explicitly **blocked on a real event-indexing
  service** — a separate, ongoing piece of work that has been running and
  persisting since a contract's deployment. `event-indexer-v2.md` already
  specifies its behavior (`(network, contractId)` partitioning, ordering,
  idempotency, reconciliation against read methods); nobody has built it.
- **Cost:** zero new infra for v1; a clear, honest "coming soon" on the
  landing page instead of a leaderboard that quietly rots.
- **Cost of deferring:** no ranked/social surface at launch, which may be
  the single most compelling view for the audience.

### (c) Minimal persistent indexer now (middle path this investigation surfaces)

- A small server job: cursor-scan `getEvents` for the active contract on a
  schedule, upsert `(wallet, github_id_hash, score, lastSeenLedger)` into
  a tiny store (SQLite / a single table), reconcile scores against
  `get_reputation_score`. The leaderboard reads that store.
- **Cost:** more than (a) — needs a host, a DB, a scheduler, a
  cold-start/backfill run **executed before 2026-09-14** while full
  history is still in-window (after that, backfill from RPC is impossible
  for this instance). Redeploy handling = point it at the new id and
  backfill that one in-window.
- **Payoff:** the leaderboard stays complete past the 7-day window, and
  this is a strict subset of the eventual `event-indexer-v2.md` service —
  not throwaway work.
- Still a backend component, not a pure frontend; it changes what "this
  repo's first version" contains.

### (d) Read-method-only leaderboard over a *known* wallet set

- If the set of participating wallets is enumerable from outside the chain
  (e.g. the backend's queue/DB already lists every `github_id_hash` it has
  processed, and `get_wallet_for_github` resolves each to a wallet), a
  leaderboard could be built purely from **authoritative scalar reads**
  (`get_reputation_score` per wallet), no events, no retention concern.
- **Cost:** depends on a backend endpoint that exposes the wallet/identity
  roster (the current `/api/queue/status` gives only aggregate counts —
  `README` calls a per-item listing "a deliberate follow-up"). So this
  also needs backend work, just of a different shape, and it only ranks
  wallets the backend's pipeline has touched (misses anyone who linked +
  earned entirely outside it).

## Bottom line for the decision

Retention does **not** block a leaderboard *today* — the opposite of the
"already rolled past" worst case. But the window is ~7 days and rolling,
the v0.3 deploy ledger ages out of it ~2026-09-14, and the instance is
disposable. So the real choice is between (a) a leaderboard that is
correct now and silently partial later, (b) not shipping it in v1 and
naming the indexer as its blocker, (c) building the minimal persistent
indexer now while backfill is still possible, or (d) a reads-only
leaderboard gated on a backend roster endpoint. Each needs backend work
except (a), and (a)'s "no backend" property expires with the retention
window.
