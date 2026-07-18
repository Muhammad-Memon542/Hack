import "server-only";
import { getDb } from "@/lib/mongo";
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
} from "@/lib/mock";

/**
 * MongoDB-backed store — the production persistence for Echo's social + market
 * state. Mirrors the file backend (store.file.ts) function-for-function so the
 * API routes are backend-agnostic; the dispatcher in store.ts picks between the
 * two based on whether MONGODB_URI is set.
 *
 * Each entity lives in its own collection keyed by its own id (`_id`), so writes
 * are granular ($inc pools, $addToSet followers) instead of rewriting a blob.
 */

export type { ActivityType, ActivityEvent };

export interface Snapshot {
  users: User[];
  markets: Market[];
  positions: Position[];
  comments: Comment[];
  activity: ActivityEvent[];
  commentLikes: Record<string, string[]>;
}

const SEED_VERSION = 3;
const noId = { projection: { _id: 0 } };
const genId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

type WithId<T> = T & { _id: string };

async function collections() {
  const db = await getDb();
  return {
    db,
    users: db.collection<WithId<User>>("users"),
    markets: db.collection<WithId<Market>>("markets"),
    positions: db.collection<WithId<Position>>("positions"),
    comments: db.collection<WithId<Comment>>("comments"),
    activity: db.collection<WithId<ActivityEvent>>("activity"),
    likes: db.collection<{ _id: string; userIds: string[] }>("commentLikes"),
    meta: db.collection<{ _id: string; version: number }>("meta"),
  };
}

// Seed the collections once per cluster (idempotent, guarded per-process).
let seedPromise: Promise<void> | null = null;
function withId<T extends { id: string }>(doc: T): WithId<T> {
  return { ...doc, _id: doc.id };
}
async function ensureSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const c = await collections();
    const meta = await c.meta.findOne({ _id: "seed" });
    if (meta?.version === SEED_VERSION) return;

    const activity: ActivityEvent[] = [];
    for (const p of seedPositions)
      activity.push({ id: `act_seed_bet_${p.id}`, type: "bet", userId: p.userId, marketId: p.marketId, side: p.side, amount: p.amount, createdAt: p.createdAt });
    for (const cm of seedComments) {
      if (cm.parentId) continue;
      activity.push({ id: `act_seed_cm_${cm.id}`, type: "comment", userId: cm.userId, marketId: cm.marketId, commentId: cm.id, content: cm.content, createdAt: cm.createdAt });
    }
    for (const m of seedMarkets)
      activity.push({ id: `act_seed_nm_${m.id}`, type: "new_market", userId: m.creatorId, marketId: m.id, createdAt: m.createdAt });

    await Promise.all([
      c.users.deleteMany({}),
      c.markets.deleteMany({}),
      c.positions.deleteMany({}),
      c.comments.deleteMany({}),
      c.activity.deleteMany({}),
      c.likes.deleteMany({}),
    ]);
    await Promise.all([
      c.users.insertMany(seedUsers.map(withId)),
      c.markets.insertMany(seedMarkets.map(withId)),
      seedPositions.length ? c.positions.insertMany(seedPositions.map(withId)) : null,
      seedComments.length ? c.comments.insertMany(seedComments.map(withId)) : null,
      activity.length ? c.activity.insertMany(activity.map(withId)) : null,
    ]);
    // Helpful indexes for the read paths.
    await Promise.all([
      c.markets.createIndex({ status: 1 }),
      c.positions.createIndex({ marketId: 1 }),
      c.comments.createIndex({ marketId: 1 }),
      c.activity.createIndex({ createdAt: -1 }),
    ]);
    await c.meta.updateOne({ _id: "seed" }, { $set: { version: SEED_VERSION } }, { upsert: true });
  })().catch((e) => {
    seedPromise = null; // allow retry on transient connection failure
    throw e;
  });
  return seedPromise;
}

// ---------------- reads ----------------
export async function getSnapshot(): Promise<Snapshot> {
  await ensureSeeded();
  const c = await collections();
  const [users, markets, positions, comments, activity, likeDocs] = await Promise.all([
    c.users.find({}, noId).toArray() as Promise<User[]>,
    c.markets.find({}, noId).toArray() as Promise<Market[]>,
    c.positions.find({}, noId).toArray() as Promise<Position[]>,
    c.comments.find({}, noId).toArray() as Promise<Comment[]>,
    c.activity.find({}, noId).sort({ createdAt: -1 }).toArray() as Promise<ActivityEvent[]>,
    c.likes.find({}).toArray(),
  ]);
  const commentLikes: Record<string, string[]> = {};
  for (const d of likeDocs) commentLikes[d._id] = d.userIds ?? [];
  return { users, markets, positions, comments, activity, commentLikes };
}

