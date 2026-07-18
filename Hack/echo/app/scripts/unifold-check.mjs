// Read-only sandbox validation of the Unifold credential + capabilities.
// Run: node --env-file=.env scripts/unifold-check.mjs
import Unifold from '@unifold/node';

const key = process.env.UNIFOLD_SECRET_KEY;
if (!key) {
  console.error('UNIFOLD_SECRET_KEY not set');
  process.exit(1);
}
console.log('Using key:', key.slice(0, 11) + '...(redacted)');

const client = new Unifold(key);

try {
  const res = await client.paymentIntents.listSupportedSourceTokens();
  const tokens = res.data ?? [];
  console.log(`\n✅ Auth OK. ${tokens.length} supported source currencies:\n`);
  for (const t of tokens) {
    const nets = (t.networks ?? []).map((n) => `${n.network}(${n.chain_type})`).join(', ');
    console.log(`  ${t.symbol.padEnd(6)} ${t.name}`);
    console.log(`         networks: ${nets}`);
  }
  const solana = tokens.flatMap((t) => t.networks ?? []).filter((n) => n.chain_type === 'solana');
  console.log(`\nSolana source networks available: ${solana.length}`);

  console.log('\n--- listSupportedDepositTokens (all chains this sandbox accepts) ---');
  const dep = await client.tokens.listSupportedDepositTokens();
  const depTokens = dep.data ?? [];
  const chainSet = new Set();
  for (const t of depTokens) {
    for (const c of t.chains ?? []) chainSet.add(`${c.chain_name}(${c.chain_type}, id=${c.chain_id})`);
  }
  console.log(`${depTokens.length} deposit tokens across chains:`);
  for (const c of chainSet) console.log('  ', c);
  const solChains = [...chainSet].filter((c) => c.includes('solana'));
  console.log(`\nSolana as a supported chain here: ${solChains.length > 0 ? 'YES -> ' + solChains.join(', ') : 'NO'}`);
} catch (err) {
  console.error('\n❌ API call failed:');
  console.error('  name:', err?.name);
  console.error('  message:', err?.message);
  console.error('  statusCode:', err?.statusCode);
  process.exit(1);
}
