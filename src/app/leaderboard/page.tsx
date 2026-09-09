import type { Metadata } from "next";
import Link from "next/link";

import { Callout } from "@/components/Callout";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "A ranked view of contributor reputation — not available in this version.",
};

export default function LeaderboardPage() {
  return (
    <div className="stack-lg">
      <header className="stack-sm">
        <p className="label">Leaderboard</p>
        <h1>Not available yet</h1>
        <p className="lede prose">
          There is no leaderboard here, and there is no sample data standing in for one.
        </p>
      </header>

      <div className="prose stack-sm">
        <p>
          A leaderboard needs cross-wallet data — every wallet that has ever earned reputation,
          ranked. The contract has no &ldquo;list all wallets&rdquo; read: reputation is looked up
          one wallet at a time, and you only learn a wallet exists by having seen its events. So a
          leaderboard is an event-aggregation problem.
        </p>
        <p>
          The public Soroban testnet RPC keeps events in a rolling window of roughly seven days, not
          indefinitely. A view built on live event scans would be correct today and then silently go
          partial as history ages out of that window — a wallet whose activity fell out of range
          would simply stop appearing, with no error. Its score would still be on-chain and correct;
          the leaderboard just couldn&rsquo;t discover the wallet to ask.
        </p>
        <p>
          Doing this properly needs a standing event-indexing service that has been recording since
          a contract&rsquo;s deployment and persists what it sees. No such service exists yet.
          Rather than ship a ranking that quietly rots, this version leaves the leaderboard out.
        </p>
      </div>

      <Callout title="What you can do now" variant="muted">
        Look up any wallet or GitHub handle directly on the{" "}
        <Link href="/passport">passport page</Link> — those reads are authoritative and always
        current.
      </Callout>
    </div>
  );
}
