import { describe, expect, it, vi } from "vitest";

import { resolveIdentityQuery } from "./identity";
import type { ResolveUserResult } from "@/lib/github/resolveUser";
import { hashGitHubUserIdV1Hex } from "@/lib/hashing";

const DEMO_WALLET = "GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER";
// e2e-demo.md: login maztah1, numeric id 267481210.
const MAZTAH1: ResolveUserResult = {
  kind: "found",
  user: {
    id: 267481210,
    login: "maztah1",
    avatarUrl: null,
    htmlUrl: "https://github.com/maztah1",
    name: null,
  },
};
const MAZTAH1_HASH = "6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51";

describe("resolveIdentityQuery — wallet input (no network)", () => {
  it("passes a valid G... key straight through", async () => {
    const resolveUser = vi.fn();
    const lookupWalletForGithubIdHash = vi.fn();
    const result = await resolveIdentityQuery(DEMO_WALLET, {
      resolveUser: resolveUser as never,
      lookupWalletForGithubIdHash,
    });
    expect(result).toEqual({ kind: "wallet", wallet: DEMO_WALLET, via: "address" });
    expect(resolveUser).not.toHaveBeenCalled();
    expect(lookupWalletForGithubIdHash).not.toHaveBeenCalled();
  });

  it("a G-ish string that is not a valid strkey -> unrecognized-input (not tried as a handle)", async () => {
    const resolveUser = vi.fn();
    const result = await resolveIdentityQuery("GABC123notreal", {
      resolveUser: resolveUser as never,
      lookupWalletForGithubIdHash: vi.fn(),
    });
    expect(result.kind).toBe("unrecognized-input");
    expect(resolveUser).not.toHaveBeenCalled();
  });

  it("obvious junk -> unrecognized-input", async () => {
    const result = await resolveIdentityQuery("not a handle!!", {
      resolveUser: vi.fn() as never,
      lookupWalletForGithubIdHash: vi.fn(),
    });
    expect(result.kind).toBe("unrecognized-input");
  });

  it("empty -> unrecognized-input", async () => {
    const result = await resolveIdentityQuery("   ", {
      resolveUser: vi.fn() as never,
      lookupWalletForGithubIdHash: vi.fn(),
    });
    expect(result.kind).toBe("unrecognized-input");
  });
});

describe("resolveIdentityQuery — handle input, distinct terminal states", () => {
  it("found + linked -> linked-wallet, hashing the NUMERIC id", async () => {
    const lookupWalletForGithubIdHash = vi.fn(async () => DEMO_WALLET);
    const result = await resolveIdentityQuery("@maztah1", {
      resolveUser: async () => MAZTAH1,
      lookupWalletForGithubIdHash,
    });
    expect(result).toEqual({
      kind: "linked-wallet",
      wallet: DEMO_WALLET,
      via: "github",
      githubUser: MAZTAH1.kind === "found" ? MAZTAH1.user : undefined,
      githubIdHashHex: MAZTAH1_HASH,
    });
    // the hash handed to the on-chain lookup is hash(id), not hash(login)
    expect(lookupWalletForGithubIdHash).toHaveBeenCalledWith(hashGitHubUserIdV1Hex(267481210));
  });

  it("found + NOT linked -> github-user-not-linked (an on-chain fact)", async () => {
    const result = await resolveIdentityQuery("maztah1", {
      resolveUser: async () => MAZTAH1,
      lookupWalletForGithubIdHash: async () => null,
    });
    expect(result).toEqual({
      kind: "github-user-not-linked",
      githubUser: MAZTAH1.kind === "found" ? MAZTAH1.user : undefined,
      githubIdHashHex: MAZTAH1_HASH,
    });
  });

  it("no such GitHub user -> github-user-not-found (a GitHub fact — distinct from not-linked)", async () => {
    const lookup = vi.fn();
    const result = await resolveIdentityQuery("ghost-user-xyz", {
      resolveUser: async () => ({ kind: "not-found", handle: "ghost-user-xyz" }),
      lookupWalletForGithubIdHash: lookup,
    });
    expect(result).toEqual({ kind: "github-user-not-found", handle: "ghost-user-xyz" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("GitHub rate limit propagates as github-rate-limited", async () => {
    const result = await resolveIdentityQuery("torvalds", {
      resolveUser: async () => ({ kind: "rate-limited", retryAfterSeconds: 55 }),
      lookupWalletForGithubIdHash: vi.fn(),
    });
    expect(result).toEqual({ kind: "github-rate-limited", retryAfterSeconds: 55 });
  });

  it("GitHub transport error propagates as github-error", async () => {
    const result = await resolveIdentityQuery("torvalds", {
      resolveUser: async () => ({ kind: "error", status: null, message: "Failed to fetch" }),
      lookupWalletForGithubIdHash: vi.fn(),
    });
    expect(result).toEqual({ kind: "github-error", message: "Failed to fetch", status: null });
  });

  it("resolver says the handle is malformed -> unrecognized-input", async () => {
    const result = await resolveIdentityQuery("torvalds", {
      resolveUser: async () => ({ kind: "invalid-handle", reason: "bad handle" }),
      lookupWalletForGithubIdHash: vi.fn(),
    });
    expect(result).toEqual({ kind: "unrecognized-input", reason: "bad handle" });
  });
});
