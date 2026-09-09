"use client";

import { useState } from "react";

/** Copy `value` to the clipboard; briefly confirms. Falls back silently. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard unavailable — leave the value on screen to select */
    }
  }

  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={copy}
      aria-label={`${label}: ${value}`}
    >
      {done ? "Copied" : label}
    </button>
  );
}
