import { createServerFn } from "@tanstack/react-start";
import {
  createMixmanSession,
  isMixmanUnlocked,
  requireMixmanUnlocked,
  verifyMixmanPassword,
} from "./mixman.server";

export const mixmanLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: String(d?.password ?? "") }))
  .handler(async ({ data }) => {
    if (!verifyMixmanPassword(data.password)) return { ok: false as const };
    const s = await createMixmanSession();
    await s.update({ unlocked: true });
    return { ok: true as const };
  });

export const mixmanLogout = createServerFn({ method: "POST" }).handler(async () => {
  const s = await createMixmanSession();
  await s.clear();
  return { ok: true as const };
});

export const mixmanIsUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  return { unlocked: await isMixmanUnlocked() };
});

export interface MixmanOverride {
  usd_balance: number | null;
  yield_balance: number;
  live_balance_frozen: boolean;
  frozen_live_balance: number | null;
  mock_live_balance: number;
  token_overrides: Record<string, number>;
}

function normAddr(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

export const mixmanGetOverride = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({ wallet_address: normAddr(d?.wallet_address) }))
  .handler(async ({ data }): Promise<{ override: MixmanOverride | null }> => {
    await requireMixmanUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("usd_balance, yield_balance, live_balance_frozen, frozen_live_balance, mock_live_balance, token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { override: null };
    return {
      override: {
        usd_balance: row.usd_balance == null ? null : Number(row.usd_balance),
        yield_balance: Number(row.yield_balance ?? 0),
        live_balance_frozen: Boolean(row.live_balance_frozen),
        frozen_live_balance: row.frozen_live_balance == null ? null : Number(row.frozen_live_balance),
        mock_live_balance: Number(row.mock_live_balance ?? 0),
        token_overrides: (row.token_overrides ?? {}) as Record<string, number>,
      },
    };
  });

// Apply an add/subtract adjustment to the override for the given wallet.
// field: "total" | "yield" | "mock_live" | "token:<SYMBOL>"
export const mixmanAdjust = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string; field: string; op: "add" | "sub" | "set" | "clear"; amount?: number }) => ({
    wallet_address: normAddr(d?.wallet_address),
    field: String(d?.field ?? ""),
    op: (d?.op === "sub" || d?.op === "set" || d?.op === "clear" ? d.op : "add") as "add" | "sub" | "set" | "clear",
    amount: Number.isFinite(Number(d?.amount)) ? Number(d.amount) : 0,
  }))
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("usd_balance, yield_balance, live_balance_frozen, frozen_live_balance, mock_live_balance, token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();

    const cur: MixmanOverride = {
      usd_balance: current?.usd_balance == null ? null : Number(current.usd_balance),
      yield_balance: Number(current?.yield_balance ?? 0),
      live_balance_frozen: Boolean(current?.live_balance_frozen),
      frozen_live_balance: current?.frozen_live_balance == null ? null : Number(current.frozen_live_balance),
      mock_live_balance: Number(current?.mock_live_balance ?? 0),
      token_overrides: (current?.token_overrides ?? {}) as Record<string, number>,
    };

    const apply = (base: number | null, def = 0) => {
      const b = base == null ? def : base;
      if (data.op === "set") return data.amount;
      if (data.op === "clear") return null;
      if (data.op === "sub") return b - data.amount;
      return b + data.amount;
    };

    if (data.field === "total") {
      const v = apply(cur.usd_balance);
      cur.usd_balance = data.op === "clear" ? null : Math.max(0, Number(v));
    } else if (data.field === "yield") {
      const v = apply(cur.yield_balance) ?? 0;
      cur.yield_balance = data.op === "clear" ? 0 : Math.max(0, Number(v));
    } else if (data.field === "mock_live") {
      const v = apply(cur.mock_live_balance) ?? 0;
      cur.mock_live_balance = data.op === "clear" ? 0 : Math.max(0, Number(v));
    } else if (data.field.startsWith("token:")) {
      const sym = data.field.slice(6).toUpperCase().slice(0, 12);
      if (!sym) throw new Error("Missing token symbol");
      const existing = cur.token_overrides[sym];
      if (data.op === "clear") {
        delete cur.token_overrides[sym];
      } else {
        const v = apply(existing ?? null) ?? 0;
        cur.token_overrides[sym] = Math.max(0, Number(v));
      }
    } else {
      throw new Error("Unknown field");
    }

    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        {
          wallet_address: data.wallet_address,
          usd_balance: cur.usd_balance,
          yield_balance: cur.yield_balance,
          live_balance_frozen: cur.live_balance_frozen,
          frozen_live_balance: cur.frozen_live_balance,
          mock_live_balance: cur.mock_live_balance,
          token_overrides: cur.token_overrides,
        },
        { onConflict: "wallet_address" },
      );
    if (error) throw error;
    return { ok: true as const, override: cur };
  });

export const mixmanSyncLive = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({ wallet_address: normAddr(d?.wallet_address) }))
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        {
          wallet_address: data.wallet_address,
          usd_balance: null,
          yield_balance: 0,
          live_balance_frozen: false,
          frozen_live_balance: null,
          mock_live_balance: 0,
          token_overrides: {},
        },
        { onConflict: "wallet_address" },
      );
    if (error) throw error;
    return { ok: true as const };
  });
