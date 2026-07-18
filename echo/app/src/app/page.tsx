import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MarketCard, type MarketRow } from "@/components/MarketCard";
import { StatusTabs } from "@/components/StatusTabs";
import { formatUsdc } from "@/lib/accounts";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN", "LOCKED", "RESOLVING", "DISPUTED", "SETTLED"] as const;

interface HomeData {
  markets: MarketRow[];
  stats: { total: number; open: number; volume: bigint; forecasters: number };
}

async function getData(status: string): Promise<HomeData | null> {
  try {
    const where = STATUSES.includes(status as never) ? { status: status as never } : undefined;
    const [markets, all, forecasters] = await Promise.all([
      prisma.market.findMany({
        where,
        include: { creator: { select: { username: true, publicKey: true } } },
        orderBy: [{ status: "asc" }, { resolutionDate: "asc" }],
        take: 60,
      }),
      prisma.market.findMany({ select: { status: true, metadata: true } }),
      prisma.user.count(),
    ]);

    let volume = 0n;
    for (const m of all) {
      const pools = (m.metadata as { pools?: { yes: string; no: string } } | null)?.pools;
      if (pools) volume += BigInt(pools.yes) + BigInt(pools.no);
    }

    return {
      markets: markets as unknown as MarketRow[],
      stats: {
        total: all.length,
        open: all.filter((m) => m.status === "OPEN").length,
        volume,
        forecasters,
      },
    };
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const active = (searchParams.status ?? "").toUpperCase();
  const data = await getData(active);

  return (
    <div>
      <section className="hero">
        <h1>
          Bet on the <span className="accent-word">people</span> around you.
        </h1>
        <p>
          Echo turns local gossip into liquid markets. Winners route a slice of their yield straight
          back to the person the bet is about — a closed-loop funding mechanism, settled on Solana.
        </p>
        <div className="hero-cta">
          <Link href="/create" className="btn btn-primary">
            Create a market
          </Link>
          <Link href="/leaderboard" className="btn btn-ghost">
            View leaderboard
          </Link>
        </div>
      </section>

      {data && (
        <div className="stats">
          <div className="stat">
            <div className="label">Markets</div>
            <div className="value">{data.stats.total}</div>
          </div>
          <div className="stat">
            <div className="label">Open now</div>
            <div className="value">{data.stats.open}</div>
          </div>
          <div className="stat">
            <div className="label">Volume</div>
            <div className="value">
              {formatUsdc(data.stats.volume)} <small>USDC</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">Forecasters</div>
            <div className="value">{data.stats.forecasters}</div>
          </div>
        </div>
      )}

      <div className="section-head">
        <h2>Markets</h2>
        <StatusTabs active={active} />
      </div>

      {data === null ? (
        <div className="notice">
          <p>
            <strong>Database unreachable.</strong>
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            Set <code>DATABASE_URL</code> in <code>app/.env</code> and run{" "}
            <code>npx prisma migrate dev</code> to provision the social-state layer.
          </p>
        </div>
      ) : data.markets.length === 0 ? (
        <div className="notice">
          <p>No markets here yet. Create one and let your friends take the other side.</p>
        </div>
      ) : (
        <div className="market-grid">
          {data.markets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
