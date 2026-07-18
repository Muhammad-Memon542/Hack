import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface BoardRow {
  id: string;
  username: string;
  publicKey: string;
  reputationScore: number;
  marketsCreated: number;
}

async function getBoard(): Promise<BoardRow[] | null> {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ reputationScore: "desc" }, { createdAt: "asc" }],
      take: 50,
      select: {
        id: true,
        username: true,
        publicKey: true,
        reputationScore: true,
        _count: { select: { marketsCreated: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      publicKey: u.publicKey,
      reputationScore: u.reputationScore,
      marketsCreated: u._count.marketsCreated,
    }));
  } catch {
    return null;
  }
}

function shortKey(k: string): string {
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export default async function LeaderboardPage() {
  const board = await getBoard();

  if (board === null) {
    return (
      <div className="notice">
        <p>
          <strong>Database unreachable.</strong> Provision the social-state layer to rank
          forecasters.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="detail-head">
        <h1>Leaderboard</h1>
        <p className="dim" style={{ maxWidth: "56ch" }}>
          Reputation accrues off-chain for durable contributions — creating markets, seeing them
          resolve honestly, and seeding discussion. In the full protocol it gates the top-quartile
          jury that arbitrates disputed markets.
        </p>
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {board.length === 0 ? (
          <div className="notice" style={{ border: "none" }}>
            No forecasters yet — connect a wallet and create the first market.
          </div>
        ) : (
          <table className="board">
            <thead>
              <tr>
                <th className="rank">#</th>
                <th>Forecaster</th>
                <th className="right">Markets</th>
                <th className="right">Reputation</th>
              </tr>
            </thead>
            <tbody>
              {board.map((u, i) => (
                <tr key={u.id}>
                  <td className={`rank ${i < 3 ? `top${i + 1}` : ""}`}>{i + 1}</td>
                  <td>
                    <div className="username">@{u.username}</div>
                    <div className="addr">{shortKey(u.publicKey)}</div>
                  </td>
                  <td className="right num">{u.marketsCreated}</td>
                  <td className="right">
                    <span className="rep-score">{u.reputationScore.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
