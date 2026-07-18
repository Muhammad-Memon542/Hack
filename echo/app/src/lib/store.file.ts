import "server-only";
import { promises as fs } from "fs";
import path from "path";
import {
  users as seedUsers,
  markets as seedMarkets,
  positions as seedPositions,
  comments as seedComments,
  type User,
  type Market,
  type Position,
  type Comment,
  type Side,
  type ActivityType,
  type ActivityEvent,
  NOW,
} from "@/lib/mock";

// Live/bot activity timestamps are anchored to the app's demo clock (mock NOW)
// rather than the wall clock, so relativeTime renders "just now" / "2m" instead
// of drifting ("in 9h") when the real system time differs from the demo epoch.
const liveStamp = () => new Date(NOW - Math.floor(Math.random() * 150) * 1000).toISOString();

/**
 * Server-side source of truth for Echo's social + market state.
 *
 * The UI was originally a static mock; this store makes it real: bets are
 * recorded per account, market pools/volume are recomputed from actual stakes,
 * and every action emits an activity event that powers the social feed. It is
 * file-backed (.data/echo.json, gitignored) and seeded once from the mock data
 * so the demo starts populated. Swap for Postgres/Prisma to productionize —
 * the shapes mirror the existing schema.
 *
 * Balances live in depositLedger.ts (Unifold deposits credit, bets debit); this
 * store owns everything else.
 */

export type { ActivityType, ActivityEvent };

interface StoreState {
  seedVersion: number;
  users: User[];
  markets: Market[];
  positions: Position[];
  comments: Comment[];
  activity: ActivityEvent[];
  commentLikes: Record<string, string[]>; // commentId -> userIds
}

// Bump to force a reseed after schema/seed changes during development.
const SEED_VERSION = 4;
const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "echo.json");

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function seed(): StoreState {
  // Seed a few activity events from existing positions/comments so the feed
  // isn't empty on first load.
  const activity: ActivityEvent[] = [];
  for (const p of seedPositions) {
    activity.push({
      id: `act_seed_bet_${p.id}`,
      type: "bet",
      userId: p.userId,
      marketId: p.marketId,
      side: p.side,
      amount: p.amount,
      createdAt: p.createdAt,
    });
  }
  for (const c of seedComments) {
    if (c.parentId) continue;
    activity.push({
      id: `act_seed_cm_${c.id}`,
      type: "comment",
      userId: c.userId,
      marketId: c.marketId,
      commentId: c.id,
      content: c.content,
      createdAt: c.createdAt,
    });
  }
  for (const m of seedMarkets) {
    activity.push({
      id: `act_seed_nm_${m.id}`,
      type: "new_market",
      userId: m.creatorId,
      marketId: m.id,
      createdAt: m.createdAt,
    });
  }
  return {
    seedVersion: SEED_VERSION,
    users: clone(seedUsers),
    markets: clone(seedMarkets),
    positions: clone(seedPositions),
    comments: clone(seedComments),
    activity,
    commentLikes: {},
  };
}

async function readRaw(): Promise<StoreState> {
  try {
    const data = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as StoreState;
    if (data.seedVersion !== SEED_VERSION) throw new Error("stale seed");
    return data;
  } catch {
    const fresh = seed();
    await writeRaw(fresh);
    return fresh;
  }
}

async function writeRaw(state: StoreState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(state), "utf8");
}

// Serialize read-modify-write cycles so concurrent mutations can't clobber
// each other (the file store has no transactions).
let queue: Promise<unknown> = Promise.resolve();
function withStore<T>(fn: (s: StoreState) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const state = await readRaw();
    const result = await fn(state);
    await writeRaw(state);
    return result;
  });
  // keep the chain alive regardless of individual failures
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

const genId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ---------------- reads ----------------

export interface Snapshot {
  users: User[];
  markets: Market[];
  positions: Position[];
  comments: Comment[];
  activity: ActivityEvent[];
  commentLikes: Record<string, string[]>;
}

export async function getSnapshot(): Promise<Snapshot> {
  const s = await readRaw();
  return {
    users: s.users,
    markets: s.markets,
    positions: s.positions,
    comments: s.comments,
    activity: s.activity.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    commentLikes: s.commentLikes,
  };
}

