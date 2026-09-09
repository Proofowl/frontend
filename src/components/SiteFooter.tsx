import { getChainConfig } from "@/lib/config";
import { truncateMiddle } from "@/lib/format";

export function SiteFooter() {
  const cfg = getChainConfig();
  return (
    <footer className="site-footer">
      <div className="container stack-sm">
        <p className="muted">
          A read-only explorer. It simulates contract reads and, for “view my passport”, asks a
          wallet extension for its public address. It never signs or submits anything.
        </p>
        <p className="faint mono" style={{ fontSize: "0.8rem" }}>
          {cfg.networkLabel} · {truncateMiddle(cfg.contractId, 8, 8)} · {cfg.rpcUrl}
        </p>
        <p className="faint" style={{ fontSize: "0.8rem" }}>
          <a href="https://github.com/Proofowl/proofowl-contracts">proofowl-contracts</a>
          {" · "}
          <a href="https://github.com/Proofowl/backend">proofowl-backend</a>
          {" · "}
          <a href="https://stellar.org">Built on Stellar</a>
        </p>
      </div>
    </footer>
  );
}
