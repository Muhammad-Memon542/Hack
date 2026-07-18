// End-to-end webhook test: sign a synthetic deposit-completed event with
// generateTestHeaders and POST it to the running dev server, then confirm the
// balance was credited (and that a replay does NOT double-credit).
// Run: node --env-file=.env scripts/unifold-webhook-test.mjs
import Unifold from "@unifold/node";

const secret = process.env.UNIFOLD_WEBHOOK_SECRET;
const client = new Unifold(process.env.UNIFOLD_SECRET_KEY);
const base = "http://localhost:3000";
const userId = "u_demo_echo";
const execId = "exec_test_" + Date.now();

const event = {
  id: "evt_test_" + Date.now(),
  object: "event",
  type: "deposit.direct_execution.completed",
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  data: {
    object: {
      id: execId,
      external_user_id: userId,
      user_id: userId,
      status: "succeeded",
      amount: "40000000", // 40 USDC in base units
      amount_usd: "40.00",
    },
  },
};

const payload = JSON.stringify(event);
const headers = client.webhooks.generateTestHeaders({ payload, secret });

async function post() {
  const res = await fetch(`${base}/api/webhooks/unifold`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: payload,
  });
  return `${res.status} ${JSON.stringify(await res.json())}`;
}

async function balance() {
  const res = await fetch(`${base}/api/deposits?userId=${userId}`);
  return res.json();
}

console.log("1. valid signed webhook   ->", await post());
console.log("2. replay (same event id) ->", await post());

// Tampered signature must be rejected.
const bad = await fetch(`${base}/api/webhooks/unifold`, {
  method: "POST",
  headers: { "content-type": "application/json", ...headers, "unifold-signature": "deadbeef" },
  body: payload,
});
console.log("3. tampered signature     ->", `${bad.status} ${JSON.stringify(await bad.json())}`);

const bal = await balance();
console.log("\n4. balance after tests    ->", `$${bal.balanceUsdc} (expect $40 — credited once)`);
console.log("   deposits:", JSON.stringify(bal.deposits, null, 2));
