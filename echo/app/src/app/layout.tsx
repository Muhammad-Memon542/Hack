import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/TopNav";
import { CreateMarketModal } from "@/components/CreateMarketModal";

export const metadata: Metadata = {
  title: "Echo — bet on the people around you",
  description:
    "Echo turns local gossip into liquid markets. Winners route a slice of their yield straight back to the person the bet is about — settled on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopNav />
          <main className="shell">{children}</main>
          <CreateMarketModal />
        </Providers>
      </body>
    </html>
  );
}
