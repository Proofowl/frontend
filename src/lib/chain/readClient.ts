/**
 * The ProofOwl read client, wired to this app's config.
 *
 * `createReadClient` is constructed with NO signer and NO public key —
 * it can only simulate. This app never signs or submits anything; see
 * README "Security".
 *
 * Reads run in the browser (docs/investigation/02-browser-sdk-proof.md),
 * so this module is import-safe on the client — the `node:crypto` the
 * SDK barrel pulls in is aliased by next.config's webpack shim.
 */

import { createReadClient, type ProofOwlReadClient } from "@proofowl/contract-sdk";

import { getChainConfig } from "@/lib/config";

let cached: ProofOwlReadClient | undefined;

/** The memoised read-only client for the configured contract. */
export function getReadClient(): ProofOwlReadClient {
  if (!cached) cached = createReadClient(getChainConfig());
  return cached;
}

/** Test-only: drop the memoised client. */
export function __resetReadClientForTests(): void {
  cached = undefined;
}
