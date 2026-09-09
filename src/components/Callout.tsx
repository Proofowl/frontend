type Variant = "info" | "warn" | "danger" | "muted";

const cls: Record<Variant, string> = {
  info: "callout",
  warn: "callout callout--warn",
  danger: "callout callout--danger",
  muted: "callout callout--muted",
};

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cls[variant]} role="note">
      {title ? (
        <strong style={{ display: "block", marginBottom: "0.25rem" }}>{title}</strong>
      ) : null}
      <div className="muted">{children}</div>
    </div>
  );
}
