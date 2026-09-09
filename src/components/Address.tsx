import { truncateMiddle } from "@/lib/format";
import { CopyButton } from "./CopyButton";

/**
 * A Stellar address or 64-hex identifier, monospaced and middle-elided,
 * with the full value in the title and a copy control. `full` renders
 * the whole string (wrapping) instead of eliding.
 */
export function Address({
  value,
  full = false,
  head = 6,
  tail = 6,
  copy = true,
  className,
}: {
  value: string;
  full?: boolean;
  head?: number;
  tail?: number;
  copy?: boolean;
  className?: string;
}) {
  return (
    <span className={`cluster ${className ?? ""}`} style={{ gap: "0.4rem" }}>
      <code className={`mono ${full ? "break-all" : ""}`} title={value}>
        {full ? value : truncateMiddle(value, head, tail)}
      </code>
      {copy ? <CopyButton value={value} /> : null}
    </span>
  );
}
