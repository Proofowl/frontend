/**
 * A neutral "nothing here / not what you're looking for" panel. Used for
 * every distinct not-found state — each one passes its own title and
 * explanation so the message is specific, never a generic shrug.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="card card--sunken stack"
      style={{ textAlign: "center", padding: "2rem 1.5rem" }}
    >
      <h3>{title}</h3>
      {children ? (
        <p className="muted" style={{ maxWidth: "34rem", marginInline: "auto" }}>
          {children}
        </p>
      ) : null}
      {action ? (
        <div className="cluster" style={{ justifyContent: "center" }}>
          {action}
        </div>
      ) : null}
    </div>
  );
}
