/**
 * Passport search resolves ONE free-text query to a wallet to look up.
 *
 * The query is either:
 *  - a Stellar public key (`G...`) — used as-is, no network call; or
 *  - a GitHub handle — resolved to its numeric id (api.github.com),
 *    hashed to a `github_id_hash` with this project's canonical hashing,
 *    then looked up on-chain via `get_wallet_for_github`.
 *
 * Every outcome the UI must phrase differently is its own `kind`. In
 * particular "no such GitHub user" and "that identity is not linked to
 * any wallet" are NOT the same state — one is a GitHub fact, the other
 * an on-chain fact, and a passport search must say which.
 *
 * `deps` is injectable so the pipeline is unit-testable without the
 * network or a live contract.
 */

import { isStellarWalletAddress } from "@/lib/hashing/identifiers";
import { hashGitHubUserIdV1Hex } from "@/lib/hashing";
import { resolveGitHubUser, type GitHubUser } from "@/lib/github/resolveUser";

export interface ResolveIdentityDeps {
  /** handle -> numeric id (+ profile). Defaults to the real GitHub API. */
  resolveUser: typeof resolveGitHubUser;
  /** `github_id_hash` hex -> linked wallet, or null. Defaults to the on-chain read. */
  lookupWalletForGithubIdHash: (githubIdHashHex: string) => Promise<string | null>;
}

export type ResolveIdentityResult =
  | { kind: "wallet"; wallet: string; via: "address" }
  | {
      kind: "linked-wallet";
      wallet: string;
      via: "github";
      githubUser: GitHubUser;
      githubIdHashHex: string;
    }
  | { kind: "github-user-not-linked"; githubUser: GitHubUser; githubIdHashHex: string }
  | { kind: "github-user-not-found"; handle: string }
  | { kind: "github-rate-limited"; retryAfterSeconds: number | null }
  | { kind: "github-error"; message: string; status: number | null }
  | { kind: "unrecognized-input"; reason: string };

/** Rough "could this be a handle at all" gate before we spend a request. */
const MAYBE_HANDLE_RE = /^@?[a-zA-Z0-9-]{1,39}$/;

function looksLikeWalletAttempt(q: string): boolean {
  // Starts like a strkey but isn't a valid one — tell the user that
  // specifically rather than trying it as a GitHub handle.
  return /^G[A-Za-z0-9]{6,}$/.test(q) && !isStellarWalletAddress(q);
}

export async function resolveIdentityQuery(
  rawQuery: string,
  deps: Partial<ResolveIdentityDeps> = {},
): Promise<ResolveIdentityResult> {
  const resolveUser = deps.resolveUser ?? resolveGitHubUser;
  const lookupWallet = deps.lookupWalletForGithubIdHash ?? defaultLookupWallet;

  const query: string = rawQuery.trim();
  if (query.length === 0) {
    return { kind: "unrecognized-input", reason: "Enter a wallet address or a GitHub handle." };
  }

  if (isStellarWalletAddress(query)) {
    return { kind: "wallet", wallet: query, via: "address" };
  }
  // `query` is a plain string past here — reassign so the guard above
  // does not narrow the negative branch to `never`.
  const rest: string = query;

  if (looksLikeWalletAttempt(rest)) {
    return {
      kind: "unrecognized-input",
      reason:
        "That looks like a Stellar address but is not a valid one — a public key is 'G' followed by 55 base32 characters.",
    };
  }

  const handleCandidate = rest
    .replace(/^@/, "")
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\/+$/, "");
  if (!MAYBE_HANDLE_RE.test(rest) && !MAYBE_HANDLE_RE.test(handleCandidate)) {
    return {
      kind: "unrecognized-input",
      reason: "That is neither a Stellar public key (G…) nor a GitHub handle.",
    };
  }

  const resolved = await resolveUser(rest);
  switch (resolved.kind) {
    case "invalid-handle":
      return { kind: "unrecognized-input", reason: resolved.reason };
    case "not-found":
      return { kind: "github-user-not-found", handle: resolved.handle };
    case "rate-limited":
      return { kind: "github-rate-limited", retryAfterSeconds: resolved.retryAfterSeconds };
    case "error":
      return { kind: "github-error", message: resolved.message, status: resolved.status };
    case "found": {
      const githubIdHashHex = hashGitHubUserIdV1Hex(resolved.user.id);
      const wallet = await lookupWallet(githubIdHashHex);
      if (wallet === null) {
        return { kind: "github-user-not-linked", githubUser: resolved.user, githubIdHashHex };
      }
      return {
        kind: "linked-wallet",
        wallet,
        via: "github",
        githubUser: resolved.user,
        githubIdHashHex,
      };
    }
  }
}

/**
 * Default on-chain lookup: hex `github_id_hash` -> linked wallet. Lives
 * here (not imported at module top) so a test that never reaches the
 * "found" branch does not pull in the SDK / RPC client.
 */
async function defaultLookupWallet(githubIdHashHex: string): Promise<string | null> {
  const [{ getReadClient }, { hexToBytes32 }] = await Promise.all([
    import("@/lib/chain/readClient"),
    import("@/lib/hashing/identifiers"),
  ]);
  return getReadClient().getWalletForGithub(hexToBytes32(githubIdHashHex));
}
