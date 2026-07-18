// Discover the valid destination (currency, network) pair for payment intents.
// Run: node --env-file=.env scripts/unifold-discover-dest.mjs
import Unifold from "@unifold/node";
const client = new Unifold(process.env.UNIFOLD_SECRET_KEY);

async function tryCreate(currency, network, extra = {}) {
  const pi = await client.paymentIntents.create({
    destination_amount: "25000000",
    destination_currency: currency,
    destination_network: network,
    recipient_address: "0x000000000000000000000000000000000000dEaD",
    external_user_id: "u_probe",
    settlement_tolerance_percent: 1,
    ...extra,
  });
  const ok = !pi.error_type && !pi.status_code;
  return { ok, summary: ok ? `OK id=${pi.id} status=${pi.status} net=${pi.destination_network}` : `${pi.error_type}: ${JSON.stringify(pi.details ?? pi.message)}` };
}

console.log("--- listSupportedSourceTokens (filtered to destination usdc/base) ---");
try {
  const res = await client.paymentIntents.listSupportedSourceTokens({ destination_currency: "usdc", destination_network: "base" });
  console.log(JSON.stringify(res.data ?? res, null, 2).slice(0, 1500));
} catch (e) {
  console.log("threw:", e?.message);
}

const combos = [
  ["usdc", "base"],
  ["USDC", "base"],
  ["usdc", "base-sepolia"],
  ["usdc", "ethereum-sepolia"],
  ["usdc", "ethereum"],
];
for (const [cur, net] of combos) {
  try {
    const r = await tryCreate(cur, net);
    console.log(`create(${cur}, ${net}) -> ${r.summary}`);
  } catch (e) {
    console.log(`create(${cur}, ${net}) THREW -> ${e?.message}`);
  }
}
