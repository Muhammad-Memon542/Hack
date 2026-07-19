import "server-only";
import { mongoEnabled } from "@/lib/mongo";
import * as fileStore from "@/lib/store.file";
import * as mongoStore from "@/lib/store.mongo";

/**
 * Persistence dispatcher. Uses MongoDB when MONGODB_URI is set (see mongo.ts),
 * otherwise falls back to the file-backed store so the app still runs locally
 * with no database. Both backends expose the identical API, so every API route
 * imports from here and stays backend-agnostic.
 */

const backend = mongoEnabled ? mongoStore : fileStore;

// Announce the active backend once, so it's obvious in the server logs which
// persistence layer is live (helps confirm the Mongo switch took effect).
console.info(`[better] persistence backend: ${mongoEnabled ? "mongodb" : "file (.data)"}`);

export type { Snapshot, ActivityType, ActivityEvent } from "@/lib/store.file";
export type { LiveBet, MarketTick } from "@/lib/store.file";

export const getSnapshot = backend.getSnapshot;
export const placeBet = backend.placeBet;
export const createMarket = backend.createMarket;
export const addComment = backend.addComment;
export const toggleFollow = backend.toggleFollow;
export const toggleLike = backend.toggleLike;
export const simulateBets = backend.simulateBets;
