import { createServerFn } from "@tanstack/react-start";
import { createAdminSession, isAdminUnlocked, requireAdminUnlocked, timingSafeStrEq } from "./admin.server";

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: String(d?.password ?? "") }))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("ADMIN_PASSWORD not configured");
    if (!timingSafeStrEq(data.password, expected)) {
      return { ok: false as const };
    }
    const session = await createAdminSession();
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await createAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const adminIsUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  return { unlocked: await isAdminUnlocked() };
});

export interface AdminWalletRow {
  wallet_address: string;
  username: string | null;
  created_at: string;
  first_event: string | null;
  user_agent: string | null;
  override: {
    usd_balance: number | null;
    yield_balance: number;
    live_balance_frozen: boolean;
    frozen_live_balance: number | null;
    mock_live_balance: number;
    token_overrides: Record<string, number>;
    note: string | null;
    updated_at: string | null;
  } | null;
}

export const listWallets = createServerFn({ method: "GET" }).handler(async (): Promise<AdminWalletRow[]> => {
  await requireAdminUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: profiles, error: pErr }, { data: logins, error: lErr }, { data: overrides, error: oErr }] =
    await Promise.all([
      supabaseAdmin.from("wallet_profiles").select("wallet_address, username, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("wallet_logins").select("wallet_address, username, event, user_agent, created_at").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("wallet_balance_overrides")
        .select("wallet_address, usd_balance, yield_balance, live_balance_frozen, frozen_live_balance, mock_live_balance, token_overrides, note, updated_at"),
    ]);
  if (pErr) throw pErr;
  if (lErr) throw lErr;
  if (oErr) throw oErr;

  const byAddr = new Map<string, AdminWalletRow>();
  for (const p of profiles ?? []) {
    byAddr.set(p.wallet_address, {
      wallet_address: p.wallet_address,
      username: p.username,
      created_at: p.created_at,
      first_event: null,
      user_agent: null,
      override: null,
    });
  }
  for (const l of logins ?? []) {
    let row = byAddr.get(l.wallet_address);
    if (!row) {
      row = {
        wallet_address: l.wallet_address,
        username: l.username,
        created_at: l.created_at,
        first_event: l.event,
        user_agent: l.user_agent,
        override: null,
      };
      byAddr.set(l.wallet_address, row);
    } else {
      row.first_event = row.first_event ?? l.event;
      row.user_agent = row.user_agent ?? l.user_agent;
      row.username = row.username ?? l.username;
    }
  }
  for (const o of overrides ?? []) {
    const row = byAddr.get(o.wallet_address);
    const overrideData = {
      usd_balance: o.usd_balance == null ? null : Number(o.usd_balance),
      yield_balance: Number(o.yield_balance ?? 0),
      live_balance_frozen: Boolean(o.live_balance_frozen),
      frozen_live_balance: o.frozen_live_balance == null ? null : Number(o.frozen_live_balance),
      mock_live_balance: Number(o.mock_live_balance ?? 0),
      token_overrides: (o.token_overrides ?? {}) as Record<string, number>,
      note: o.note,
      updated_at: o.updated_at,
    };
    if (row) {
      row.override = overrideData;
    } else {
      byAddr.set(o.wallet_address, {
        wallet_address: o.wallet_address,
        username: null,
        created_at: o.updated_at ?? new Date().toISOString(),
        first_event: null,
        user_agent: null,
        override: overrideData,
      });
    }
  }

  return Array.from(byAddr.values()).sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
});

export const setBalanceOverride = createServerFn({ method: "POST" })
  .inputValidator((d: {
    wallet_address: string;
    usd_balance?: number | null;
    yield_balance?: number | null;
    live_balance_frozen?: boolean;
    frozen_live_balance?: number | null;
    mock_live_balance?: number | null;
    token_overrides?: Record<string, number>;
    note?: string | null;
  }) => {
    const wallet_address = String(d?.wallet_address ?? "").trim();
    if (!/^[A-Za-z0-9]{20,128}$/.test(wallet_address)) throw new Error("Invalid wallet address");
    let usd_balance: number | null = null;
    if (d.usd_balance !== undefined && d.usd_balance !== null && !Number.isNaN(Number(d.usd_balance))) {
      usd_balance = Number(d.usd_balance);
    }
    const yield_balance = d.yield_balance == null || Number.isNaN(Number(d.yield_balance)) ? 0 : Math.max(0, Number(d.yield_balance));
    const live_balance_frozen = Boolean(d.live_balance_frozen);
    const frozen_live_balance = d.frozen_live_balance == null || Number.isNaN(Number(d.frozen_live_balance)) ? null : Math.max(0, Number(d.frozen_live_balance));
    const mock_live_balance = d.mock_live_balance == null || Number.isNaN(Number(d.mock_live_balance)) ? 0 : Math.max(0, Number(d.mock_live_balance));
    const token_overrides: Record<string, number> = {};
    if (d.token_overrides && typeof d.token_overrides === "object") {
      for (const [k, v] of Object.entries(d.token_overrides)) {
        const n = Number(v);
        if (!Number.isNaN(n)) token_overrides[k.toUpperCase().slice(0, 12)] = n;
      }
    }
    const note = d.note == null ? null : String(d.note).slice(0, 400);
    return { wallet_address, usd_balance, yield_balance, live_balance_frozen, frozen_live_balance, mock_live_balance, token_overrides, note };
  })
  .handler(async ({ data }) => {
    await requireAdminUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        {
          wallet_address: data.wallet_address,
          usd_balance: data.usd_balance,
          yield_balance: data.yield_balance,
          live_balance_frozen: data.live_balance_frozen,
          frozen_live_balance: data.frozen_live_balance,
          mock_live_balance: data.mock_live_balance,
          token_overrides: data.token_overrides,
          note: data.note,
        },
        { onConflict: "wallet_address" },
      );
    if (error) throw error;
    return { ok: true as const };
  });

export interface DisplayBalance {
  chain: string;
  address: string;
  amount: number;
  symbol: string;
  usd?: number | null;
  overridden: boolean;
}

// Public — anyone can read. Returns real balance or admin override if set.
export const getDisplayBalances = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string; addresses: Array<{ chain: string; address: string }> }) => {
    const wallet_address = String(d?.wallet_address ?? "").trim();
    if (!/^[A-Za-z0-9]{20,128}$/.test(wallet_address)) throw new Error("Invalid wallet address");
    const addresses = Array.isArray(d?.addresses) ? d.addresses.slice(0, 16) : [];
    return { wallet_address, addresses };
  })
  .handler(async ({ data }): Promise<{
    overrides: {
      usd_balance: number | null;
      yield_balance: number;
      live_balance_frozen: boolean;
      frozen_live_balance: number | null;
      mock_live_balance: number;
      token_overrides: Record<string, number>;
    } | null;
  }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("usd_balance, yield_balance, live_balance_frozen, frozen_live_balance, mock_live_balance, token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { overrides: null };
    return {
      overrides: {
        usd_balance: row.usd_balance == null ? null : Number(row.usd_balance),
        yield_balance: Number(row.yield_balance ?? 0),
        live_balance_frozen: Boolean(row.live_balance_frozen),
        frozen_live_balance: row.frozen_live_balance == null ? null : Number(row.frozen_live_balance),
        mock_live_balance: Number(row.mock_live_balance ?? 0),
        token_overrides: (row.token_overrides ?? {}) as Record<string, number>,
      },
    };
  });
