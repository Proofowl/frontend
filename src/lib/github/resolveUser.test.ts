import { describe, expect, it, vi } from "vitest";

import { resolveGitHubUser } from "./resolveUser";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("resolveGitHubUser — found", () => {
  it("returns the numeric id, login, and profile bits", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        id: 267481210,
        login: "maztah1",
        avatar_url: "https://avatars.githubusercontent.com/u/267481210",
        html_url: "https://github.com/maztah1",
        name: "Maz",
      }),
    );
    const result = await resolveGitHubUser("maztah1", fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({
      kind: "found",
      user: {
        id: 267481210,
        login: "maztah1",
        avatarUrl: "https://avatars.githubusercontent.com/u/267481210",
        htmlUrl: "https://github.com/maztah1",
        name: "Maz",
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/users/maztah1",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("absorbs @handle and github.com/handle forms", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: 1, login: "torvalds" }));
    for (const input of ["@torvalds", "github.com/torvalds", "https://github.com/torvalds/"]) {
      await resolveGitHubUser(input, fetchImpl as unknown as typeof fetch);
    }
    for (const call of fetchImpl.mock.calls) {
      expect(call[0]).toBe("https://api.github.com/users/torvalds");
    }
  });
});

describe("resolveGitHubUser — distinct non-found states", () => {
  it("invalid-handle: never touches the network", async () => {
    const fetchImpl = vi.fn();
    const result = await resolveGitHubUser("-nope-", fetchImpl as unknown as typeof fetch);
    expect(result.kind).toBe("invalid-handle");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("not-found: 404 -> {kind:'not-found', handle}", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404, { message: "Not Found" }));
    const result = await resolveGitHubUser(
      "definitely-not-a-real-user-xyz",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ kind: "not-found", handle: "definitely-not-a-real-user-xyz" });
  });

  it("rate-limited: 403 + x-ratelimit-remaining:0 -> {kind:'rate-limited'} with retry seconds", async () => {
    const reset = String(Math.floor(Date.now() / 1000) + 120);
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        403,
        { message: "rate limit exceeded" },
        { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset },
      ),
    );
    const result = await resolveGitHubUser("torvalds", fetchImpl as unknown as typeof fetch);
    expect(result.kind).toBe("rate-limited");
    if (result.kind === "rate-limited") {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(120);
    }
  });

  it("rate-limited: bare 429 -> {kind:'rate-limited'}", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, {}, { "retry-after": "42" }));
    const result = await resolveGitHubUser("torvalds", fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ kind: "rate-limited", retryAfterSeconds: 42 });
  });

  it("403 that is NOT a rate limit -> {kind:'error', status:403}", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(403, { message: "Forbidden" }, { "x-ratelimit-remaining": "17" }),
    );
    const result = await resolveGitHubUser("torvalds", fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ kind: "error", status: 403 });
  });

  it("network failure -> {kind:'error', status:null}", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await resolveGitHubUser("torvalds", fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ kind: "error", status: null, message: "Failed to fetch" });
  });

  it("2xx but malformed body -> {kind:'error'}", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { login: "x" })); // no id
    const result = await resolveGitHubUser("x", fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ kind: "error" });
  });
});
