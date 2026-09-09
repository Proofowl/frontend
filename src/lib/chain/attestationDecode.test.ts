import { describe, expect, it, vi } from "vitest";

// Keep `rpc` (and everything else) real; only replace the final
// ScVal->JS hop so we can feed plain fixture rows instead of building
// XDR ScVals by hand. This mirrors exactly what the shim isolates.
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return { ...actual, scValToNative: (v: unknown) => v };
});

const { __test, decodeAttestationsPage, decodeAllAttestations } =
  await import("./attestationDecode");
const { decodeOne, toHex } = __test;

function bytesFromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// e2e-demo.md §C7 / §D — attestation[0] for the demo wallet.
const GH_HASH = "6054b7be2332bad64108b27f181cfc8dfcb15cc0106de5671bd9519c2e071a51";
const PR_HASH = "d07879a0ea96f8f8995a531d4d8792c54b93151b020da468f41bdccf0ff15112";

function demoRow(): Record<string, unknown> {
  return {
    github_id_hash: bytesFromHex(GH_HASH),
    repo: "proofowl/backend",
    pr_number: 5,
    issue_id: 4n,
    complexity: 0,
    pr_hash: bytesFromHex(PR_HASH),
    timestamp: 1788910177n,
  };
}

describe("toHex", () => {
  it("handles a Uint8Array", () => {
    expect(toHex(bytesFromHex(GH_HASH))).toBe(GH_HASH);
  });

  it("handles the plain {type:'Buffer',data:[...]} shape scValToNative can emit", () => {
    expect(toHex({ type: "Buffer", data: [...bytesFromHex(PR_HASH)] })).toBe(PR_HASH);
  });

  it("throws UpstreamError on a non-bytes value", () => {
    expect(() => toHex("not bytes")).toThrow(/expected 32-byte value/);
  });
});

describe("decodeOne", () => {
  it("decodes the e2e-demo attestation and carries the sequence through", () => {
    const rec = decodeOne(demoRow(), 0);
    expect(rec).toEqual({
      githubIdHashHex: GH_HASH,
      repo: "proofowl/backend",
      prNumber: 5,
      issueId: 4n,
      complexity: 0,
      prHashHex: PR_HASH,
      timestamp: 1788910177n,
      sequence: 0,
    });
  });

  it("coerces issue_id / timestamp from number or decimal string to bigint", () => {
    const rec = decodeOne({ ...demoRow(), issue_id: 4, timestamp: "1788910177" }, 3);
    expect(rec.issueId).toBe(4n);
    expect(rec.timestamp).toBe(1788910177n);
    expect(rec.sequence).toBe(3);
  });
});

// A fake generated client: get_attestations_page returns an object shaped
// just enough for the shim's `retvalOf` (a non-error simulation with a
// `.result.retval`). `retval` is our fixture array (the mocked
// scValToNative passes it straight through).
function fakeClient(pages: Array<Array<Record<string, unknown>>>) {
  let call = 0;
  return {
    get_attestations_page: vi.fn(async (_args: { start: number; limit: number }) => {
      const rows = pages[call++] ?? [];
      return { simulation: { result: { retval: rows } } };
    }),
  };
}

describe("decodeAttestationsPage", () => {
  it("maps rows and assigns sequence = start + index", async () => {
    const client = fakeClient([[demoRow(), { ...demoRow(), pr_number: 6 }]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await decodeAttestationsPage(client as any, "GWALLET", 10, 50);
    expect(page.map((r) => r.sequence)).toEqual([10, 11]);
    expect(page[1]?.prNumber).toBe(6);
  });
});

describe("decodeAllAttestations — the contract-api-v2 §7 paging loop", () => {
  it("follows pages until a short one, concatenating in order", async () => {
    const full = Array.from({ length: 50 }, (_, i) => ({ ...demoRow(), pr_number: i + 1 }));
    const tail = [{ ...demoRow(), pr_number: 51 }];
    const client = fakeClient([full, tail]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = await decodeAllAttestations(client as any, "GWALLET");
    expect(all).toHaveLength(51);
    expect(all.map((r) => r.sequence)).toEqual(Array.from({ length: 51 }, (_, i) => i));
    expect(client.get_attestations_page).toHaveBeenCalledTimes(2);
    // second page requested at start = 50 (advanced by the first page's length)
    expect(client.get_attestations_page).toHaveBeenLastCalledWith({
      wallet: "GWALLET",
      start: 50,
      limit: 50,
    });
  });

  it("stops after one page when the wallet has fewer than a full page", async () => {
    const client = fakeClient([[demoRow()]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = await decodeAllAttestations(client as any, "GWALLET");
    expect(all).toHaveLength(1);
    expect(client.get_attestations_page).toHaveBeenCalledTimes(1);
  });
});
