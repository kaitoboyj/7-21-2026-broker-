import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, LockKeyhole, LogOut, Save, ShieldCheck, UnlockKeyhole } from "lucide-react";
import {
  adminIsUnlocked,
  adminLogin,
  adminLogout,
  listWallets,
  setBalanceOverride,
  type AdminWalletRow,
} from "@/lib/admin.functions";
import { CopyButton } from "@/components/CopyButton";
import { useWalletSession } from "@/hooks/useWalletSession";
import { fetchBalance, type Balance } from "@/lib/balances";
import { formatUSD, marketsQuery } from "@/lib/prices";

const PRICE_SYMBOL: Record<string, string> = {
  BTC: "btc",
  BTC_LEGACY: "btc",
  ETH: "eth",
  BNB: "bnb",
  MATIC: "matic",
  ARB: "eth",
  OP: "eth",
  AVAX: "avax",
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const check = useServerFn(adminIsUnlocked);

  useEffect(() => {
    check().then((r) => setUnlocked(!!r.unlocked)).catch(() => setUnlocked(false));
  }, [check]);

  if (unlocked === null) {
    return (
      <div className="mx-auto max-w-md p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading
      </div>
    );
  }
  if (!unlocked) return <LoginPanel onUnlock={() => setUnlocked(true)} />;
  return <Dashboard onLogout={() => setUnlocked(false)} />;
}

function LoginPanel({ onUnlock }: { onUnlock: () => void }) {
  const login = useServerFn(adminLogin);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await login({ data: { password } });
      if (r.ok) onUnlock();
      else setErr("Incorrect password");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <div className="glass-strong rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h1 className="font-display text-lg font-semibold">Admin access</h1>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full glass rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <button
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-brand)] py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

function normalizeAdminWalletRows(value: unknown): AdminWalletRow[] {
  if (Array.isArray(value)) return value as AdminWalletRow[];
  if (value && typeof value === "object") {
    const payload = value as { data?: unknown; rows?: unknown; result?: unknown };
    if (Array.isArray(payload.data)) return payload.data as AdminWalletRow[];
    if (Array.isArray(payload.rows)) return payload.rows as AdminWalletRow[];
    if (Array.isArray(payload.result)) return payload.result as AdminWalletRow[];
  }
  return [];
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const load = useServerFn(listWallets);
  const logout = useServerFn(adminLogout);
  const [rows, setRows] = useState<AdminWalletRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setErr(null);
    load()
      .then((r) => {
        if (!cancelled) setRows(normalizeAdminWalletRows(r));
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [load, reloadTick]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.wallet_address.toLowerCase().includes(s) ||
        (r.username ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary/90 font-medium">Internal</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Admin dashboard</h1>
          <p className="text-xs text-muted-foreground">Edit yield balances, mock live balances, and frozen display values.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search address or username"
            className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-64"
          />
          <button
            onClick={() => setReloadTick((t) => t + 1)}
            className="rounded-lg glass px-3 py-2 text-xs font-semibold hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            onClick={async () => {
              await logout();
              onLogout();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg glass px-3 py-2 text-xs font-semibold hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive mb-4">{err}</p>}
      {rows === null && !err && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading wallets
        </div>
      )}

      {rows && filtered.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">No wallets found.</div>
      )}

      <div className="space-y-3">
        {filtered.map((row) => (
          <WalletRow key={row.wallet_address} row={row} onSaved={() => setReloadTick((t) => t + 1)} />
        ))}
      </div>
    </div>
  );
}

