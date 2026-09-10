# Glossary

The project's vocabulary, defined once. Where a term has a precise
definition in a source document, that document is named.

### attestation

One on-chain record of a confirmed, merged contribution to a Stellar
Wave-labelled issue, submitted by the attestor. Fields (crate `0.3.0`):
`github_id_hash` (the identity active at submission), `repo`
(`"owner/repo"`, cleartext), `pr_number` (`u32`), `issue_id` (`u64`),
`complexity` (`0 | 100 | 150 | 200`), `pr_hash` (`BytesN<32>`),
`timestamp` (ledger close time, contract-set — not caller-supplied).
There is no `sequence` field on the struct; sequence is the zero-based
index you fetch it by. Spec: `contract-api-v2.md` → `Attestation`.

### attestor

The single trusted key that co-signs `link_github` / `unlink_github` and
is the sole caller of `submit_attestation`. Trusted to report _what_
happened; by contract design it cannot choose _whose_ wallet gets credit
(ADR 0001). Rotatable via `set_attestor` (admin-only). On the v0.3
testnet instance it is
`GAVHDK6V2LBGBCBWIZXEHDJAW6ZZKPCKLDANURKJZU4NFDCAV2BYFXEF` (rotated
2026-09-07); always read `get_attestor()` live rather than hardcoding.

### admin

The key set by the deploy-time constructor that can call `set_attestor`.
There is no `set_admin` and no recovery — see
[`known-limitations.md`](./known-limitations.md) C2. v0.3 testnet:
`GDHGAVUNEGGKBL5Z6PIDK3KXQO42J7SHFIHYYT22W5YCV5UQ6DQV5CY6`.

### complexity / tier

A Wave contribution's difficulty tier. `submit_attestation` accepts only
`0`, `100`, `150`, `200`; anything else is `InvalidComplexity` (error
#8). A tier of `0` means "the attestor confirmed the contribution
happened but not its official Wave tier" and **scores at a flat base
rate of 50**, not zero.

### `github_id_hash`

`SHA-256("proofowl:github-user:v1:" + <decimal numeric id>)`, lowercase
64-char hex, no `0x`. The input is GitHub's **immutable numeric user
id**, never the login (a login can be renamed and re-claimed). It is an
**identifier, not privacy** — ids are small sequential integers and
anyone can compute the hash. The spec (`identifier-spec-v1` §1.2)
forbids describing a linked identity as "private" or "anonymous" on any
product surface. Example: login `maztah1` → id `267481210` → hash
`6054b7be…071a51`.

### `pr_hash`

`SHA-256("github.com/<owner>/<repo>/pull/<number>")` after normalization
(strip scheme, leading `@` on owner, trailing `.git` on repo, leading
`#` on the number; lowercase). The contract's **global, permanent
duplicate-PR key** (`SeenPr`). Not reversible; `repo` + `pr_number` are
stored in the clear so the URL can be rebuilt. Spec: `identifier-spec-v1`
§2.

### `link_github` (the two-party link)

`link_github(wallet, attestor, github_id_hash)` — requires **both**
`wallet.require_auth()` and `attestor.require_auth()`, with the
caller-supplied attestor checked against the stored one. "A single
ordinary wallet signature cannot complete these calls." `unlink_github`
has the same shape and clears both directions of the link (history and
PR-dedup markers are left intact). ADR 0002.

### reputation score

`get_reputation_score(wallet) -> u32` — an O(1) running counter, the
saturating sum of each attestation's points (`complexity`, or `50` when
`complexity == 0`). A **full aggregate across every identity a wallet
has ever earned under** — ADR 0005's identity tag lets a reader break it
down but does not change what the aggregate means. Unaffected by
`unlink_github`.

### passport

Not an on-chain type — the composed view of a wallet: current linked
identity + reputation score + attestation count + paginated history.
Built from reads in the order `contract-api-v2.md` §7 documents
(`get_github_for_wallet` → `get_attestation_count` → page
`get_attestations_page` → optionally verify each `pr_hash` →
`get_reputation_score`). This frontend's `/passport/[wallet]` is a
passport view.

### two-party / co-signature

Shorthand for the ADR 0002 rule: an identity link exists only if the
wallet **and** the attestor both authorized the same call. The wallet
signature proves control of the Stellar key; the attestor co-signature
is the on-chain receipt of an off-chain GitHub ownership check.

