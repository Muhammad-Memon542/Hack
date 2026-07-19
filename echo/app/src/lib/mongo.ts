import "server-only";
import { MongoClient, type Db } from "mongodb";

/**
 * Cached MongoDB connection.
 *
 * Next.js API routes run per-request (and hot-reload in dev), so a naive
 * `new MongoClient()` per call would exhaust Atlas' free-tier 500-connection
 * cap. We cache a single client + connect promise on globalThis and reuse it
 * across invocations, with a small pool sized for the shared M0 cluster.
 *
 * Activated by setting MONGODB_URI (see .env.example). When it's unset the
 * store/ledger fall back to the file backend, so the app still runs locally.
 */

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "better";

export const mongoEnabled = !!uri;

interface Cached {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
}

const g = globalThis as unknown as { __echoMongo?: Cached };
const cache: Cached = g.__echoMongo ?? { client: null, promise: null };
g.__echoMongo = cache;

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (cache.client) return cache.client.db(dbName);
  if (!cache.promise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10, // conservative for the shared free tier
      minPoolSize: 0,
      retryWrites: true,
    });
    cache.promise = client.connect().then((c) => {
      cache.client = c;
      return c;
    });
  }
  const client = await cache.promise;
  return client.db(dbName);
}
