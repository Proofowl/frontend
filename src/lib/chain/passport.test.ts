import { describe, expect, it, vi } from "vitest";

// Mock only the read client so passport.ts's composition / branching is
// what's under test, not the SDK or the RPC. `isPageStartOutOfRange`
// stays real (imported from @proofowl/contract-sdk).
const getReadClient = vi.fn();
vi.mock("./readClient", () => ({ getReadClient }));

const { fetchPassportSummary, fetchAttestationPage, attestationPrUrl } = await import("./passport");

const WALLET = "GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER";
const GH_HASH = "6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51";

// Minimal AttestationView-shaped fixture (only the fields these tests read).
function fakeView(sequence: number) {
  return {
    githubIdHash: new Uint8Array(32),
    githubIdHashHex: GH_HASH,
    repo: "proofowl/backend",
    prNumber: sequence + 1,
    issueId: 0n,
    complexity: 0,
    prHash: new Uint8Array(32),
    prHashHex: "00".repeat(32),
    timestamp: 1788910177n,
    sequence,
  };
}

/** A fake ProofOwlReadClient with just the methods passport.ts calls. */
function fakeClient(over: Record<string, unknown> = {}) {
  return {
    getReputationScore: vi.fn(async () => 0),
    getAttestationCount: vi.fn(async () => 0),
    getGithubForWallet: vi.fn(async () => null),
    getAttestationsPage: vi.fn(async () => [] as ReturnType<typeof fakeView>[]),
    ...over,
  };
}

describe("fetchPassportSummary", () => {
  it("composes score + count + link, converting the link to hex", async () => {
    getReadClient.mockReturnValue(
      fakeClient({
        getReputationScore: vi.fn(async () => 50),
        getAttestationCount: vi.fn(async () => 1),
        getGithubForWallet: vi.fn(async () =>
          Uint8Array.from(GH_HASH.match(/../g)!.map((h) => parseInt(h, 16))),
        ),
      }),
    );
    const summary = await fetchPassportSummary(WALLET);
    expect(summary).toEqual({
      wallet: WALLET,
      reputationScore: 50,
      attestationCount: 1,
      linkedGithubIdHashHex: GH_HASH,
    });
  });

  it("reports linkedGithubIdHashHex: null when the wallet is not currently linked", async () => {
    getReadClient.mockReturnValue(fakeClient());
    const summary = await fetchPassportSummary(WALLET);
    expect(summary.linkedGithubIdHashHex).toBeNull();
  });

  it("rejects a malformed wallet before any read", async () => {
    getReadClient.mockReturnValue(fakeClient());
    await expect(fetchPassportSummary("not-a-wallet")).rejects.toThrow();
  });
});

describe("fetchAttestationPage", () => {
  it("clamps limit to 1..=50 and negative cursor to 0", async () => {
    const client = fakeClient({ getAttestationsPage: vi.fn(async () => [fakeView(0)]) });
    getReadClient.mockReturnValue(client);
    await fetchAttestationPage(WALLET, -3, 999);
    expect(client.getAttestationsPage).toHaveBeenCalledWith(WALLET, 0, 50);
  });

  it("computes nextCursor = start + length on a full page, null on a short one", async () => {
    const full = Array.from({ length: 50 }, (_, i) => fakeView(i));
    const client = fakeClient({
      getAttestationsPage: vi
        .fn()
        .mockResolvedValueOnce(full)
        .mockResolvedValueOnce([fakeView(50)]),
    });
    getReadClient.mockReturnValue(client);

    const page1 = await fetchAttestationPage(WALLET, 0, 50);
    expect(page1.nextCursor).toBe(50);

    const page2 = await fetchAttestationPage(WALLET, 50, 50);
    expect(page2.nextCursor).toBeNull();
  });

  it("treats PageStartOutOfRange (#13) from the SDK as an empty page, not an error", async () => {
    const client = fakeClient({
      getAttestationsPage: vi
        .fn()
        .mockRejectedValueOnce(new Error("get_attestations_page failed: Error(Contract, #13)")),
    });
    getReadClient.mockReturnValue(client);
    const page = await fetchAttestationPage(WALLET, 9999, 50);
    expect(page).toEqual({ records: [], nextCursor: null });
  });

  it("re-throws any other read error", async () => {
    const client = fakeClient({
      getAttestationsPage: vi.fn().mockRejectedValueOnce(new Error("RPC timeout")),
    });
    getReadClient.mockReturnValue(client);
    await expect(fetchAttestationPage(WALLET, 0, 50)).rejects.toThrow("RPC timeout");
  });
});

describe("attestationPrUrl", () => {
  it("rebuilds the PR URL from cleartext repo + number", () => {
    expect(attestationPrUrl({ repo: "proofowl/backend", prNumber: 5 })).toBe(
      "https://github.com/proofowl/backend/pull/5",
    );
  });
});
