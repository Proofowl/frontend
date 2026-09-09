/**
 * TEMPORARY SHIM around a decode bug in the mandated read path.
 *
 * PORTED from proofowl-backend/src/chain/attestationDecode.ts — same
 * bug, same workaround, deliberately not re-derived. See
 * docs/investigation/02-browser-sdk-proof.md, which reproduced the exact
 * failure in a browser.
 *
 * `@proofowl/contract-sdk`'s `createReadClient().getAttestation()` /
 * `.getAttestationsPage()` throw
 *   `ScSpecType scSpecTypeU64 was not string or symbol, but {scvString ...}`
 * when decoding the `Attestation` struct returned by the live v0.3
 * (crate 0.3.0) contract. The bug is in `@stellar/stellar-sdk`'s
 * spec-driven struct decoder (`Spec.structToNative`, pinned `^16.0.1` by
 * the SDK) — it mis-aligns the key-sorted `ScMap` the host returns
 * against the embedded contract spec's field order. The scalar reads
 * (`get_admin`, `get_attestor`, `get_attestation_count`,
 * `get_reputation_score`, `get_wallet_for_github`, `get_github_for_wallet`)
 * are unaffected and are used directly from the SDK.
 *
 * This shim keeps using the SDK's generated `Client` for the RPC round
 * trip and the transaction assembly — it does NOT hand-roll bindings —
 * and only substitutes the final ScVal -> JS step with the generic,
 * spec-less `scValToNative`, which reads the map by key name and works.
 *
 * Remove this module once the SDK bumps `@stellar/stellar-sdk` to a
 * release that decodes the struct, and switch callers back to
 * `readClient.getAttestationsPage`.
 */

import { rpc, scValToNative } from "@stellar/stellar-sdk";
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { generated } from "@proofowl/contract-sdk";

import { UpstreamError } from "../errors";

/** The SDK's verbatim generated contract client (its RPC + tx-assembly path). */
export type GeneratedClient = InstanceType<typeof generated.Client>;

/** One attestation, decoded from the contract's `Attestation` struct. */
export interface AttestationRecord {
  /** `github_id_hash` linked to the wallet when this entry was recorded (ADR 0005), lowercase hex. */
  githubIdHashHex: string;
  /** `"<owner>/<repo>"` exactly as stored on-chain. */
  repo: string;
  prNumber: number;
  /** Stellar Wave issue id, or 0n. */
  issueId: bigint;
  /** One of 0, 100, 150, 200. */
  complexity: number;
  /** Canonical PR hash — the global de-dup key — lowercase hex. */
  prHashHex: string;
  /** Ledger close time (Unix seconds) the contract recorded. */
  timestamp: bigint;
  /** Zero-based index in the wallet's history (`start + offset`). */
  sequence: number;
}

const CONTRACT_ERR_RE = /Error\(Contract,\s*#(\d+)\)/;

function toHex(v: unknown): string {
  if (v instanceof Uint8Array) return Buffer.from(v).toString("hex");
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) return (v as Buffer).toString("hex");
  if (v && typeof v === "object" && "data" in (v as Record<string, unknown>)) {
    // scValToNative can hand back a plain {type:"Buffer",data:[...]} object.
    return Buffer.from((v as { data: number[] }).data).toString("hex");
  }
  throw new UpstreamError(`expected 32-byte value in attestation, got ${typeof v}`);
}

function decodeOne(raw: Record<string, unknown>, sequence: number): AttestationRecord {
  return {
    githubIdHashHex: toHex(raw.github_id_hash),
    repo: String(raw.repo),
    prNumber: Number(raw.pr_number),
    issueId: BigInt(raw.issue_id as string | number | bigint),
    complexity: Number(raw.complexity),
    prHashHex: toHex(raw.pr_hash),
    timestamp: BigInt(raw.timestamp as string | number | bigint),
    sequence,
  };
}

function retvalOf(tx: AssembledTransaction<unknown>): unknown {
  const sim = tx.simulation;
  if (!sim) throw new UpstreamError("contract read was not simulated");
  if (rpc.Api.isSimulationError(sim)) {
    const m = CONTRACT_ERR_RE.exec(sim.error);
    throw new UpstreamError(
      m
        ? `contract read failed with Error(Contract, #${m[1]})`
        : `contract read failed: ${sim.error}`,
    );
  }
  const result = (sim as rpc.Api.SimulateTransactionSuccessResponse).result;
  if (!result) throw new UpstreamError("contract read returned no result");
  return scValToNative(result.retval);
}

/**
 * Read one bounded page of `wallet`'s attestation history via the SDK's
 * generated client, decoded with the spec-less path. `start`/`limit`
 * follow the same rules as `get_attestations_page` (limit 1..=50).
 */
export async function decodeAttestationsPage(
  client: GeneratedClient,
  wallet: string,
  start: number,
  limit: number,
): Promise<AttestationRecord[]> {
  const tx = await client.get_attestations_page({ wallet, start, limit });
  const native = retvalOf(tx as AssembledTransaction<unknown>);
  if (!Array.isArray(native)) {
    throw new UpstreamError("get_attestations_page did not decode to an array");
  }
  return native.map((row, i) => decodeOne(row as Record<string, unknown>, start + i));
}

/**
 * Page through `wallet`'s entire attestation history (oldest first),
 * following the contract-api-v2 §7 loop: advance `start` by the page
 * length, stop on a short page. `pageLimit` defaults to the max (50).
 */
export async function decodeAllAttestations(
  client: GeneratedClient,
  wallet: string,
  pageLimit = 50,
): Promise<AttestationRecord[]> {
  const all: AttestationRecord[] = [];
  let start = 0;
  // Hard ceiling so a misbehaving RPC can't spin forever.
  for (let guard = 0; guard < 10_000; guard++) {
    const page = await decodeAttestationsPage(client, wallet, start, pageLimit);
    all.push(...page);
    if (page.length < pageLimit) break;
    start += page.length;
  }
  return all;
}

/** Internals, exported for unit tests only. */
export const __test = { decodeOne, toHex };
