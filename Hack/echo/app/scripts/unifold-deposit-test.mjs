// Test the Deposit Addresses product (the flow the headless SDK uses).
// Run: node --env-file=.env scripts/unifold-deposit-test.mjs
import Unifold from "@unifold/node";
const client = new Unifold(process.env.UNIFOLD_SECRET_KEY);

// 1. Find the exact chain_id + token_address the sandbox knows for USDC.
console.log("--- supported deposit tokens (find USDC destination) ---");
const dep = await client.tokens.listSupportedDepositTokens();
for (const t of dep.data ?? []) {
  for (const c of t.chains ?? []) {
    console.log(`  ${t.symbol}  chain=${c.chain_name} type=${c.chain_type} id=${c.chain_id} token=${c.token_address} decimals=${c.decimals}`);
  }
}

// Prefer Base Sepolia (84532); fall back to first USDC chain.
const usdc = (dep.data ?? []).find((t) => t.symbol.toUpperCase() === "USDC");
const chain =
  usdc?.chains?.find((c) => c.chain_id === "84532") ?? usdc?.chains?.[0];
if (!chain) {
  console.error("No USDC destination chain found in sandbox");
  process.exit(1);
}
console.log(`\nUsing destination: chain_id=${chain.chain_id} token=${chain.token_address}`);

// 2. Create deposit addresses for a (user, destination) tuple.
const res = await client.depositAddresses.create({
  external_user_id: "u_demo_echo",
  destination_chain_type: chain.chain_type,
  destination_chain_id: chain.chain_id,
  destination_token_address: chain.token_address,
  recipient_address: process.env.UNIFOLD_TREASURY_ADDRESS ?? "0x000000000000000000000000000000000000dEaD",
});

if (res.error_type || res.status_code) {
  console.error("\nCREATE FAILED:", JSON.stringify(res, null, 2));
  process.exit(1);
}

console.log(`\n✅ Deposit addresses created (${res.data?.length ?? 0}):`);
for (const a of res.data ?? []) {
  console.log(`  ${a.chain_type.padEnd(9)} ${a.address}  (primary=${a.is_primary}, transit=${a.is_transit_wallet})`);
}
