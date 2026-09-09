"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { resolveIdentityQuery, type ResolveIdentityResult } from "@/lib/resolve/identity";
import { Address } from "@/components/Address";
import { Callout } from "@/components/Callout";
import { EmptyState } from "@/components/EmptyState";

type State =
  { phase: "idle" } | { phase: "resolving" } | { phase: "done"; result: ResolveIdentityResult };

export function PassportSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ phase: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setState({ phase: "resolving" });
    const result = await resolveIdentityQuery(q);
    if (result.kind === "wallet" || result.kind === "linked-wallet") {
      router.push(`/passport/${result.wallet}`);
      return;
    }
    setState({ phase: "done", result });
  }

  return (
    <div className="stack">
      <form onSubmit={onSubmit} className="stack-sm">
        <label htmlFor="q" className="label">
          Wallet address or GitHub handle
        </label>
        <div className="cluster" style={{ flexWrap: "nowrap", alignItems: "stretch" }}>
          <input
            id="q"
            name="q"
            className="field"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="G… or a GitHub handle"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn--primary" disabled={state.phase === "resolving"}>
            {state.phase === "resolving" ? "Looking up…" : "Look up"}
          </button>
        </div>
        <p className="faint" style={{ fontSize: "0.85rem" }}>
          A handle is resolved to its numeric GitHub user id, hashed, and looked up on-chain.
          Nothing is signed.
        </p>
      </form>

      {state.phase === "done" ? <SearchOutcome result={state.result} /> : null}
    </div>
  );
}

function SearchOutcome({ result }: { result: ResolveIdentityResult }) {
  switch (result.kind) {
    case "wallet":
    case "linked-wallet":
      return null; // navigated away

    case "github-user-not-found":
      return (
        <EmptyState title={`No GitHub user “${result.handle}”`}>
          GitHub&rsquo;s API has no account with that handle. Check the spelling, or search by
          wallet address instead. This is a GitHub fact — it is not the same as an account existing
          but not being linked.
        </EmptyState>
      );

    case "github-user-not-linked":
      return (
        <EmptyState title={`@${result.githubUser.login} is not linked to any wallet`}>
          <span>
            That GitHub account exists (id <code>{result.githubUser.id}</code>), but its{" "}
            <code>github_id_hash</code> is not linked to a wallet in this registry, so there is no
            passport to show. Linking is a two-party action done elsewhere —{" "}
            <a href="/link">how linking works</a>.
          </span>
          <span className="stack-sm" style={{ display: "block", marginTop: "0.75rem" }}>
            <Address value={result.githubIdHashHex} full copy />
          </span>
        </EmptyState>
      );

    case "github-rate-limited":
      return (
        <Callout variant="warn" title="GitHub API rate limit">
          The unauthenticated GitHub API (60 requests/hour/IP) is temporarily rate-limiting this
          browser
          {result.retryAfterSeconds != null
            ? `; try again in about ${Math.ceil(result.retryAfterSeconds / 60)} minute(s)`
            : "; try again shortly"}
          . Searching by wallet address does not touch GitHub.
        </Callout>
      );

    case "github-error":
      return (
        <Callout variant="danger" title="Could not reach GitHub">
          {result.message}
          {result.status ? ` (HTTP ${result.status})` : ""}. Searching by wallet address does not
          touch GitHub.
        </Callout>
      );

    case "unrecognized-input":
      return (
        <Callout variant="muted" title="Not recognised">
          {result.reason}
        </Callout>
      );
  }
}