// ---------------- mutations ----------------

export function placeBet(input: {
  userId: string;
  marketId: string;
  side: Side;
  amount: number;
}): Promise<{ ok: boolean; error?: string; market?: Market; position?: Position }> {
  return withStore((s) => {
    const market = s.markets.find((m) => m.id === input.marketId);
    if (!market) return { ok: false, error: "market not found" };
    if (market.status !== "OPEN") return { ok: false, error: "market is not open" };
    if (!(input.amount > 0)) return { ok: false, error: "amount must be positive" };

    const alreadyIn = s.positions.some(
      (p) => p.marketId === market.id && p.userId === input.userId
    );

    const position: Position = {
      id: genId("p"),
      marketId: market.id,
      userId: input.userId,
      side: input.side,
      amount: input.amount,
      createdAt: liveStamp(),
    };
    s.positions.push(position);

    if (input.side === "YES") market.yesPool += input.amount;
    else market.noPool += input.amount;
    if (!alreadyIn) market.participants += 1;

    const user = s.users.find((u) => u.id === input.userId);
    if (user) user.totalVolumeBet += input.amount;

    s.activity.push({
      id: genId("act"),
      type: "bet",
      userId: input.userId,
      marketId: market.id,
      side: input.side,
      amount: input.amount,
      createdAt: position.createdAt,
    });

    return { ok: true, market, position };
  });
}

export function createMarket(input: {
  userId: string;
  question: string;
  description: string;
  closesAt: string;
  subjectWallet: string | null;
  category?: Market["category"];
  image?: string;
}): Promise<{ ok: boolean; market?: Market; error?: string }> {
  return withStore((s) => {
    const user = s.users.find((u) => u.id === input.userId);
    const market: Market = {
      id: genId("m"),
      question: input.question,
      description: input.description,
      creatorId: input.userId,
      subjectWallet: input.subjectWallet,
      status: "OPEN",
      closesAt: input.closesAt,
      resolvedAt: null,
      outcome: null,
      yesPool: 0,
      noPool: 0,
      commentCount: 0,
      participants: 0,
      createdAt: liveStamp(),
      location: user?.location ?? "Riverside",
      tags: [],
      category: input.category ?? "Local",
      image: input.image,
    };
    s.markets.unshift(market);
    if (user) user.totalVolumeCreated += 1;
    s.activity.push({
      id: genId("act"),
      type: "new_market",
      userId: input.userId,
      marketId: market.id,
      createdAt: market.createdAt,
    });
    return { ok: true, market };
  });
}

export function addComment(input: {
  userId: string;
  marketId: string;
  parentId: string | null;
  content: string;
}): Promise<{ ok: boolean; comment?: Comment; error?: string }> {
  return withStore((s) => {
    const market = s.markets.find((m) => m.id === input.marketId);
    if (!market) return { ok: false, error: "market not found" };
    if (!input.content.trim()) return { ok: false, error: "empty comment" };
    const comment: Comment = {
      id: genId("c"),
      marketId: input.marketId,
      userId: input.userId,
      parentId: input.parentId,
      content: input.content.trim(),
      createdAt: liveStamp(),
      tipsReceived: 0,
    };
    s.comments.push(comment);
    market.commentCount += 1;
    if (!input.parentId) {
      s.activity.push({
        id: genId("act"),
        type: "comment",
        userId: input.userId,
        marketId: input.marketId,
        commentId: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
      });
    }
    return { ok: true, comment };
  });
}

export function toggleFollow(input: {
  userId: string;
  targetUserId: string;
}): Promise<{ ok: boolean; following: boolean; error?: string }> {
  return withStore((s) => {
    if (input.userId === input.targetUserId) {
      return { ok: false, following: false, error: "cannot follow yourself" };
    }
    const me = s.users.find((u) => u.id === input.userId);
    const target = s.users.find((u) => u.id === input.targetUserId);
    if (!me || !target) return { ok: false, following: false, error: "user not found" };

    const isFollowing = me.following.includes(target.id);
    if (isFollowing) {
      me.following = me.following.filter((id) => id !== target.id);
      target.followers = target.followers.filter((id) => id !== me.id);
    } else {
      me.following.push(target.id);
      target.followers.push(me.id);
      s.activity.push({
        id: genId("act"),
        type: "follow",
        userId: me.id,
        targetUserId: target.id,
        createdAt: liveStamp(),
      });
    }
    return { ok: true, following: !isFollowing };
  });
}

