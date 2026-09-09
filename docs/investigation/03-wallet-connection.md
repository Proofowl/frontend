# 03 — Soroban wallet connection from a web app

Checked against current npm + current Stellar docs (2026-09-09), not
training memory.

## The current recommended package

**`@creit.tech/stellar-wallets-kit`** — the de-facto standard multi-wallet
connector for Stellar web apps.

- Latest version: **2.6.0**, published **2026-08-28** (actively
  maintained).
- Docs: <https://stellarwalletskit.dev/>, repo
  <https://github.com/Creit-Tech/Stellar-Wallets-Kit>.
- One API + one connect modal across: **Freighter** (extension + mobile),
  xBull, Albedo, Rabet, Lobstr, Hana, Hot, Klever, OneKey, Bitget,
  **WalletConnect**, and hardware (Ledger via a module). App picks which
  modules to register.
- Stellar's own developer docs still use **Freighter**
  (`@stellar/freighter-api`, latest **6.0.1**, 2025-12) as the reference
  browser wallet for Soroban auth-entry signing. The Kit wraps Freighter,
  so "use the Kit, register the Freighter module" gets both.
- `passkey-kit` (0.18.x) exists for contract/smart wallets (C-account
  passkey signers). Not needed for this project's first version — ProofOwl
  links a **G-account** wallet (`link_github(wallet: Address, …)` with
  `wallet` a `G…` strkey; the SDK's `assertGAddress` enforces `G` + 55
  base32). Note for later: passkey/C-account wallets sign via
  `signAuthEntry` with contract-defined logic, which the two-party flow
  below would need to accommodate if ever supported.

## Does it support the flow this project actually needs?

**The need:** a connected wallet signs a `link_github` **Soroban contract
invocation** directly — specifically its *authorization entry*, because
`link_github` is two-party (`wallet.require_auth()` **and**
`attestor.require_auth()`; see [`01`](./01-grounding.md)). The frontend
must produce the contributor wallet's auth-entry signature; the backend
adds the attestor's; then the tx is submitted. A classic-payment signer is
**not** sufficient.

**Yes.** `@creit.tech/stellar-wallets-kit@2.6.0` exposes both required
primitives (from its shipped `.d.ts`):

```ts
static signTransaction(xdr: string, opts?: {
  networkPassphrase?: string; address?: string; path?: string;
}): Promise<{ signedTxXdr: string; signerAddress?: string }>;

static signAuthEntry(authEntry: string, opts?: {
  networkPassphrase?: string; address?: string; path?: string;
}): Promise<{ signedAuthEntry: string; signerAddress?: string }>;
```

Also present: `signMessage`, `signAndSubmitTransaction`, `getAddress` /
`fetchAddress`, `getNetwork`, `authModal()` (wallet-picker UI),
`createButton()`, `setNetwork()`, connect/disconnect events.

- `signAuthEntry` is exactly the two-party `link_github` primitive: the
  frontend hands the wallet the unsigned Soroban auth entry XDR; the
  wallet returns `signedAuthEntry`.
- Freighter's own API (`@stellar/freighter-api` 6.0.1) has the matching
  `signAuthEntry(entryXdr, { networkPassphrase, address })` — the Stellar
  docs' "Signing Soroban contract invocations" guide shows this call
  directly and recommends Freighter for browser auth-entry signing.
- Shapes line up with `@stellar/stellar-sdk`'s `AssembledTransaction`:
  `.sign({ signTransaction })` and
  `.signAuthEntries({ address, signAuthEntry })` take callbacks with these
  exact signatures. So the ProofOwl SDK's `prepareLinkGithub(config,
  {wallet, attestor, githubIdHash})` → `{ transaction,
  needsSignatureFrom }` result plugs into the Kit with no glue code:
  frontend calls `transaction.signAuthEntries({ address: wallet,
  signAuthEntry: e => kit.signAuthEntry(e, { address: wallet,
  networkPassphrase }).then(r => r.signedAuthEntry) })`, then serializes
  the partially-signed tx for the backend.

## Practical notes for when this gets built

- **`prepareLinkGithub` runs a simulation** — it needs a working browser
  read/RPC path, which [`02`](./02-browser-sdk-proof.md) only proved for
  `createReadClient`. Verify the `prepare*` path bundles too (it imports
  more of stellar-sdk).
- The Kit is framework-agnostic (web components under the hood); there's a
  React example in its repo. It has its own modal/styles to theme.
- WalletConnect support means mobile wallets work without a browser
  extension — relevant for the passport/link UX on phones.
- The attestor address to pass into `prepareLinkGithub` is the **current
  on-chain** one: `GAVHDK6V2LBGBCBWIZXEHDJAW6ZZKPCKLDANURKJZU4NFDCAV2BYFXEF`
  (rotated 2026-09-07). Read it live with `getAttestor()` rather than
  hardcoding — it can rotate again.

## Sources

- <https://www.npmjs.com/package/@creit.tech/stellar-wallets-kit> (v2.6.0, 2026-08-28)
- <https://github.com/Creit-Tech/Stellar-Wallets-Kit> — README + shipped `esm/sdk/kit.d.ts`
- <https://stellarwalletskit.dev/>
- <https://developers.stellar.org/docs/build/guides/transactions/signing-soroban-invocations>
- <https://developers.stellar.org/docs/build/guides/freighter> ; `@stellar/freighter-api` 6.0.1
