# @proofowl/contract-sdk and how it connects the three repos

`@proofowl/contract-sdk` is the one piece of code all three repos share.
It is developed inside `proofowl-contracts` (at `sdk/typescript/`) and
consumed by `proofowl-backend` and `proofowl-frontend` as a normal npm
dependency.

- Package name: `@proofowl/contract-sdk`
- Version: **`0.3.0`** (`sdk/typescript/package.json`)
- Registry: resolvable from `https://registry.npmjs.org/` — this repo's
  `package-lock.json` pins
  `contract-sdk-0.3.0.tgz` with integrity
  `sha512-em89vBg1…`; `proofowl-backend`'s lockfile resolves it from the
  same place. (Note: `proofowl-contracts`' own top-level README still
  says "nothing has been released to a registry" — a stale line;
  see [`known-limitations.md`](./known-limitations.md).)
- One runtime dependency: `@stellar/stellar-sdk` (`^16.0.1`).
- Single `exports` entry (`.`) → the whole barrel; no subpath exports.

## What it provides

| Surface | What it is |
|---|---|
| `createReadClient(config)` | View-method client — `getReputationScore`, `getAttestationCount`, `getGithubForWallet`, `getWalletForGithub`, `getAdmin`, `getAttestor`, `getAttestation`, `getAttestationsPage`. Built with **no signer and no public key** — simulation only. |
| `prepare*` helpers | `prepareLinkGithub`, `prepareUnlinkGithub`, `prepareSubmitAttestation`, `prepareBumpWalletCoreTtl`, `prepareBumpAttestationsTtlPage`, `prepareSetAttestor` — each returns an **unsigned** `AssembledTransaction`. The two-party ones report `needsSignatureFrom`. The SDK never signs or submits. |
| Canonical hashing | `hashGitHubUserIdV1(Hex)`, `normalizeGitHubPullRequest`, `hashGitHubPullRequestV1(Hex)`, `verifyAttestationPrHash` — implementing `identifier-spec-v1` with pinned vectors. |
| Error helpers | `parseProofOwlError`, `ProofOwlErrorCode`, `isSequenceOutOfRange`, `isPageStartOutOfRange`. |
| Lower-level | `decodeReadResult`, `normalizeAttestation`, `RawAttestation`, `MAX_PAGE_SIZE` (50). |

## How each repo uses it

- **proofowl-backend** — `src/chain/readClient.ts` wraps
  `createReadClient` for all reads (scalars and `Attestation`-struct
  alike), then narrows the SDK's `AttestationView` to a hex-only record
  the rest of the repo consumes. `src/chain/submit.ts` drives
  `prepareSubmitAttestation` through a signer that holds
  `ATTESTOR_SECRET_KEY`. `src/hashing/` is an **independent**
  from-spec implementation, cross-checked against the SDK's vectors.
- **proofowl-frontend** (this repo) — `src/lib/chain/readClient.ts`
  wraps `createReadClient` (no signer, no key). `src/lib/chain/passport.ts`
  composes `getReputationScore` + `getAttestationCount` +
  `getGithubForWallet` for a summary and calls `getAttestationsPage`
  directly for history. `src/lib/hashing/identifiers.ts` is a **verbatim
  port** of the backend's module, pinned in tests against both the spec
  vectors and the SDK's exports. The frontend imports no `prepare*`
  helper and never constructs a signer.

Both repos keep their own hashing implementation rather than
re-exporting the SDK's, on purpose: the spec's whole point is that every
implementer produces the same 32 bytes, so an independent copy pinned
against the SDK turns a divergence into a failed test instead of a bad
lookup.

---

## What was fixed at the SDK's source, and when

Through **2026-09-08**, `@proofowl/contract-sdk` was an **unpublished,
`"private": true` `0.2.0` package**, consumed via a `file:` path to a
sibling `proofowl-contracts` checkout. Both `proofowl-backend` and
`proofowl-frontend` independently carried a ported `attestationDecode.ts`
shim (a `scValToNative` workaround) because `getAttestation` /
`getAttestationsPage` threw
`ScSpecType scSpecTypeU64 was not string or symbol`. This is the state
the frontend's `docs/investigation/00` and `02` describe — accurate when
written.

On **2026-09-09**, `proofowl-contracts` fixed both root causes in the
SDK itself (commits `4e754c7` → `c9b340a`, then publish-prep through
`536c297`):

### 1. Stale `dist/`

`dist/` is git-ignored and had never been rebuilt after an earlier
commit (`e2ceda8`) added the `githubIdHash` field to the client and
generated bindings. Any consumer pulling the SDK via a `file:` / git
dependency, or a tarball packed off a stale tree, got the
**pre-ADR-0005 build** — `src/` was correct, only the build output was
stale. Fix: a `prepare` script (`npm run build`) now runs on every
install for a git/`file:` consumer and before every `npm pack` /
`npm publish`; a `prepublishOnly` gate adds clean + build + full check.
So a stale `dist/` can no longer be shipped or consumed.

### 2. The `Attestation`-struct decode bug

`getAttestation` / `getAttestationsPage` now decode the struct with
`@stellar/stellar-sdk`'s `scValToNative` **by field name**, not the
generated client's positional `Spec.structToNative`. `structToNative`
threw `ScSpecType scSpecTypeU64 was not string or symbol` whenever the
shipped bindings' embedded contract spec drifted from the deployed
contract by a field — exactly what happened when the stale build shipped
the pre-`github_id_hash` six-field spec. Also, a contract `Result::Err`
now re-throws as an `Error(Contract, #N)` message `parseProofOwlError`
recognises (an out-of-range `getAttestation` previously threw an
unparseable message). Verified live against the v0.3 testnet instance:
`getAttestationsPage` for the e2e-demo wallet returns the recorded
attestation including `githubIdHashHex 6054b7be…071a51`; `#12` / `#13`
parse correctly.

New exports added alongside: `normalizeAttestation`, `RawAttestation`,
`decodeReadResult`, `isSequenceOutOfRange`, `isPageStartOutOfRange`.

### The version bump

`0.2.0` → `0.3.0`: a behaviour fix plus a purely additive public surface
is a MINOR under pre-1.0 `0.y` compatibility, and `0.3.0` "aligns the
SDK minor with the contract crate minor it now speaks" (ADR 0005).
**`0.3.0` is the first version ever on the registry** — nothing named
`0.2.0` was published.

### Downstream cleanup (also 2026-09-09)

Once `0.3.0` was available on npm, both consumers converged:

| Change | proofowl-frontend | proofowl-backend |
|---|---|---|
| Swap `file:` dep for the npm package `^0.3.0` | commit `32df8ff` | commit `6ef7b0a` |
| Delete the ported `attestationDecode` shim + its test | commit `cb15e58` | commit `e8b643c` |
| Drop the cross-repo checkout / SDK build from CI | commit `32695a1` | commit `ca1f93d` |
| Drop the sibling-checkout requirement from README / config prose | commits `7435b3b`, `a659256` | commits `bb70070`, `ed988ec`, `4cb71b7` |

The frontend still needs its **browser** bundler shim for `node:crypto`
(`next.config.ts` → `src/lib/hashing/sha256-browser.ts`) — that is a
Webpack-for-the-browser concern, not the decode bug, and it stays. The
backend runs on Node and needs no such shim.
