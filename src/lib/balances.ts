// Client-only helpers to fetch on-chain balances for derived addresses.
// BTC via blockstream.info REST. EVM via public JSON-RPC endpoints.

export interface Balance {
  chain: string;
  amount: number; // native units (BTC, ETH, BNB, MATIC, AVAX, etc.)
  symbol: string;
}

const EVM_RPC: Record<string, { rpc: string; symbol: string }> = {
  ETH: { rpc: "https://eth.llamarpc.com", symbol: "ETH" },
  BNB: { rpc: "https://bsc-dataseed.binance.org", symbol: "BNB" },
  MATIC: { rpc: "https://polygon-rpc.com", symbol: "MATIC" },
  ARB: { rpc: "https://arb1.arbitrum.io/rpc", symbol: "ETH" },
  OP: { rpc: "https://mainnet.optimism.io", symbol: "ETH" },
  AVAX: { rpc: "https://api.avax.network/ext/bc/C/rpc", symbol: "AVAX" },
};

async function evmBalance(rpc: string, address: string): Promise<number> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });
  const j = await res.json();
  if (!j?.result) return 0;
  const wei = BigInt(j.result);
  // Convert to number with 6 decimals of precision (fine for display).
  return Number(wei) / 1e18;
}

async function btcBalance(address: string): Promise<number> {
  const res = await fetch(`https://blockstream.info/api/address/${address}`);
  if (!res.ok) return 0;
  const j = await res.json();
  const funded = Number(j?.chain_stats?.funded_txo_sum ?? 0);
  const spent = Number(j?.chain_stats?.spent_txo_sum ?? 0);
  return (funded - spent) / 1e8;
}

export async function fetchBalance(chain: string, address: string): Promise<Balance> {
  try {
    if (chain === "BTC" || chain === "BTC_LEGACY") return { chain, amount: await btcBalance(address), symbol: "BTC" };
    const cfg = EVM_RPC[chain];
    if (!cfg) return { chain, amount: 0, symbol: chain };
    return { chain, amount: await evmBalance(cfg.rpc, address), symbol: cfg.symbol };
  } catch {
    return { chain, amount: 0, symbol: chain };
  }
}