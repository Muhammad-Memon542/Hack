import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/TopNav";
import { CreateMarketModal } from "@/components/CreateMarketModal";
import { DepositModal } from "@/components/DepositModal";
import { LiveTicker } from "@/components/LiveTicker";

export const metadata: Metadata = {
  title: "Better — Your takes. Your stakes.",
  description:
    "Better is a more charitable way to bet. 50% of winning profits go to charity, every transaction offsets its carbon footprint — prediction markets settled on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopNav />
          <main className="shell">{children}</main>
          <CreateMarketModal />
          <DepositModal />
          <LiveTicker />
        </Providers>
      </body>
    </html>
  );
}
