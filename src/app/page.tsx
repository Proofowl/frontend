import type { Metadata } from "next";
import Link from "next/link";

import { OwlMark } from "@/components/OwlMark";
import { Callout } from "@/components/Callout";

export const metadata: Metadata = {
  title: "ProofOwl — on-chain contributor reputation",
  description:
    "A contributor's verified, merged Stellar Wave contributions, anchored on-chain — portable and checkable by anyone, outliving any single program's backend.",
};

export default function HomePage() {
  return (
    <div className="stack-lg">
      <section className="hero stack">
        <p className="label hero__eyebrow">On-chain contributor reputation</p>
        <h1 style={{ maxWidth: "20ch" }}>
          A track record that isn&rsquo;t trapped in one platform&rsquo;s database.
        </h1>
        <p className="lede prose">
          ProofOwl anchors verified, merged contributions on Stellar — portable, checkable by
          anyone, and outliving any single program&rsquo;s backend. This site is a read-only
          explorer for that registry.
        </p>
        <div className="cluster">
          <Link href="/passport" className="btn btn--primary">
            Look up a passport
          </Link>
          <Link href="/link" className="btn btn--ghost">
            How linking works
          </Link>
        </div>
      </section>

      <section className="stack">
        <h2>The problem</h2>
        <div className="prose stack-sm">
          <p>
            Programs like Drips Wave track points, complexity tiers, and contributor reviews
            entirely in their own backend. That is fine for running a Wave cycle — but it means a
            contributor&rsquo;s whole track record is untransferable and unverifiable by anyone
            outside that one platform.
          </p>
          <p>
            If you want to point a grant committee, a DAO, or another bounty platform at
            &ldquo;here&rsquo;s my real, verified OSS contribution history,&rdquo; there is
            currently nothing to point them at.
          </p>
        </div>
      </section>

      <section className="stack">
        <h2>The solution</h2>
        <p className="prose muted">
          A minimal on-chain registry of two things. Anyone can then query a wallet&rsquo;s full,
          checkable history — every attestation carries the <code>owner/repo</code> and PR number it
          came from, so it links straight back to the merged pull request.
        </p>
        <div className="feature-grid">
          <div className="card stack-sm">
            <h3>1 · A two-party identity link</h3>
            <p className="muted">
              The contributor&rsquo;s wallet signs the linking call <em>and</em> a trusted attestor
              co-signs it. The wallet signature proves control of the Stellar key; the co-signature
              attests that an off-chain GitHub OAuth / challenge flow proved the same person
              controls the GitHub account.
            </p>
          </div>
          <div className="card stack-sm">
            <h3>2 · Verified attestations</h3>
            <p className="muted">
              One entry per confirmed, merged contribution to a Stellar Wave-labeled issue,
              submitted by the trusted attestor service after it independently checks GitHub&rsquo;s
              public API.
            </p>
          </div>
        </div>
      </section>

      <section className="stack">
        <h2>Trust boundaries</h2>
        <div className="prose stack-sm">
          <p>
            <strong>The contract cannot verify GitHub OAuth.</strong> It has no network access. What
            it enforces is <em>procedure</em>: a link exists only if both the wallet and the trusted
            attestor signed the same call. The attestor is trusted to co-sign only after the backend
            has run a real GitHub OAuth / challenge flow.
          </p>
          <p>
            <strong>The attestor resolves the wallet, it never chooses it.</strong> An attestation
            names a hashed GitHub identity, not a wallet address — the contract looks up the wallet
            via the on-chain link. A careless attestor key can misreport <em>what</em> happened, but
            it cannot redirect credit to a wallet the GitHub identity has not itself linked.
          </p>
          <p>
            <strong>Identity squatting is blocked by the co-signature.</strong> A wallet cannot
            claim someone else&rsquo;s identity on its own; the attestor will not co-sign a link the
            OAuth flow did not back, and both directions of the link are one-to-one and
            collision-checked.
          </p>
          <p>
            <strong>Complexity tiers are best-effort.</strong> An attestation&rsquo;s tier is one of
            0, 100, 150, or 200. A tier of 0 means the attestor confirmed the contribution happened
            but not its official Wave tier; it scores at a flat base rate of 50 rather than zero.
          </p>
        </div>
      </section>

      <Callout title="On identity hashes">
        A linked GitHub identity is stored as a <code>github_id_hash</code> — the SHA-256 of the
        account&rsquo;s numeric user id. That is an <strong>identifier, not privacy</strong>: GitHub
        user ids are small sequential integers and anyone can compute the hash for any id. It exists
        only to give the contract a fixed-size key that does not change when a login is renamed.
      </Callout>

      <section className="card card--sunken">
        <div className="cluster" style={{ justifyContent: "space-between" }}>
          <div className="cluster">
            <OwlMark size={22} />
            <span className="muted">What you can do here</span>
          </div>
          <div className="cluster">
            <Link href="/passport" className="btn btn--sm">
              Search a passport
            </Link>
            <Link href="/leaderboard" className="btn btn--sm btn--ghost">
              Leaderboard
            </Link>
            <Link href="/link" className="btn btn--sm btn--ghost">
              How linking works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
