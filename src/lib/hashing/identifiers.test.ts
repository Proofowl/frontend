import { describe, expect, it } from "vitest";

import {
  hashGitHubUserIdV1Hex as sdkHashGitHubUserIdV1Hex,
  hashGitHubPullRequestV1Hex as sdkHashPrV1Hex,
} from "@proofowl/contract-sdk";

import {
  assertGithubIdHashHex,
  assertStellarWalletAddress,
  canonicalGitHubUserIdStringV1,
  hashGitHubPullRequestV1Hex,
  hashGitHubUserIdV1Hex,
  hexToBytes32,
  isGithubIdHashHex,
  isStellarWalletAddress,
  normalizeGitHubPullRequest,
  verifyAttestationPrHash,
} from "./identifiers";
import { ValidationError } from "../errors";

// --- identifier-spec-v1 §1.4 published vectors --------------------------

describe("github_id_hash — spec §1.4 vectors", () => {
  it("id 1", () => {
    expect(canonicalGitHubUserIdStringV1(1)).toBe("proofowl:github-user:v1:1");
    expect(hashGitHubUserIdV1Hex(1)).toBe(
      "ad6494a9db671dce66088a82f8446c464e7d425da57d4eca4081b19a74b1e584",
    );
  });

  it("id 1024025", () => {
    expect(hashGitHubUserIdV1Hex(1024025)).toBe(
      "fd608646c4bd0a96553707213c1680c9dfcb0c9ba47f649ccb1c7924125176cb",
    );
  });

  it("id 267481210 — the e2e-demo identity (login maztah1)", () => {
    // proofowl-backend/docs/testnet/e2e-demo.md Phase B.
    expect(hashGitHubUserIdV1Hex(267481210)).toBe(
      "6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51",
    );
  });

  it("accepts number, bigint, and decimal-string forms identically", () => {
    const asNum = hashGitHubUserIdV1Hex(1024025);
    expect(hashGitHubUserIdV1Hex(1024025n)).toBe(asNum);
    expect(hashGitHubUserIdV1Hex("1024025")).toBe(asNum);
  });
});

describe("github_id_hash — rejections (spec §1.2)", () => {
  it.each([
    ["zero", 0],
    ["negative", -5],
    ["non-integer", 3.5],
    ["leading zero string", "0123"],
    ["non-numeric string", "torvalds"],
    ["whitespace", " 1 "],
    ["above 2^53-1", "9007199254740992"],
  ])("rejects %s", (_label, input) => {
    expect(() => hashGitHubUserIdV1Hex(input as number | string)).toThrow(ValidationError);
  });
});

// --- identifier-spec-v1 §2.4 published vectors -------------------------

describe("pr_hash — spec §2.4 vectors", () => {
  it("stellar/soroban-examples#42", () => {
    expect(hashGitHubPullRequestV1Hex("stellar", "soroban-examples", 42)).toBe(
      "1eed82536f9e3a9477916599ab2111d9af634b1270f5d4d1d61ee98bd50d6c0e",
    );
  });

  it("normalises @owner / .git / #number / casing (row 2)", () => {
    const norm = normalizeGitHubPullRequest("@ProofOwl", "Proofowl-Contracts.git", "#7");
    expect(norm.canonical).toBe("github.com/proofowl/proofowl-contracts/pull/7");
    expect(hashGitHubPullRequestV1Hex("@ProofOwl", "Proofowl-Contracts.git", "#7")).toBe(
      "be9b713cbcbacdc44d593cd3e37f8680f6e7e229af9c2182cde3ee05a2bf6cef",
    );
  });

  it("rejects sub-paths, schemes, and empty parts", () => {
    expect(() => normalizeGitHubPullRequest("o", "r/sub", 1)).toThrow(ValidationError);
    expect(() => normalizeGitHubPullRequest("o", "", 1)).toThrow(ValidationError);
    expect(() => normalizeGitHubPullRequest("o", "r", "0")).toThrow(ValidationError);
  });
});

// --- cross-check against the SDK's reference implementation ------------
//
// proofowl-backend keeps its hashing independent of the SDK and pins the
// two together in CI; this port must stay pinned the same way.

describe("parity with @proofowl/contract-sdk", () => {
  const ids = [1, 2, 7, 42, 1024025, 267481210, Number.MAX_SAFE_INTEGER];
  it.each(ids)("github_id_hash matches the SDK for id %i", (id) => {
    expect(hashGitHubUserIdV1Hex(id)).toBe(sdkHashGitHubUserIdV1Hex(id));
  });

  const prs: Array<[string, string, number]> = [
    ["stellar", "soroban-examples", 42],
    ["proofowl", "backend", 5],
    ["proofowl", "proofowl-contracts", 7],
  ];
  it.each(prs)("pr_hash matches the SDK for %s/%s#%i", (owner, repo, num) => {
    expect(hashGitHubPullRequestV1Hex(owner, repo, num)).toBe(sdkHashPrV1Hex(owner, repo, num));
  });
});

// --- verifyAttestationPrHash -----------------------------------------

describe("verifyAttestationPrHash", () => {
  it("true when the cleartext repo/pr recomputes to the stored hash", () => {
    // e2e-demo attestation[0]: proofowl/backend#5.
    const stored = "d07879a0ea96f8f8995a531d4d8792c54b93151b020da468f41bdccf0ff15112";
    expect(verifyAttestationPrHash("proofowl/backend", 5, stored)).toBe(true);
  });

  it("false on a mismatch", () => {
    expect(verifyAttestationPrHash("proofowl/backend", 6, "00".repeat(32))).toBe(false);
  });
});

// --- shape validators ----------------------------------------------

describe("shape validators", () => {
  const goodWallet = "GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER";

  it("isStellarWalletAddress / assertStellarWalletAddress", () => {
    expect(isStellarWalletAddress(goodWallet)).toBe(true);
    expect(isStellarWalletAddress("gaxz...lower")).toBe(false);
    expect(isStellarWalletAddress("G" + "A".repeat(54))).toBe(false); // 55 chars
    expect(assertStellarWalletAddress(goodWallet)).toBe(goodWallet);
    expect(() => assertStellarWalletAddress("nope")).toThrow(ValidationError);
  });

  it("isGithubIdHashHex / assertGithubIdHashHex (lowercases)", () => {
    const upper = "6054B7BE2332BAD64108B27F181CFC8DFCB15CC0106DE5671BD9519C2E071A51";
    expect(isGithubIdHashHex(upper)).toBe(true);
    expect(assertGithubIdHashHex(upper)).toBe(upper.toLowerCase());
    expect(() => assertGithubIdHashHex("abc")).toThrow(ValidationError);
  });

  it("hexToBytes32 round-trips against the hash output", () => {
    const hex = hashGitHubUserIdV1Hex(267481210);
    const bytes = hexToBytes32(hex);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes).toHaveLength(32);
  });
});
