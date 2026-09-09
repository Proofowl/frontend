# proofowl-frontend

Passport lookup, wallet-linking UI, and the explainer/landing page for the
[ProofOwl](https://github.com/Proofowl/proofowl-contracts) on-chain
contributor-reputation registry.

**Status: pre-implementation.** No application code exists yet. This repo
currently holds only a grounding/investigation record — real technical
facts confirmed against the live testnet contract, the TypeScript SDK, and
current Soroban wallet tooling — that must be settled before any UI is
scaffolded.

See [`docs/investigation/`](./docs/investigation/):

| Doc | Question it answers |
|---|---|
| [`00-overview.md`](./docs/investigation/00-overview.md) | Scope, method, the hard facts in one page |
| [`01-grounding.md`](./docs/investigation/01-grounding.md) | What the contracts + backend repos actually say |
| [`02-browser-sdk-proof.md`](./docs/investigation/02-browser-sdk-proof.md) | Does `@proofowl/contract-sdk` run in a browser? (proven, not inferred) |
| [`03-wallet-connection.md`](./docs/investigation/03-wallet-connection.md) | Current Soroban wallet-connect standard, and whether it can sign a contract invocation |
| [`04-leaderboard-feasibility.md`](./docs/investigation/04-leaderboard-feasibility.md) | Does testnet RPC retain events far enough back for a leaderboard? Real observed data + options |
