"use client";

import { useCallback, useEffect, useState } from "react";

import {
  attestationPrUrl,
  fetchAttestationPage,
  MAX_PAGE_SIZE,
  type AttestationView,
} from "@/lib/chain/passport";
import { verifyAttestationPrHash } from "@/lib/hashing/identifiers";
import {
  complexityContribution,
  complexityLabel,
  formatTimestamp,
  truncateMiddle,
} from "@/lib/format";
import { Callout } from "@/components/Callout";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; records: AttestationView[]; nextCursor: number | null };

export function AttestationHistory({ wallet, total }: { wallet: string; total: number }) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirst = useCallback(() => {
    setState({ phase: "loading" });
    fetchAttestationPage(wallet, 0, MAX_PAGE_SIZE)
      .then((page) =>
        setState({ phase: "ready", records: page.records, nextCursor: page.nextCursor }),
      )
      .catch((err: unknown) =>
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "reading the attestation page failed",
        }),
      );
  }, [wallet]);

  useEffect(loadFirst, [loadFirst]);

  async function loadMore() {
    if (state.phase !== "ready" || state.nextCursor === null) return;
    setLoadingMore(true);
    try {
      const page = await fetchAttestationPage(wallet, state.nextCursor, MAX_PAGE_SIZE);
      setState({
        phase: "ready",
        records: [...state.records, ...page.records],
        nextCursor: page.nextCursor,
      });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "reading the next page failed",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="stack">
      <div className="cluster" style={{ justifyContent: "space-between" }}>
        <h2>Attestations</h2>
        {state.phase === "ready" ? (
          <span className="faint mono" style={{ fontSize: "0.85rem" }}>
            showing {state.records.length} of {total}
          </span>
        ) : null}
      </div>

      {state.phase === "loading" ? (
        <div className="card card--sunken muted">Reading attestation history…</div>
      ) : null}

      {state.phase === "error" ? (
        <Callout variant="danger" title="Could not read the attestation history">
          {state.message}. This is a read-only simulation against the configured Soroban RPC — most
          often a transient RPC error; try again.
        </Callout>
      ) : null}

      {state.phase === "ready" && state.records.length === 0 ? (
        <div className="card card--sunken muted">
          The counter says {total}, but the page read came back empty. If this persists it is worth
          reporting.
        </div>
      ) : null}

      {state.phase === "ready" && state.records.length > 0 ? (
        <ul className="attn-list">
          {state.records.map((r) => (
            <AttestationRow key={r.sequence} record={r} />
          ))}
        </ul>
      ) : null}

      {state.phase === "ready" && state.nextCursor !== null ? (
        <button type="button" className="btn" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : `Load more (${total - state.records.length} left)`}
        </button>
      ) : null}
    </section>
  );
}

function AttestationRow({ record }: { record: AttestationView }) {
  let verified: boolean | null = null;
  try {
    verified = verifyAttestationPrHash(record.repo, record.prNumber, record.prHashHex);
  } catch {
    verified = null;
  }

  return (
    <li className="attn-row">
      <div className="attn-row__head">
        <span className="attn-row__seq">#{record.sequence}</span>
        <a
          className="attn-row__repo"
          href={attestationPrUrl(record)}
          target="_blank"
          rel="noreferrer"
        >
          {record.repo} · PR #{record.prNumber}
        </a>
        {verified === true ? (
          <span className="pill pill--verified">pr_hash verified</span>
        ) : verified === false ? (
          <span className="pill pill--warn">pr_hash mismatch</span>
        ) : null}
      </div>
      <div className="attn-row__meta">
        <span>
          {complexityLabel(record.complexity)} · +{complexityContribution(record.complexity)}
        </span>
        {record.issueId > 0n ? <span>issue {record.issueId.toString()}</span> : null}
        <span>{formatTimestamp(record.timestamp)}</span>
        <span title={`pr_hash ${record.prHashHex}`}>
          pr_hash {truncateMiddle(record.prHashHex, 8, 6)}
        </span>
        <span title={`github_id_hash ${record.githubIdHashHex}`}>
          id {truncateMiddle(record.githubIdHashHex, 8, 6)}
        </span>
      </div>
    </li>
  );
}
