import type { Metadata } from "next";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://proofowl.example"),
  title: {
    default: "ProofOwl — on-chain contributor reputation",
    template: "%s · ProofOwl",
  },
  description:
    "A read-only explorer for ProofOwl: verified, merged contributions anchored on Stellar — portable and checkable by anyone.",
};

// Set the stored theme before first paint so the toggle choice doesn't flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("proofowl-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        <main className="main container">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
