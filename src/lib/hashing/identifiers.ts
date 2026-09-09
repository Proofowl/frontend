/**
 * Canonical identifier hashing — PORTED VERBATIM from
 * proofowl-backend/src/hashing/identifiers.ts (which is itself an
 * independent, from-spec implementation of
 * proofowl-contracts/docs/integration/identifier-spec-v1.md).
 *
 * WHY A PORT AND NOT A RE-EXPORT of `@proofowl/contract-sdk`'s
 * `hashGitHubUserIdV1Hex`: the spec's whole point is that every
 * implementer produces the SAME 32 bytes. proofowl-backend deliberately
 * keeps its own copy and pins it in tests against BOTH the spec vectors
 * AND the SDK's exports, so a divergence fails CI rather than surfacing
 * as a bad lookup. This repo follows the same discipline —
 * src/lib/hashing/identifiers.test.ts cross-checks this module against
 * the SDK and the published vectors.
 *
 * `node:crypto` here resolves to the real module in Node (tests) and to
 * src/lib/hashing/sha256-browser.ts in the client bundle (next.config
 * webpack alias). See docs/investigation/02-browser-sdk-proof.md.
 *
 * Rules implemented verbatim from the spec:
 *  - SHA-256, one pass, over the UTF-8 bytes of a canonical ASCII string.
 *  - Hex form: lowercase, exactly 64 chars, no `0x`.
 *  - A byte outside 0x20..0x7E in any segment is a hard rejection.
 *  - Leading/trailing ASCII whitespace in a raw input is stripped once;
 *    interior whitespace is a rejection.
 */

import { createHash } from "node:crypto";

import { ValidationError } from "../errors";

// --- low level -----------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(Buffer.from(input, "utf8")).digest("hex");
}

function sha256Bytes(input: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(Buffer.from(input, "utf8")).digest());
}

/** Lowercase 64-char hex for a 32-byte value. */
export function bytesToHex(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) {
    throw new ValidationError("bytesToHex expects a 32-byte Uint8Array");
  }
  return Buffer.from(bytes).toString("hex");
}

/** Parse a 64-char hex string (either case) into 32 bytes. */
export function hexToBytes32(hex: string): Uint8Array {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new ValidationError("hexToBytes32 expects a 64-character hex string (32 bytes)");
  }
  return new Uint8Array(Buffer.from(hex, "hex"));
}

function assertAsciiPrintableNoInteriorSpace(value: string, label: string): void {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) {
      throw new ValidationError(`${label} contains a non-ASCII or control byte at index ${i}`);
    }
  }
  if (/\s/.test(value)) {
    throw new ValidationError(`${label} must not contain whitespace`);
  }
}

// --- §1 GitHub identity hash ------------------------------------------

/** The fixed canonical-string prefix from identifier-spec-v1 §1.2. */
export const GITHUB_USER_ID_PREFIX_V1 = "proofowl:github-user:v1:";

/** `2^53 - 1`, the JS safe-integer ceiling the spec caps ids at. */
const MAX_GITHUB_USER_ID = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Validate a GitHub numeric user id and return its canonical decimal
 * rendering (spec §1.2): base-10, `^[1-9][0-9]*$`, `1 <= id <= 2^53-1`.
 */
export function canonicalGitHubUserIdDecimal(githubUserId: number | bigint | string): string {
  let n: bigint;
  if (typeof githubUserId === "bigint") {
    n = githubUserId;
  } else if (typeof githubUserId === "number") {
    if (!Number.isInteger(githubUserId)) {
      throw new ValidationError("githubUserId number must be an integer");
    }
    n = BigInt(githubUserId);
  } else if (typeof githubUserId === "string") {
    if (!/^[1-9][0-9]*$/.test(githubUserId)) {
      throw new ValidationError(
        "githubUserId string must be base-10 digits, no sign, no leading zeros, no whitespace",
      );
    }
    n = BigInt(githubUserId);
  } else {
    throw new ValidationError("githubUserId must be a number, bigint, or string");
  }
  if (n < 1n) throw new ValidationError("githubUserId must be >= 1");
  if (n > MAX_GITHUB_USER_ID) throw new ValidationError("githubUserId must be <= 2^53 - 1");
  return n.toString(10);
}

/** The exact string that gets hashed for a GitHub identity (spec §1.2). */
export function canonicalGitHubUserIdStringV1(githubUserId: number | bigint | string): string {
  return GITHUB_USER_ID_PREFIX_V1 + canonicalGitHubUserIdDecimal(githubUserId);
}

/** `github_id_hash` as raw 32 bytes (spec §1.3). */
export function hashGitHubUserIdV1(githubUserId: number | bigint | string): Uint8Array {
  return sha256Bytes(canonicalGitHubUserIdStringV1(githubUserId));
}

/** `github_id_hash` as lowercase 64-char hex (spec §1.3). */
export function hashGitHubUserIdV1Hex(githubUserId: number | bigint | string): string {
  return sha256Hex(canonicalGitHubUserIdStringV1(githubUserId));
}

// --- §2 Pull-request hash -------------------------------------------

const OWNER_RE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const REPO_RE = /^[a-z0-9._-]{1,100}$/;
const U32_MAX = 0xffff_ffff;

export interface NormalizedPullRequest {
  owner: string;
  repo: string;
  /** PR number as a safe integer in `[1, 2^32 - 1]`. */
  number: number;
  /** `github.com/<owner>/<repo>/pull/<number>` — the string that is hashed. */
  canonical: string;
}

