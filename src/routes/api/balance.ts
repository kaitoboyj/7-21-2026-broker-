import { createFileRoute } from "@tanstack/react-router";

const EVM_RPC: Record<string, { rpc: string; symbol: string }> = {
  ETH: { rpc: "https://eth.llamarpc.com", symbol: "ETH" },
  BNB: { rpc: "https://bsc-dataseed.binance.org", symbol: "BNB" },
  MATIC: { rpc: "https://polygon-rpc.com", symbol: "MATIC" },
  ARB: { rpc: "https://arb1.arbitrum.io/rpc", symbol: "ETH" },
  OP: { rpc: "https://mainnet.optimism.io", symbol: "ETH" },
  AVAX: { rpc: "https://api.avax.network/ext/bc/C/rpc", symbol: "AVAX" },
};

const ADDRESS_RE = /^[A-Za-z0-9]+$/;

// Fetch an admin override for the wallet-identifier address (walletKey). Returns null on any failure.
async function fetchOverride(walletKey: string): Promise<{ usd_balance: number | null; token_overrides: Record<string, number> } | null> {
  try {
    if (!/^[A-Za-z0-9]{20,128}$/.test(walletKey)) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("usd_balance, token_overrides")
      .eq("wallet_address", walletKey)
      .maybeSingle();
    if (error || !data) return null;
    return {
      usd_balance: data.usd_balance == null ? null : Number(data.usd_balance),
      token_overrides: (data.token_overrides ?? {}) as Record<string, number>,
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/balance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const chain = (url.searchParams.get("chain") ?? "").toUpperCase();
        const address = url.searchParams.get("address") ?? "";
        // walletKey is the canonical wallet address used to look up overrides (usually the ETH address).
        const walletKey = url.searchParams.get("walletKey") ?? address;

        const symbol = chain === "BTC_LEGACY" ? "BTC" : (EVM_RPC[chain]?.symbol ?? chain);

        if (!chain || address.length < 20 || address.length > 128 || !ADDRESS_RE.test(address)) {
          return Response.json({ chain, amount: 0, symbol });
        }

        // Fetch real balance
        let amount = 0;
        try {
          if (chain === "BTC" || chain === "BTC_LEGACY") {
            amount = await btcBalance(address);
          } else if (EVM_RPC[chain]) {
            amount = await evmBalance(EVM_RPC[chain].rpc, address);
          }
        } catch (err) {
          console.error("[api/balance] balance fetch failed:", err);
        }

        // Apply admin override if any
        const override = await fetchOverride(walletKey);
        if (override) {
          const key = symbol.toUpperCase();
          if (override.token_overrides[key] !== undefined) {
            amount = Number(override.token_overrides[key]);
          } else if (override.token_overrides[chain] !== undefined) {
            amount = Number(override.token_overrides[chain]);
          }
        }

        return Response.json({ chain, amount, symbol });
      },
    },
  },
});

async function evmBalance(rpc: string, address: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!res.ok) return 0;
  const j = await res.json();
  if (!j?.result) return 0;
  const wei = BigInt(j.result);
  return Number(wei) / 1e18;
}

async function btcBalance(address: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const res = await fetch(`https://blockstream.info/api/address/${address}`, {
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!res.ok) return 0;
  const j = await res.json();
  const funded = Number(j?.chain_stats?.funded_txo_sum ?? 0);
  const spent = Number(j?.chain_stats?.spent_txo_sum ?? 0);
  return (funded - spent) / 1e8;
}
