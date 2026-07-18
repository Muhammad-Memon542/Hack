import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TradingInterface } from "@/components/TradingInterface";
import { CommentFeed } from "@/components/CommentFeed";

export const dynamic = "force-dynamic";

export default async function MarketPage({ params }: { params: { id: string } }) {
  const market = await prisma.market
    .findUnique({
      where: { id: params.id },
      include: { creator: { select: { username: true, publicKey: true } } },
    })
    .catch(() => null);

  if (!market) notFound();

  const metadata = (market.metadata ?? {}) as { title?: string; description?: string };

  return (
    <div>
      <div className="detail-head">
        <Link href="/" className="crumb">
          ← All markets
        </Link>
        <h1>{metadata.title ?? "Untitled market"}</h1>
        <div className="row" style={{ gap: "0.7rem" }}>
          <span className={`chip ${market.status}`}>{market.status}</span>
          <span className="dim">
            by @{market.creator.username} · resolves {market.resolutionDate.toLocaleString()}
          </span>
          {market.targetWallet && <span className="pyr-badge">⚡ yield routes to the subject</span>}
        </div>
        {metadata.description && (
          <p className="dim" style={{ marginTop: "0.9rem", maxWidth: "62ch" }}>
            {metadata.description}
          </p>
        )}
      </div>

      <TradingInterface pdaAddress={market.pdaAddress} />

      <CommentFeed marketId={market.id} />
    </div>
  );
}
