// Inspect the exact shape returned by paymentIntents.create (sandbox).
// Run: node --env-file=.env scripts/unifold-create-test.mjs
import Unifold from "@unifold/node";

const client = new Unifold(process.env.UNIFOLD_SECRET_KEY);

try {
  const pi = await client.paymentIntents.create({
    destination_amount: "25000000", // 25 USDC
    destination_currency: "usdc",
    destination_network: "base",
    recipient_address: process.env.UNIFOLD_TREASURY_ADDRESS ?? "0x000000000000000000000000000000000000dEaD",
    external_user_id: "u_demo_echo",
    settlement_tolerance_percent: 1,
    metadata: { app: "echo", purpose: "balance_topup" },
  });
  console.log("typeof:", typeof pi);
  console.log("top-level keys:", Object.keys(pi));
  console.log("\nfull object:\n", JSON.stringify(pi, null, 2));
} catch (err) {
  console.error("CREATE FAILED");
  console.error("name:", err?.name);
  console.error("message:", err?.message);
  console.error("statusCode:", err?.statusCode);
  console.error("raw:", JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}), 2));
}
