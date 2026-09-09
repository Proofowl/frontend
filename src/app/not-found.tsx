import Link from "next/link";

import { OwlMark } from "@/components/OwlMark";

export default function NotFound() {
  return (
    <div className="stack" style={{ textAlign: "center", paddingBlock: "3rem" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <OwlMark size={44} />
      </div>
      <h1>Nothing here</h1>
      <p className="muted">That page doesn&rsquo;t exist.</p>
      <div className="cluster" style={{ justifyContent: "center" }}>
        <Link href="/" className="btn">
          Home
        </Link>
        <Link href="/passport" className="btn btn--ghost">
          Look up a passport
        </Link>
      </div>
    </div>
  );
}