export function toggleLike(input: {
  userId: string;
  commentId: string;
}): Promise<{ ok: boolean; likes: number; liked: boolean }> {
  return withStore((s) => {
    const list = s.commentLikes[input.commentId] ?? [];
    const liked = list.includes(input.userId);
    s.commentLikes[input.commentId] = liked
      ? list.filter((id) => id !== input.userId)
      : [...list, input.userId];
    return { ok: true, likes: s.commentLikes[input.commentId].length, liked: !liked };
  });
}

// ---------------- live bot trading engine ----------------

export interface LiveBet {
  id: string;
  marketId: string;
  marketQuestion: string;
  userId: string;
  username: string;
  avatar: string;
  color: string;
  side: Side;
  amount: number;
  yesPool: number;
  noPool: number;
  createdAt: string;
}

export interface MarketTick {
  id: string;
  yesPool: number;
  noPool: number;
  participants: number;
}

const WEIGHTED = () => {
  const r = Math.random();
  if (r < 0.62) return 5 + Math.floor(Math.random() * 45);
  if (r < 0.9) return 50 + Math.floor(Math.random() * 150);
  if (r < 0.99) return 200 + Math.floor(Math.random() * 300);
  return 500 + Math.floor(Math.random() * 700);
};

/**
 * Advance the market simulation: place `n` random bot bets on OPEN markets and
 * return the resulting live bets + the touched markets' new pools. The client
 * polls this to make markets feel alive — pools shift and a trade tape streams
 * "@user bet $X YES" in real time. Bots lean slightly with the current odds
 * (momentum) but stay noisy so books move both ways.
 */
export function simulateBets(n = 3): Promise<{ events: LiveBet[]; markets: MarketTick[] }> {
  return withStore((s) => {
    const open = s.markets.filter((m) => m.status === "OPEN");
    const bots = s.users.filter((u) => u.id.startsWith("bot_"));
    const events: LiveBet[] = [];
    const touched = new Map<string, MarketTick>();
    if (open.length === 0 || bots.length === 0) return { events, markets: [] };

    for (let i = 0; i < n; i++) {
      const m = open[Math.floor(Math.random() * open.length)];
      const bot = bots[Math.floor(Math.random() * bots.length)];
      const total = m.yesPool + m.noPool;
      const yesShare = total > 0 ? m.yesPool / total : 0.5;
      // 60% momentum (bet with the leading side), else contrarian — keeps it lively.
      const momentum = Math.random() < 0.6;
      const side: Side = (momentum ? Math.random() < yesShare : Math.random() > yesShare)
        ? "YES"
        : "NO";
      const amount = WEIGHTED();
      const createdAt = liveStamp();

      const alreadyIn = s.positions.some((p) => p.marketId === m.id && p.userId === bot.id);
      s.positions.push({
        id: genId("p"),
        marketId: m.id,
        userId: bot.id,
        side,
        amount,
        createdAt,
      });
      if (side === "YES") m.yesPool += amount;
      else m.noPool += amount;
      if (!alreadyIn) m.participants += 1;
      bot.totalVolumeBet += amount;

      s.activity.push({
        id: genId("act"),
        type: "bet",
        userId: bot.id,
        marketId: m.id,
        side,
        amount,
        createdAt,
      });

      events.push({
        id: genId("live"),
        marketId: m.id,
        marketQuestion: m.question,
        userId: bot.id,
        username: bot.username,
        avatar: bot.avatar,
        color: bot.color,
        side,
        amount,
        yesPool: m.yesPool,
        noPool: m.noPool,
        createdAt,
      });
      touched.set(m.id, {
        id: m.id,
        yesPool: m.yesPool,
        noPool: m.noPool,
        participants: m.participants,
      });
    }

    // Cap activity log growth so the file store stays small over a long demo.
    if (s.activity.length > 4000) s.activity = s.activity.slice(-3000);

    return { events, markets: [...touched.values()] };
  });
}