// ---------------- mutations ----------------
export async function placeBet(input: {
  userId: string;
  marketId: string;
  side: Side;
  amount: number;
}): Promise<{ ok: boolean; error?: string; market?: Market; position?: Position }> {
  await ensureSeeded();
  const c = await collections();
  const market = await c.markets.findOne({ _id: input.marketId }, noId);
  if (!market) return { ok: false, error: "market not found" };
  if (market.status !== "OPEN") return { ok: false, error: "market is not open" };
  if (!(input.amount > 0)) return { ok: false, error: "amount must be positive" };

  const alreadyIn = !!(await c.positions.findOne({ marketId: input.marketId, userId: input.userId }));

  const position: Position = {
    id: genId("p"),
    marketId: input.marketId,
    userId: input.userId,
    side: input.side,
    amount: input.amount,
    createdAt: new Date().toISOString(),
  };
  await c.positions.insertOne(withId(position));

  const inc: Record<string, number> = input.side === "YES" ? { yesPool: input.amount } : { noPool: input.amount };
  if (!alreadyIn) inc.participants = 1;
  await c.markets.updateOne({ _id: input.marketId }, { $inc: inc });
  await c.users.updateOne({ _id: input.userId }, { $inc: { totalVolumeBet: input.amount } });
  await c.activity.insertOne(withId<ActivityEvent>({
    id: genId("act"), type: "bet", userId: input.userId, marketId: input.marketId,
    side: input.side, amount: input.amount, createdAt: position.createdAt,
  }));

  const updated = (await c.markets.findOne({ _id: input.marketId }, noId)) as Market;
  return { ok: true, market: updated, position };
}

export async function createMarket(input: {
  userId: string;
  question: string;
  description: string;
  closesAt: string;
  subjectWallet: string | null;
  category?: Market["category"];
  image?: string;
}): Promise<{ ok: boolean; market?: Market; error?: string }> {
  await ensureSeeded();
  const c = await collections();
  const user = await c.users.findOne({ _id: input.userId }, noId);
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
    createdAt: new Date().toISOString(),
    location: user?.location ?? "Riverside",
    tags: [],
    category: input.category ?? "Local",
    image: input.image,
  };
  await c.markets.insertOne(withId(market));
  await c.users.updateOne({ _id: input.userId }, { $inc: { totalVolumeCreated: 1 } });
  await c.activity.insertOne(withId<ActivityEvent>({
    id: genId("act"), type: "new_market", userId: input.userId, marketId: market.id, createdAt: market.createdAt,
  }));
  return { ok: true, market };
}

export async function addComment(input: {
  userId: string;
  marketId: string;
  parentId: string | null;
  content: string;
}): Promise<{ ok: boolean; comment?: Comment; error?: string }> {
  await ensureSeeded();
  const c = await collections();
  const market = await c.markets.findOne({ _id: input.marketId }, noId);
  if (!market) return { ok: false, error: "market not found" };
  if (!input.content.trim()) return { ok: false, error: "empty comment" };
  const comment: Comment = {
    id: genId("c"),
    marketId: input.marketId,
    userId: input.userId,
    parentId: input.parentId,
    content: input.content.trim(),
    createdAt: new Date().toISOString(),
    tipsReceived: 0,
  };
  await c.comments.insertOne(withId(comment));
  await c.markets.updateOne({ _id: input.marketId }, { $inc: { commentCount: 1 } });
  if (!input.parentId) {
    await c.activity.insertOne(withId<ActivityEvent>({
      id: genId("act"), type: "comment", userId: input.userId, marketId: input.marketId,
      commentId: comment.id, content: comment.content, createdAt: comment.createdAt,
    }));
  }
  return { ok: true, comment };
}

export async function toggleFollow(input: {
  userId: string;
  targetUserId: string;
}): Promise<{ ok: boolean; following: boolean; error?: string }> {
  await ensureSeeded();
  if (input.userId === input.targetUserId) return { ok: false, following: false, error: "cannot follow yourself" };
  const c = await collections();
  const me = await c.users.findOne({ _id: input.userId }, noId);
  const target = await c.users.findOne({ _id: input.targetUserId }, noId);
  if (!me || !target) return { ok: false, following: false, error: "user not found" };

  const isFollowing = me.following.includes(target.id);
  if (isFollowing) {
    await c.users.updateOne({ _id: me.id }, { $pull: { following: target.id } });
    await c.users.updateOne({ _id: target.id }, { $pull: { followers: me.id } });
  } else {
    await c.users.updateOne({ _id: me.id }, { $addToSet: { following: target.id } });
    await c.users.updateOne({ _id: target.id }, { $addToSet: { followers: me.id } });
    await c.activity.insertOne(withId<ActivityEvent>({
      id: genId("act"), type: "follow", userId: me.id, targetUserId: target.id, createdAt: new Date().toISOString(),
    }));
  }
  return { ok: true, following: !isFollowing };
}

export async function toggleLike(input: {
  userId: string;
  commentId: string;
}): Promise<{ ok: boolean; likes: number; liked: boolean }> {
  await ensureSeeded();
  const c = await collections();
  const existing = await c.likes.findOne({ _id: input.commentId });
  const liked = existing?.userIds?.includes(input.userId) ?? false;
  if (liked) {
    await c.likes.updateOne({ _id: input.commentId }, { $pull: { userIds: input.userId } });
  } else {
    await c.likes.updateOne(
      { _id: input.commentId },
      { $addToSet: { userIds: input.userId } },
      { upsert: true }
    );
  }
  const after = await c.likes.findOne({ _id: input.commentId });
  return { ok: true, likes: after?.userIds?.length ?? 0, liked: !liked };
}
