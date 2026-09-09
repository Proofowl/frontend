/** Small presentation helpers — no domain logic. */

/** `GABC…WXYZ` — keep head/tail chars, elide the middle. */
export function truncateMiddle(value: string, head = 6, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Reputation score with thousands separators. */
export function formatScore(score: number): string {
  return score.toLocaleString("en-US");
}

/** Ledger close time (Unix seconds, possibly bigint) → `YYYY-MM-DD HH:MM UTC`. */
export function formatTimestamp(unixSeconds: bigint | number): string {
  const secs = typeof unixSeconds === "bigint" ? Number(unixSeconds) : unixSeconds;
  if (!Number.isFinite(secs) || secs <= 0) return "—";
  const d = new Date(secs * 1000);
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** `1 attestation` / `4 attestations`. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

/** Complexity tier → a short human label (contract-api-v2: 0|100|150|200). */
export function complexityLabel(complexity: number): string {
  switch (complexity) {
    case 0:
      return "confirmed · tier unknown";
    case 100:
      return "tier 100";
    case 150:
      return "tier 150";
    case 200:
      return "tier 200";
    default:
      return `complexity ${complexity}`;
  }
}

/** What a tier contributes to the score (0 scores at the flat base of 50). */
export function complexityContribution(complexity: number): number {
  return complexity > 0 ? complexity : 50;
}
