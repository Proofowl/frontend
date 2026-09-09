import Link from "next/link";

import { OwlMark } from "./OwlMark";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/passport", label: "Passport" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/link", label: "How linking works" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand" aria-label="ProofOwl — home">
          <OwlMark size={26} />
          <span className="brand__word">
            Proof<span className="brand__owl">Owl</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav__link">
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
