import { describe, expect, it, vi } from "vitest";

// Mock the two collaborators so passport.ts's composition/branching is
// what's under test, not the SDK or the RPC.
const getReadClient = vi.fn();
const getRawClient = vi.fn(() => ({}) as never);
const decodeAttestationsPage = vi.fn();

vi.mock("./readClient", () => ({ getReadClient, getRawClient }));
vi.mock("./attestationDecode", () => ({ decodeAttestationsPage }));

const { fetchPassportSummary, fetchAttestationPage, attestationPrUrl } = await import("./passport");

const WALLET = "GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER";
const GH_HASH = "6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51";

function fakeRecord(sequence: number) {
  return {
    githubIdHashHex: GH_HASH,
    repo: "proofowl/backend",
    prNumber: sequence + 1,
    issueId: 0n,
    complexity: 0,
    prHashHex: "00".repeat(32),
    timestamp: 1788910177n,
    sequence,
  };
}

describe("fetchPassportSummary", () => {
  it("composes score + count + link, converting the link to hex", async () => {
    getReadClient.mockReturnValue({
      getReputationScore: vi.fn(async () => 50),
      getAttestationCount: vi.fn(async () => 1),
      getGithubForWallet: vi.fn(async () =>
        Uint8Array.from(GH_HASH.match(/../g)!.map((h) => parseInt(h, 16))),
      ),
    });
    const summary = await fetchPassportSummary(WALLET);
    expect(summary).toEqual({
      wallet: WALLET,
      reputationScore: 50,
      attestationCount: 1,
      linkedGithubIdHashHex: GH_HASH,
    });
  });

  it("reports linkedGithubIdHashHex: null when the wallet is not currently linked", async () => {
    getReadClient.mockReturnValue({
      getReputationScore: vi.fn(async () => 0),
      getAttestationCount: vi.fn(async () => 0),
      getGithubForWallet: vi.fn(async () => null),
    });
    const summary = await fetchPassportSummary(WALLET);
    expect(summary.linkedGithubIdHashHex).toBeNull();
  });

  it("rejects a malformed wallet before any read", async () => {
    getReadClient.mockReturnValue({});
    await expect(fetchPassportSummary("not-a-wallet")).rejects.toThrow();
  });
});

describe("fetchAttestationPage", () => {
  it("clamps limit to 1..=50 and negative cursor to 0", async () => {
    decodeAttestationsPage.mockResolvedValue([fakeRecord(0)]);
    await fetchAttestationPage(WALLET, -3, 999);
    expect(decodeAttestationsPage).toHaveBeenCalledWith(expect.anything(), WALLET, 0, 50);
  });

  it("computes nextCursor = start + length on a full page, null on a short one", async () => {
    decodeAttestationsPage.mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => fakeRecord(i)),
    );
    const full = await fetchAttestationPage(WALLET, 0, 50);
    expect(full.nextCursor).toBe(50);

    decodeAttestationsPage.mockResolvedValueOnce([fakeRecord(50)]);
    const tail = await fetchAttestationPage(WALLET, 50, 50);
    expect(tail.nextCursor).toBeNull();
  });

  it("treats PageStartOutOfRange (#13) as an empty page, not an error", async () => {
    decodeAttestationsPage.mockRejectedValueOnce(
      new Error("contract read failed with Error(Contract, #13)"),
    );
    const page = await fetchAttestationPage(WALLET, 9999, 50);
    expect(page).toEqual({ records: [], nextCursor: null });
  });

  it("re-throws any other read error", async () => {
    decodeAttestationsPage.mockRejectedValueOnce(new Error("RPC timeout"));
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
