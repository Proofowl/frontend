/**
 * High-level passport reads, composed from the SDK read client.
 * Everything here is a read-only simulation against the configured
 * contract; see contract-api-v2 §7 "Building a passport" for the shape
 * this follows.
 *
 * As of `@proofowl/contract-sdk@0.3.0` the client's
 * `getAttestation` / `getAttestationsPage` decode the `Attestation`
 * struct correctly on their own (via `scValToNative`), so this module
 * calls them directly — no consumer-side decode shim.
 */

import { MAX_PAGE_SIZE, isPageStartOutOfRange, type AttestationView } from "@proofowl/contract-sdk";

import { bytesToHex } from "@/lib/hashing";
import { assertStellarWalletAddress } from "@/lib/hashing/identifiers";
import { getReadClient } from "./readClient";

export { MAX_PAGE_SIZE };
export type { AttestationView };

export interface PassportSummary {
  wallet: string;
  /** O(1) running reputation total. `0` for an unknown wallet. */
  reputationScore: number;
  /** How many attestations the wallet has. `0` for an unknown wallet. */
  attestationCount: number;
  /**
   * `github_id_hash` (lowercase hex) currently linked to this wallet, or
   * `null` if the wallet is not linked right now. History can still
   * exist while unlinked (contract-api-v2 §7 step 1).
   */
  linkedGithubIdHashHex: string | null;
}

/** Fetch score + count + current link for a wallet in one shot. */
export async function fetchPassportSummary(walletInput: string): Promise<PassportSummary> {
  const wallet = assertStellarWalletAddress(walletInput);
  const client = getReadClient();
  const [reputationScore, attestationCount, linkedGithubIdHash] = await Promise.all([
    client.getReputationScore(wallet),
    client.getAttestationCount(wallet),
    client.getGithubForWallet(wallet),
  ]);
  return {
    wallet,
    reputationScore,
    attestationCount,
    linkedGithubIdHashHex: linkedGithubIdHash ? bytesToHex(linkedGithubIdHash) : null,
  };
}

export interface AttestationPage {
  records: AttestationView[];
  /** Zero-based index to pass as the next `cursor`, or `null` at the end. */
  nextCursor: number | null;
}

/**
 * One bounded page of a wallet's attestation history (oldest first).
 * `cursor` is a zero-based start index; `limit` is clamped to
 * `1..=MAX_PAGE_SIZE`. `cursor` at or past the end yields an empty page
 * rather than an error.
 */
export async function fetchAttestationPage(
  walletInput: string,
  cursor = 0,
  limit = MAX_PAGE_SIZE,
): Promise<AttestationPage> {
  const wallet = assertStellarWalletAddress(walletInput);
  const start = Number.isInteger(cursor) && cursor > 0 ? cursor : 0;
  const size = Math.min(Math.max(Math.trunc(limit) || MAX_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  let records: AttestationView[];
  try {
    records = await getReadClient().getAttestationsPage(wallet, start, size);
  } catch (err) {
    // `start` strictly past the wallet's count is `PageStartOutOfRange`
    // (#13); the SDK surfaces it so `isPageStartOutOfRange` recognises
    // it. Treat "asked past the end" as an empty page; re-throw anything
    // else. (`start === count` is not an error — the SDK returns `[]`.)
    if (isPageStartOutOfRange(err)) {
      return { records: [], nextCursor: null };
    }
    throw err;
  }

  const nextCursor = records.length === size ? start + records.length : null;
  return { records, nextCursor };
}

/** PR URL rebuilt from an attestation's cleartext fields (identifier-spec §2.6). */
export function attestationPrUrl(record: Pick<AttestationView, "repo" | "prNumber">): string {
  return `https://github.com/${record.repo}/pull/${record.prNumber}`;
}
