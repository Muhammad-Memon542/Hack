/**
 * Sign-In With Solana (SIWS) — EIP-4361-equivalent message construction.
 * Shared between the client (signing) and the server (verification).
 */

export interface SiwsFields {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
}

export function buildSiwsMessage({ domain, address, nonce, issuedAt }: SiwsFields): string {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    "",
    "By signing you authenticate to Better. This does not trigger a transaction.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export function parseSiwsMessage(message: string): SiwsFields | null {
  const lines = message.split("\n");
  if (lines.length < 7) return null;
  const domainMatch = lines[0].match(/^(.+) wants you to sign in with your Solana account:$/);
  const nonceLine = lines.find((l) => l.startsWith("Nonce: "));
  const issuedAtLine = lines.find((l) => l.startsWith("Issued At: "));
  if (!domainMatch || !nonceLine || !issuedAtLine) return null;
  return {
    domain: domainMatch[1],
    address: lines[1],
    nonce: nonceLine.slice("Nonce: ".length),
    issuedAt: issuedAtLine.slice("Issued At: ".length),
  };
}
