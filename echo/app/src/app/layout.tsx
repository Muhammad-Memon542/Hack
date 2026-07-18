import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Providers } from "./providers";
import { SiwsButton } from "@/components/SiwsButton";

export const metadata: Metadata = {
  title: "Echo — social prediction markets",
  description:
    "Socially-gated parimutuel prediction markets on Solana with Programmable Yield Routing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="container">
            <header className="topbar">
              <div className="brand">
                <Link href="/" className="logo">
                  echo<span className="dot">.</span>
                </Link>
                <nav className="nav-links">
                  <Link href="/">Markets</Link>
                  <Link href="/leaderboard">Leaderboard</Link>
                </nav>
              </div>
              <div className="topbar-actions">
                <Link href="/create" className="btn">
                  + New market
                </Link>
                <SiwsButton />
              </div>
            </header>
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
