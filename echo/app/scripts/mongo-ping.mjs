// Quick MongoDB connection test — isolates "is my Atlas URI valid?" from the app.
//
//   MONGODB_URI="mongodb+srv://..." MONGODB_DB="echo" node scripts/mongo-ping.mjs
//
// Or, if the values are already in app/.env, load them first:
//   node --env-file=.env scripts/mongo-ping.mjs   (Node 20.6+)

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "echo";

if (!uri) {
  console.error("✗ MONGODB_URI is not set. Set it in the environment or app/.env.");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });

try {
  const t0 = Date.now();
  await client.connect();
  await client.db(dbName).command({ ping: 1 });
  console.log(`✓ Connected to MongoDB (${Date.now() - t0}ms) — db "${dbName}"`);

  const cols = await client.db(dbName).listCollections().toArray();
  if (cols.length === 0) {
    console.log("  (no collections yet — they seed on first app request)");
  } else {
    for (const col of cols) {
      const n = await client.db(dbName).collection(col.name).countDocuments();
      console.log(`  - ${col.name}: ${n} docs`);
    }
  }
} catch (err) {
  console.error("✗ Connection failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await client.close();
}
