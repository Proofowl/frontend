import type { Metadata } from "next";

import { PassportSearch } from "@/components/PassportSearch";

export const metadata: Metadata = {
  title: "Passport lookup",
  description:
    "Look up a contributor's on-chain reputation passport by wallet address or GitHub handle.",
};

export default async function PassportSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="stack-lg">
      <header className="stack-sm">
        <h1>Passport lookup</h1>
        <p className="lede prose">
          Every attestation a wallet has earned, read straight from the registry. Search by a
          Stellar address, or by a GitHub handle — the handle is resolved to its numeric id and
          hashed the same way the contract stores it.
        </p>
      </header>

      <div className="card">
        <PassportSearch initialQuery={typeof q === "string" ? q : ""} />
      </div>
    </div>
  );
}