### trust boundary

The line the contract does not cross: it trusts the attestor key for
_what happened_, never for _whose_ wallet gets credit; GitHub ownership
is established off-chain and vouched for on-chain by the co-signature.
The contract is **not trustless**. Full statement: `SECURITY.md`,
`docs/architecture.md` "Trust boundary in one line".

### attestor protocol

`proofowl-contracts/docs/integration/attestor-protocol-v2.md` — what a
backend must verify before it is allowed to use the attestor key. The
normative version of the backend's five checks.

### the five checks

`proofowl-backend`'s `verifyContribution` gates: `repo_in_approved_orgs`,
`issue_has_wave_label`, `wave_label_predates_pr_merge`, `pr_closes_issue`,
`pr_is_merged`. Each returns `pass` / `fail` / `indeterminate` with its
own evidence. `attestable` is true iff every one is `pass`.

### self-merge flag

`flags.selfMerge` — set when a PR's author and the account that merged it
are the same. A **flag, not a check**: it does not affect `attestable`;
policy is left to whoever consumes the attestation. Observed `true` in
the e2e demo and attested anyway.

### Stellar Wave

The funding program (`drips.network/wave/stellar`) whose merged,
labelled contributions ProofOwl attests. ProofOwl is not run by Drips;
it consumes Wave's public GitHub signals.

### Soroban

Stellar's smart-contract platform. The ProofOwl contract is a Soroban
contract (Rust, `soroban-sdk` 27), reached over the Soroban RPC
(`soroban-testnet.stellar.org` for testnet).

### `MAX_PAGE_SIZE`

`50` — the contract-enforced ceiling on a `get_attestations_page` /
`bump_attestations_ttl_page` `limit`, and the page size the SDK, the
backend REST API, and this frontend's "load more" all use.

### TTL / keep-alive

Soroban archives a persistent entry when its TTL expires. Every registry
record has its TTL extended on every write, and anyone can call the
permissionless `bump_wallet_core_ttl` (O(1)) plus a paginated
`bump_attestations_ttl_page` sweep to keep a passport warm. No service
runs these on a schedule today.

### disposable instance

The contracts repo's own label for every deployed testnet contract:
"Disposable; may be replaced." A redeploy produces a new contract id and
a new deploy ledger, and strands anything learned about the old one.

### v0.1 / v0.2 / v0.3 (crate versions)

Contract schema generations. **v0.1**: unbounded `Vec<Attestation>`
storage (hit a hard 286/287 ceiling). **v0.2** (crate `0.2.0`):
paginated per-attestation storage, no ceiling (ADR 0004). **v0.3** (crate
`0.3.0`): v0.2 plus the `github_id_hash` tag on `Attestation` /
`AttestationRecorded` (ADR 0005) — **the current schema, and the only
one this project's live code targets.** All three have a live testnet
instance; the crate version in `Cargo.toml` is the authoritative marker
of which shape is deployed.

### `@proofowl/contract-sdk`

The TypeScript package developed in `proofowl-contracts/sdk/typescript/`
and published to npm (`0.3.0`). Read-only client + unsigned-transaction
prep + canonical hashing. Never signs, submits, or reads a keystore. See
[`sdk-and-integration.md`](./sdk-and-integration.md).

### the decode shim

The consumer-side `attestationDecode.ts` (`scValToNative` workaround)
that `proofowl-backend` and `proofowl-frontend` each carried while the
SDK's `getAttestation` / `getAttestationsPage` threw
`ScSpecType scSpecTypeU64 was not string or symbol`. Made redundant by
SDK `0.3.0` and removed from both repos on 2026-09-09.

### the browser bundler shim

Separate from the decode shim, and still present in this frontend:
`next.config.ts` aliases `node:crypto` (client build only) to
`src/lib/hashing/sha256-browser.ts` because the SDK barrel and this
repo's ported hashing module both `import { createHash } from "node:crypto"`,
which Webpack cannot bundle for the browser. Proven by `npm run smoke`.

---

↑ [Project overview](./README.md) · [contracts](./contracts.md) · [backend](./backend.md) · [frontend](./frontend.md) · [SDK & integration](./sdk-and-integration.md) · [data-flow walkthrough](./data-flow-walkthrough.md) · [roadmap / status](./roadmap-status.md) · [known limitations](./known-limitations.md) · [glossary](./glossary.md)
