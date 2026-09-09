"use client";

/**
 * Paginated attestation history. Filled in by the next commit — this
 * stub keeps PassportView compiling.
 */
export function AttestationHistory({ wallet, total }: { wallet: string; total: number }) {
  return (
    <div className="card card--sunken muted">
      {total} attestation(s) for {wallet.slice(0, 8)}… — history view coming in the next commit.
    </div>
  );
}
