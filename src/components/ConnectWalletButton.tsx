"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { connectForAddress } from "@/lib/wallet/connect";

/**
 * "View my passport" — opens a wallet picker, reads the connected
 * account's PUBLIC ADDRESS only, and navigates to that wallet's
 * passport. No transaction is built, signed, or submitted. This is not
 * the wallet-linking flow (that is two-party and out of scope — see
 * /link).
 */
export function ConnectWalletButton({
  variant = "primary",
  label = "View my passport",
}: {
  variant?: "primary" | "ghost";
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const result = await connectForAddress();
    setBusy(false);
    if (result.kind === "connected") {
      router.push(`/passport/${result.address}`);
    } else if (result.kind === "error") {
      setError(result.message);
    }
  }

  return (
    <div className="stack-sm">
      <button
        type="button"
        className={`btn ${variant === "primary" ? "btn--primary" : "btn--ghost"}`}
        onClick={onClick}
        disabled={busy}
      >
        {busy ? "Connecting…" : label}
      </button>
      <p className="faint" style={{ fontSize: "0.8rem", maxWidth: "40ch" }}>
        Reads your wallet&rsquo;s public address only. Nothing is signed.
      </p>
      {error ? (
        <p className="pill pill--warn" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
