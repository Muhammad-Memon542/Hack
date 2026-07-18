import Link from "next/link";
import { formatUsdc } from "@/lib/accounts";

export interface MarketRow {
  id: string;
  pdaAddress: string;
  status: string;
  resolutionDate: string | Date;
  targetWallet: string | null;
  metadata: { title?: string; description?: string; pools?: { yes: string; no: string } } | null;
  creator: { username: string; publicKey: string };
}

function shortKey(k: string): string {
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/** Server Component: renders off-chain state; live odds hydrate on the detail page. */
export function MarketCard({ market }: { market: MarketRow }) {
  const title = market.metadata?.title ?? "Untitled market";
  const pools = market.metadata?.pools;
  let yesPct: number | null = null;
  let volume: bigint | null = null;
  if (pools) {
    const yes = BigInt(pools.yes);
    const total = yes + BigInt(pools.no);
    volume = total;
    if (total > 0n) yesPct = Math.round(Number((yes * 100n) / total));
  }

  return (
    <Link href={`/market/${market.id}`}>
      <article className="card">
        <div className="spread">
          <span className={`chip ${market.status}`}>{market.status}</span>
          {volume !== null && (
            <span className="faint num" style={{ fontSize: "0.78rem" }}>
              {formatUsdc(volume)} USDC
            </span>
          )}
        </div>
        <h3>{title}</h3>

        {yesPct !== null ? (
          <div>
            <div className="odds-bar" style={{ marginBottom: "0.4rem" }}>
              <div style={{ width: `${yesPct}%` }} />
            </div>
            <div className="odds-legend">
              <span className="yes">YES {yesPct}%</span>
              <span className="no">NO {100 - yesPct}%</span>
            </div>
          </div>
        ) : (
          <div className="faint" style={{ fontSize: "0.85rem" }}>
            No liquidity yet — set the line.
          </div>
        )}

        <div className="card-foot">
          <div className="meta">
            <span>@{market.creator.username}</span>
            <span>·</span>
            <span>resolves {new Date(market.resolutionDate).toLocaleDateString()}</span>
          </div>
          {market.targetWallet && (
            <div style={{ marginTop: "0.5rem" }}>
              <span className="pyr-badge">⚡ yield routes to {shortKey(market.targetWallet)}</span>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