function normalizeOwner(owner: string): string {
  if (typeof owner !== "string") throw new ValidationError("owner must be a string");
  let o = owner.trim();
  if (o.startsWith("@")) o = o.slice(1); // strip ONE leading @ (spec §2.2)
  assertAsciiPrintableNoInteriorSpace(o, "owner");
  o = o.toLowerCase();
  if (!OWNER_RE.test(o)) {
    throw new ValidationError(
      `owner ${JSON.stringify(owner)} is not a valid GitHub login ` +
        "(1-39 chars of [A-Za-z0-9-], no leading/trailing hyphen)",
    );
  }
  return o;
}

function normalizeRepo(repo: string): string {
  if (typeof repo !== "string") throw new ValidationError("repo must be a string");
  let r = repo.trim();
  if (r.toLowerCase().endsWith(".git")) r = r.slice(0, -4); // strip ONE trailing .git (spec §2.2)
  assertAsciiPrintableNoInteriorSpace(r, "repo");
  if (r.includes("/")) throw new ValidationError("repo must not contain '/'");
  r = r.toLowerCase();
  if (r === "." || r === "..") {
    throw new ValidationError("repo must not be '.' or '..' (path-traversal guard)");
  }
  if (!REPO_RE.test(r)) {
    throw new ValidationError(
      `repo ${JSON.stringify(repo)} is not a valid GitHub repo name (1-100 chars of [A-Za-z0-9._-])`,
    );
  }
  return r;
}

function normalizePullNumber(pullNumber: number | bigint | string): number {
  let s: string;
  if (typeof pullNumber === "number") {
    if (!Number.isInteger(pullNumber)) throw new ValidationError("pullNumber must be an integer");
    s = pullNumber.toString(10);
  } else if (typeof pullNumber === "bigint") {
    s = pullNumber.toString(10);
  } else if (typeof pullNumber === "string") {
    let t = pullNumber.trim();
    if (t.startsWith("#")) t = t.slice(1); // strip ONE leading # (spec §2.2)
    s = t;
  } else {
    throw new ValidationError("pullNumber must be a number, bigint, or string");
  }
  if (!/^[1-9][0-9]*$/.test(s)) {
    throw new ValidationError(
      "pullNumber must be a positive integer with no leading zeros or sign",
    );
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > U32_MAX) {
    throw new ValidationError("pullNumber must be in [1, 2^32 - 1]");
  }
  return n;
}

/**
 * Normalize `(owner, repo, pullNumber)` to the canonical PR identity
 * (spec §2.1–2.3). Absorbs a leading `@` on the owner, a trailing `.git`
 * on the repo, a leading `#` on the number, and ASCII case.
 */
export function normalizeGitHubPullRequest(
  owner: string,
  repo: string,
  pullNumber: number | bigint | string,
): NormalizedPullRequest {
  const o = normalizeOwner(owner);
  const r = normalizeRepo(repo);
  const n = normalizePullNumber(pullNumber);
  return { owner: o, repo: r, number: n, canonical: `github.com/${o}/${r}/pull/${n}` };
}

/** `pr_hash` as raw 32 bytes (spec §2.3). */
export function hashGitHubPullRequestV1(
  owner: string,
  repo: string,
  pullNumber: number | bigint | string,
): Uint8Array {
  return sha256Bytes(normalizeGitHubPullRequest(owner, repo, pullNumber).canonical);
}

/** `pr_hash` as lowercase 64-char hex (spec §2.3). */
export function hashGitHubPullRequestV1Hex(
  owner: string,
  repo: string,
  pullNumber: number | bigint | string,
): string {
  return sha256Hex(normalizeGitHubPullRequest(owner, repo, pullNumber).canonical);
}

// --- on-chain identifier SHAPE validators -----------------------------

/** Stellar ed25519 public-key strkey: `G` + 55 base32 (`A-Z`, `2-7`). */
export const STELLAR_WALLET_RE = /^G[A-Z2-7]{55}$/;

/** True iff `value` has the Stellar public-key strkey shape. */
export function isStellarWalletAddress(value: unknown): value is string {
  return typeof value === "string" && STELLAR_WALLET_RE.test(value);
}

/** Return `value` if it is a Stellar public-key strkey, else throw. */
export function assertStellarWalletAddress(value: unknown): string {
  if (!isStellarWalletAddress(value)) {
    throw new ValidationError(
      "wallet must be a Stellar public key: 'G' followed by 55 base32 (A-Z, 2-7) characters",
    );
  }
  return value;
}

/** `github_id_hash` hex serialization (spec §1.3): exactly 64 hex chars. */
export const GITHUB_ID_HASH_HEX_RE = /^[0-9a-fA-F]{64}$/;

/** True iff `value` is a 64-character hex string (either case). */
export function isGithubIdHashHex(value: unknown): value is string {
  return typeof value === "string" && GITHUB_ID_HASH_HEX_RE.test(value);
}

/** Return `value` lowercased if it is a 64-char hex string, else throw. */
export function assertGithubIdHashHex(value: unknown): string {
  if (!isGithubIdHashHex(value)) {
    throw new ValidationError("github_id_hash must be a 64-character hex string");
  }
  return value.toLowerCase();
}

/**
 * Recompute a `pr_hash` from an on-chain `Attestation`'s cleartext
 * `repo` (`"<owner>/<repo>"`) and `pr_number` and compare to the stored
 * hex (spec §2.6). Render the "verified" badge on a passport only when
 * this returns true.
 */
export function verifyAttestationPrHash(
  repo: string,
  prNumber: number,
  prHashHex: string,
): boolean {
  const slash = repo.indexOf("/");
  if (slash <= 0 || slash !== repo.lastIndexOf("/")) {
    throw new ValidationError('repo must be "<owner>/<repo>"');
  }
  const computed = hashGitHubPullRequestV1Hex(
    repo.slice(0, slash),
    repo.slice(slash + 1),
    prNumber,
  );
  return computed === prHashHex.toLowerCase();
}
