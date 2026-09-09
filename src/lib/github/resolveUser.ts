/**
 * Resolve a GitHub handle to its immutable numeric user id via GitHub's
 * public REST API (unauthenticated): `GET https://api.github.com/users/:username`.
 *
 * identifier-spec-v1 §1.1: the hash input is the numeric id, NEVER the
 * login — a login can be renamed and re-claimed. So a passport lookup by
 * handle must go handle -> id first, and the id is what gets hashed.
 *
 * Every distinct upstream outcome is its own result `kind` so the UI can
 * say something true: an unknown handle is not the same as being rate
 * limited, which is not the same as a malformed handle. `fetchImpl` is
 * injectable for tests.
 */

export interface GitHubUser {
  /** Numeric user id — the value identifier-spec-v1 hashes. */
  id: number;
  /** Canonical login as GitHub returned it (casing preserved). */
  login: string;
  avatarUrl: string | null;
  htmlUrl: string;
  name: string | null;
}

export type ResolveUserResult =
  | { kind: "found"; user: GitHubUser }
  | { kind: "invalid-handle"; reason: string }
  | { kind: "not-found"; handle: string }
  | { kind: "rate-limited"; retryAfterSeconds: number | null }
  | { kind: "error"; status: number | null; message: string };

/** GitHub login rule: 1–39 chars of [A-Za-z0-9-], no leading/trailing hyphen. */
const HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

const API_BASE = "https://api.github.com/users/";

function normaliseHandle(raw: string): string {
  let h = raw.trim();
  if (h.startsWith("@")) h = h.slice(1);
  if (h.startsWith("https://github.com/")) h = h.slice("https://github.com/".length);
  if (h.startsWith("github.com/")) h = h.slice("github.com/".length);
  return h.replace(/\/+$/, "");
}

function retryAfterFromHeaders(headers: Headers): number | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter);
  const reset = headers.get("x-ratelimit-reset");
  if (reset && /^\d+$/.test(reset)) {
    const secs = Number(reset) - Math.floor(Date.now() / 1000);
    return secs > 0 ? secs : 0;
  }
  return null;
}

export async function resolveGitHubUser(
  rawHandle: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolveUserResult> {
  const handle = normaliseHandle(rawHandle);
  if (!HANDLE_RE.test(handle)) {
    return {
      kind: "invalid-handle",
      reason:
        "A GitHub handle is 1–39 characters of letters, digits, or hyphens, with no leading or trailing hyphen.",
    };
  }

  let res: Response;
  try {
    res = await fetchImpl(`${API_BASE}${encodeURIComponent(handle)}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch (err) {
    return {
      kind: "error",
      status: null,
      message: err instanceof Error ? err.message : "network request to api.github.com failed",
    };
  }

  if (res.status === 404) {
    return { kind: "not-found", handle };
  }

  if (res.status === 403 || res.status === 429) {
    // Unauthenticated GitHub API is 60 req/hr/IP. A 403 with
    // x-ratelimit-remaining: 0 (or any 429) is the rate-limit case.
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (res.status === 429 || remaining === "0") {
      return { kind: "rate-limited", retryAfterSeconds: retryAfterFromHeaders(res.headers) };
    }
    return {
      kind: "error",
      status: res.status,
      message: "api.github.com refused the request (403)",
    };
  }

  if (!res.ok) {
    return {
      kind: "error",
      status: res.status,
      message: `api.github.com returned HTTP ${res.status}`,
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      kind: "error",
      status: res.status,
      message: "api.github.com returned a non-JSON body",
    };
  }

  const b = body as Record<string, unknown>;
  if (typeof b.id !== "number" || typeof b.login !== "string") {
    return {
      kind: "error",
      status: res.status,
      message: "api.github.com response missing id/login",
    };
  }

  return {
    kind: "found",
    user: {
      id: b.id,
      login: b.login,
      avatarUrl: typeof b.avatar_url === "string" ? b.avatar_url : null,
      htmlUrl: typeof b.html_url === "string" ? b.html_url : `https://github.com/${b.login}`,
      name: typeof b.name === "string" ? b.name : null,
    },
  };
}
