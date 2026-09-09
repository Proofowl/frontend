import type { Metadata } from "next";
import Link from "next/link";

import { Callout } from "@/components/Callout";
import { Address } from "@/components/Address";
import { REFERENCE_ATTESTOR } from "@/lib/config";

export const metadata: Metadata = {
  title: "How linking works",
  description:
    "Linking a wallet to a GitHub identity is a two-party action: the wallet and a trusted attestor must both authorize it.",
};

export default function LinkPage() {
  return (
    <div className="stack-lg">
      <header className="stack-sm">
        <p className="label">How linking works</p>
        <h1>Linking is a two-party action</h1>
        <p className="lede prose">
          A wallet is linked to a GitHub identity only when <strong>both</strong> the
          contributor&rsquo;s wallet and a trusted attestor authorize the same{" "}
          <code>link_github</code> call. A single ordinary wallet signature cannot complete it, and
          neither can the attestor alone.
        </p>
      </header>

      <section className="stack">
        <h2>Why two parties</h2>
        <div className="prose stack-sm">
          <p>
            The wallet signature proves control of the Stellar key. The attestor co-signature
            attests that an off-chain GitHub OAuth / challenge flow — run by{" "}
            <a href="https://github.com/Proofowl/backend">proofowl-backend</a> — proved the same
            person controls that GitHub account.
          </p>
          <p>
            The contract has no network access and cannot check GitHub itself. What it enforces is
            procedure: the link exists iff both required signatures are present. Both directions of
            the link are one-to-one and collision-checked, so a wallet cannot claim an identity the
            attestor did not co-sign for.
          </p>
        </div>
      </section>

      <section className="stack">
        <h2>Doing it today</h2>
        <p className="prose muted">
          The working path right now is a command-line flow, documented in proofowl-backend&rsquo;s
          README. In outline:
        </p>
        <ul className="attn-list">
          <li className="attn-row">
            <div className="attn-row__head">
              <span className="attn-row__seq">1</span>
              <span className="attn-row__repo">Prove the GitHub identity</span>
            </div>
            <p className="muted">
              The backend runs the OAuth / challenge flow and, only on success, agrees to co-sign a
              link for that wallet and that numeric GitHub id.
            </p>
          </li>
          <li className="attn-row">
            <div className="attn-row__head">
              <span className="attn-row__seq">2</span>
              <span className="attn-row__repo">Assemble and collect both signatures</span>
            </div>
            <p className="muted">
              The <code>link_github</code> transaction is built, the contributor&rsquo;s wallet
              signs its auth entry, and the attestor adds its auth-entry signature. On the Stellar
              CLI this is <code>--source &lt;wallet&gt; --auto-sign</code>; in a frontend/backend
              split the two signatures are collected separately. Order does not matter.
            </p>
          </li>
          <li className="attn-row">
            <div className="attn-row__head">
              <span className="attn-row__seq">3</span>
              <span className="attn-row__repo">Submit</span>
            </div>
            <p className="muted">
              Whoever holds the fully-signed transaction submits it. Attestations for that identity
              can then be recorded against the wallet.
            </p>
          </li>
        </ul>
        <p className="prose">
          Full commands and the exact request/response shapes are in{" "}
          <a href="https://github.com/Proofowl/backend#the-two-party-link">
            the proofowl-backend README
          </a>{" "}
          and{" "}
          <a href="https://github.com/Proofowl/proofowl-contracts/blob/main/docs/integration/contract-api-v2.md">
            contract-api-v2
          </a>
          .
        </p>
      </section>

      <Callout title="This site does not do interactive linking" variant="muted">
        Linking needs the attestor&rsquo;s co-signature, which only the backend can provide after
        its own verification — so there is no button here that could complete the flow, and adding
        one that silently fails would be worse than not having it. This version is a read-only
        explorer; use the passport pages to check a link that already exists.
      </Callout>

      <section className="stack-sm">
        <p className="label">Reference: current on-chain attestor</p>
        <Address value={REFERENCE_ATTESTOR} full />
        <p className="faint" style={{ fontSize: "0.85rem" }}>
          Shown for reference. It was rotated on 2026-09-07 and can rotate again; the authoritative
          value is whatever <code>get_attestor()</code> returns live.
        </p>
      </section>

      <p>
        <Link href="/passport" className="btn">
          Look up a passport
        </Link>
      </p>
    </div>
  );
}
