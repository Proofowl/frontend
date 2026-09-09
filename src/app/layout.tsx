import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ProofOwl",
    template: "%s · ProofOwl",
  },
  description:
    "On-chain contributor reputation. Verified, merged contributions anchored on Stellar — portable and checkable by anyone.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
