/**
 * The ProofOwl mark: a geometric owl reduced to the two things that
 * carry the identity — a facial disc and two wide, watchful eyes, the
 * irises in the accent colour. Deliberately flat and instrument-like.
 */
export function OwlMark({ size = 28, title = "ProofOwl" }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* facial disc / head */}
      <path
        d="M16 2c6 0 11 3.6 11 10.5 0 3.2-.8 6.2-2.6 8.7C22 25.6 19.4 30 16 30s-6-4.4-8.4-8.8C5.8 18.7 5 15.7 5 12.5 5 5.6 10 2 16 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* ear tufts */}
      <path
        d="M8.5 4.5 6 1.5M23.5 4.5 26 1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* eyes */}
      <circle cx="11.5" cy="13" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="20.5" cy="13" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="11.5" cy="13" r="1.7" fill="var(--accent)" />
      <circle cx="20.5" cy="13" r="1.7" fill="var(--accent)" />
      {/* beak */}
      <path d="M16 15.5 14.4 19h3.2L16 15.5Z" fill="currentColor" />
    </svg>
  );
}
