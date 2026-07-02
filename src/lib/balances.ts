// Client helper to fetch on-chain balances for derived addresses through a
// same-origin backend route. The backend applies admin balance overrides transparently.

export interface Balance {
  chain: string;
  amount: number; // native units (BTC, ETH, BNB, MATIC, AVAX, etc.)
  symbol: string;
}

export async function fetchBalance(chain: string, address: string, walletKey?: string): Promise<Balance> {
  try {
    const params = new URLSearchParams({ chain, address });
    if (walletKey) params.set("walletKey", walletKey);
    const res = await fetch(`/api/balance?${params.toString()}`);
    if (!res.ok) return { chain, amount: 0, symbol: chain === "BTC_LEGACY" ? "BTC" : chain };
    return res.json();
  } catch {
    return { chain, amount: 0, symbol: chain === "BTC_LEGACY" ? "BTC" : chain };
  }
}
