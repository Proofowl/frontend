/**
 * Error types shared across the lib modules. Mirrors the shape
 * proofowl-backend's `src/lib/errors.ts` uses so the modules ported from
 * there (hashing, attestation decode) drop in unchanged.
 */

/** Bad caller input — a malformed wallet, handle, hash, PR number, ... */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** An upstream (RPC / GitHub API / contract read) failed or misbehaved. */
export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}
