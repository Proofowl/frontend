"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPassportSummary, type PassportSummary } from "@/lib/chain/passport";
import { isStellarWalletAddress } from "@/lib/hashing/identifiers";
import { formatScore, pluralize } from "@/lib/format";
import { Address } from "@/components/Address";
import { Callout } from "@/components/Callout";
import { EmptyState } from "@/components/EmptyState";
import { AttestationHistory } from "@/components/AttestationHistory";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; summary: PassportSummary };

export function PassportView({ wallet }: { wallet: string }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let live = true;
    setState({ phase: "loading" });
    fetchPassportSummary(wallet)
      .then((summary) => live && setState({ phase: "loaded", summary }))
      .catch(
        (err: unknown) =>
          live &&
          setState({
            phase: "error",
            message: err instanceof Error ? err.message : "the contract read failed",
          }),
      );
    return () => {
      live = false;
    };
  }, [wallet]);

  if (!isStellarWalletAddress(wallet)) {
    return (
      <EmptyState
        title="That is not a Stellar wallet address"
        action={
          <Link href="/passport" className="btn btn--sm">
            Back to search
          </Link>
        }
      >
        A public key is <code>G</code> followed by 55 base32 characters (A–Z, 2–7). Nothing was
        looked up.
      </EmptyState>
    );
  }

  return (
    <div className="stack-lg">
      <header className="stack-sm">
        <p className="label">Passport</p>
        <Address value={wallet} full />
      </header>

      {state.phase === "loading" ? (
        <div className="card card--sunken muted">Reading the registry…</div>
      ) : null}

      {state.phase === "error" ? (
        <Callout variant="danger" title="Could not read this passport">
          {state.message}. The registry read is a simulation against the configured Soroban RPC — it
          may be a transient RPC error; try again.
        </Callout>
      ) : null}

      {state.phase === "loaded" ? <Loaded summary={state.summary} /> : null}
    </div>
  );
}

function Loaded({ summary }: { summary: PassportSummary }) {
  const untouched =
    summary.reputationScore === 0 &&
    summary.attestationCount === 0 &&
    summary.linkedGithubIdHashHex === null;

  return (
    <div className="stack-lg">
      <div className="stat-row">
        <div className="stat">
          <div className="stat__value">{formatScore(summary.reputationScore)}</div>
          <div className="stat__label label">Reputation score</div>
        </div>
        <div className="stat">
          <div className="stat__value">{summary.attestationCount.toLocaleString("en-US")}</div>
          <div className="stat__label label">
            {pluralize(summary.attestationCount, "attestation").replace(/^\S+\s/, "")}
          </div>
        </div>
        <div className="stat">
          <div className="stat__value" style={{ fontSize: "1.05rem", wordBreak: "break-all" }}>
            {summary.linkedGithubIdHashHex ? (
              <code className="mono">{summary.linkedGithubIdHashHex.slice(0, 16)}…</code>
            ) : (
              <span className="muted" style={{ fontFamily: "var(--font-sans)" }}>
                not currently linked
              </span>
            )}
          </div>
          <div className="stat__label label">Linked github_id_hash</div>
        </div>
      </div>

      {summary.linkedGithubIdHashHex ? (
        <div className="stack-sm">
          <p className="label">Currently linked identity hash</p>
          <Address value={summary.linkedGithubIdHashHex} full />
          <p className="faint" style={{ fontSize: "0.85rem" }}>
            An identifier, not privacy — the SHA-256 of a GitHub numeric user id. History can also
            exist while a wallet is unlinked.
          </p>
        </div>
      ) : null}

      {untouched ? (
        <EmptyState title="This wallet has no passport yet">
          It has never been linked to a GitHub identity and has earned no attestations in this
          registry. That is not an error — every syntactically valid address reads as an empty
          passport until it is used.
        </EmptyState>
      ) : (
        <AttestationHistory wallet={summary.wallet} total={summary.attestationCount} />
      )}
    </div>
  );
}
