import { prisma } from "@/lib/prisma";

/**
 * Off-chain reputation accrual (spec §3.3 keeps reputation off-chain).
 *
 * Reputation gates the social layer and — in the full protocol — determines the
 * top-quartile jury pool. We award it for durable contributions, not for
 * volume, so it can't be farmed by spamming trades.
 */
export const REP = {
  /** Standing up a market that others can trade against. */
  CREATE_MARKET: 5,
  /** A market you created reaching honest finalization. */
  MARKET_SETTLED: 12,
  /** Seeding the discussion that makes a market legible. */
  COMMENT: 1,
} as const;

export async function awardReputation(userId: string, points: number): Promise<void> {
  if (points === 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { reputationScore: { increment: points } },
  });
}