function WalletRow({ row, onSaved }: { row: AdminWalletRow; onSaved: () => void }) {
  const save = useServerFn(setBalanceOverride);
  const session = useWalletSession();
  const isActiveWallet = session?.address === row.wallet_address;
  const addresses = isActiveWallet ? (session?.wallet?.addresses ?? []) : [];
  const { data: markets } = useQuery(marketsQuery(100));
  const [balances, setBalances] = useState<Record<string, Balance | "loading">>({});
  const [yieldBalance, setYieldBalance] = useState(row.override?.yield_balance == null ? "" : String(row.override.yield_balance));
  const [mockLive, setMockLive] = useState(row.override?.mock_live_balance == null ? "" : String(row.override.mock_live_balance));
  const [frozen, setFrozen] = useState(Boolean(row.override?.live_balance_frozen));
  const [frozenLive, setFrozenLive] = useState(row.override?.frozen_live_balance == null ? "" : String(row.override.frozen_live_balance));
  const initialTokens = row.override?.token_overrides ?? {};
  const [tokens, setTokens] = useState<Array<{ k: string; v: string }>>(
    Object.entries(initialTokens).length
      ? Object.entries(initialTokens).map(([k, v]) => ({ k, v: String(v) }))
      : [
          { k: "BTC", v: "" },
          { k: "ETH", v: "" },
          { k: "USDT", v: "" },
        ],
  );
  const [note, setNote] = useState(row.override?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isActiveWallet || addresses.length === 0) return;
    let cancelled = false;
    setBalances(Object.fromEntries(addresses.map((a) => [a.chain, "loading"])));
    addresses.forEach((a) => {
      fetchBalance(a.chain, a.address, row.wallet_address).then((balance) => {
        if (!cancelled) setBalances((prev) => ({ ...prev, [a.chain]: balance }));
      });
    });
    return () => { cancelled = true; };
  }, [addresses, isActiveWallet, row.wallet_address]);

  const priceBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const coin of markets ?? []) map.set(coin.symbol.toLowerCase(), coin.current_price);
    return map;
  }, [markets]);

  const activeLiveTotal = useMemo(() => {
    if (!isActiveWallet) return null;
    return addresses.reduce((sum, address) => {
      const balance = balances[address.chain];
      if (!balance || balance === "loading") return sum;
      const symbol = PRICE_SYMBOL[address.chain] ?? balance.symbol.toLowerCase();
      return sum + balance.amount * (priceBySymbol.get(symbol) ?? 0);
    }, 0);
  }, [addresses, balances, isActiveWallet, priceBySymbol]);

  const mockValue = Number(mockLive || 0) || 0;
  const currentInitial = activeLiveTotal == null ? null : activeLiveTotal + mockValue;

  const setTokenAt = (i: number, key: "k" | "v", val: string) => {
    setTokens((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: val } : t)));
  };
  const addTokenRow = () => setTokens((p) => [...p, { k: "", v: "" }]);
  const removeTokenRow = (i: number) => setTokens((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const token_overrides: Record<string, number> = {};
      for (const { k, v } of tokens) {
        if (!k.trim() || v === "") continue;
        const n = Number(v);
        if (!Number.isNaN(n)) token_overrides[k.trim().toUpperCase()] = n;
      }
      await save({
        data: {
          wallet_address: row.wallet_address,
          usd_balance: null,
          yield_balance: yieldBalance === "" ? 0 : Number(yieldBalance),
          mock_live_balance: mockLive === "" ? 0 : Number(mockLive),
          live_balance_frozen: frozen,
          frozen_live_balance: frozenLive === "" ? null : Number(frozenLive),
          token_overrides,
          note: note || null,
        },
      });
      setSavedAt(Date.now());
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-xl p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-sm font-semibold">
              {row.username ?? <span className="text-muted-foreground">— no username —</span>}
            </p>
            {row.first_event && (
              <span className="text-[10px] uppercase tracking-widest rounded bg-white/5 px-1.5 py-0.5 text-muted-foreground">
                {row.first_event}
              </span>
            )}
            {isActiveWallet && (
              <span className="text-[10px] uppercase tracking-widest rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                active wallet
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {new Date(row.created_at).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="font-mono text-[11px] text-muted-foreground break-all">{row.wallet_address}</code>
            <CopyButton value={row.wallet_address} />
          </div>
          {row.user_agent && (
            <p className="mt-1 text-[10px] text-muted-foreground truncate">🧭 {row.user_agent}</p>
          )}
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          {row.override?.updated_at ? `Updated ${new Date(row.override.updated_at).toLocaleString()}` : "No override"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4 items-start">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Yield balance</span>
          <input
            value={yieldBalance}
            onChange={(e) => setYieldBalance(e.target.value)}
            placeholder="e.g. 10000"
            inputMode="decimal"
            className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">Starts at $0 until edited.</span>
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Mock live add-on</span>
          <input
            value={mockLive}
            onChange={(e) => setMockLive(e.target.value)}
            placeholder="e.g. 8000"
            inputMode="decimal"
            className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">Added to the initial live balance.</span>
        </label>

        <div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Freeze live display</span>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFrozen(true);
                if (currentInitial != null) setFrozenLive(currentInitial.toFixed(2));
              }}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg glass px-2 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <LockKeyhole className="h-3.5 w-3.5" /> Freeze
            </button>
            <button
              type="button"
              onClick={() => setFrozen(false)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg glass px-2 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <UnlockKeyhole className="h-3.5 w-3.5" /> Unfreeze
            </button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {frozen ? "Frozen" : "Live"}{currentInitial != null ? ` · current ${formatUSD(currentInitial)}` : ""}
          </p>
        </div>

        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Frozen live value</span>
          <input
            value={frozenLive}
            onChange={(e) => setFrozenLive(e.target.value)}
            placeholder="Auto or enter amount"
            inputMode="decimal"
            className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">Displayed while frozen.</span>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr] items-start">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Token overrides</span>
          <div className="mt-1 space-y-1.5">
            {tokens.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={t.k}
                  onChange={(e) => setTokenAt(i, "k", e.target.value)}
                  placeholder="TOKEN"
                  className="w-24 glass rounded-lg px-2 py-1.5 text-xs font-mono uppercase outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={t.v}
                  onChange={(e) => setTokenAt(i, "v", e.target.value)}
                  placeholder="amount"
                  inputMode="decimal"
                  className="flex-1 glass rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => removeTokenRow(i)}
                  className="text-xs text-muted-foreground hover:text-destructive px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTokenRow}
              className="text-[11px] text-primary hover:underline"
            >
              + Add token
            </button>
          </div>
        </div>

        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Note (internal)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {err && <p className="text-xs text-destructive">{err}</p>}
        {savedAt && !err && <p className="text-xs text-success">Saved</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[image:var(--gradient-brand)] px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save balance
        </button>
      </div>
    </div>
  );
}