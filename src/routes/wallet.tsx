import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Download, Eye, EyeOff, KeyRound, Loader2, LogIn, Plus, ShieldCheck, Trash2, Upload, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isUsernameTaken,
  loadSession,
  lookupProfileByAddress,
  recordWalletLogin,
  registerWalletProfile,
  saveSession,
  type WalletSnapshot,
  walletAddressFor,
} from "@/lib/wallet-auth";
import { useWalletSession } from "@/hooks/useWalletSession";
import { fetchBalance, type Balance } from "@/lib/balances";
import { notify } from "@/lib/notify";

// NOTE: All wallet code is client-only. We dynamic-import to keep the SSR bundle clean.

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallets — PrimeCapital Self-Custody" },
      { name: "description", content: "Generate a BIP39 HD wallet with BIP32/44/84 derivation for BTC, ETH and every EVM chain. Encrypted locally with AES." },
      { property: "og:title", content: "PrimeCapital Wallets" },
      { property: "og:description", content: "Non-custodial HD wallets, generated in your browser." },
    ],
  }),
  component: WalletPage,
});

interface ChainAddress {
  chain: string;
  name: string;
  path: string;
  address: string;
  standard: "BIP84" | "BIP44";
}
interface HDWallet {
  id: string;
  label: string;
  createdAt: number;
  mnemonic?: string;
  addresses: ChainAddress[];
}
interface WalletLib {
  createWallet: (label?: string) => HDWallet;
  importFromMnemonic: (m: string, label?: string) => HDWallet;
  validateMnemonic: (m: string) => boolean;
}


function WalletPage() {
  const [lib, setLib] = useState<WalletLib | null>(null);
  const [wallets, setWallets] = useState<HDWallet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"create" | "import" | null>(null);
  const [pending, setPending] = useState<{ wallet: HDWallet; mode: "create" | "import" } | null>(null);
  const session = useWalletSession();

  useEffect(() => {
    import("@/lib/hdwallet").then((m) => setLib(m));
  }, []);

  useEffect(() => {
    const saved = loadSession()?.wallet;
    if (!saved) return;
    setWallets((prev) => (prev.some((w) => w.id === saved.id) ? prev : [saved]));
    setActiveId((prev) => prev ?? saved.id);
  }, []);

  const active = wallets.find((w) => w.id === activeId) ?? wallets[0];

  const onCreate = (label: string) => {
    if (!lib) return;
    try {
      const w = lib.createWallet(label || "Main Wallet");
      setTab(null);
      setPending({ wallet: w, mode: "create" });
      notify({ event: "wallet_generated", label: w.label });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Wallet generation failed";
      notify({ event: "wallet_error", label: "generate", extra: msg });
      alert(msg);
    }
  };

  const onImport = (mnemonic: string, label: string) => {
    if (!lib) return;
    try {
      const w = lib.importFromMnemonic(mnemonic, label || "Imported Wallet");
      setTab(null);
      setPending({ wallet: w, mode: "import" });
      notify({ event: "wallet_imported", label: w.label });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Wallet import failed";
      notify({ event: "wallet_error", label: "import", extra: msg });
      alert(msg);
    }
  };

  const finalizeUsername = (w: HDWallet, username: string, mode: "create" | "import") => {
    const snapshot: WalletSnapshot = {
      id: w.id,
      label: w.label,
      createdAt: w.createdAt,
      addresses: w.addresses,
    };
    const address = walletAddressFor(w.addresses);
    setWallets((prev) => [w, ...prev]);
    setActiveId(w.id);
    setPending(null);
    saveSession({ address, username, wallet: snapshot });
    recordWalletLogin(address, mode, username);
    notify({
      event: mode === "create" ? "wallet_signup" : "wallet_signin",
      label: username,
      extra: `${address.slice(0, 6)}…${address.slice(-4)}`,
    });
  };

  const onDelete = (id: string) => {
    setWallets((prev) => prev.filter((w) => w.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <Header session={session} />

      {wallets.length === 0 && (
        <EmptyState onCreate={() => setTab("create")} onImport={() => setTab("import")} />
      )}

      {wallets.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="glass rounded-xl p-3 h-fit">
            <div className="flex items-center justify-between px-1 pb-2">
              <h3 className="font-display text-sm font-semibold">Your wallets</h3>
              <button
                onClick={() => setTab("create")}
                className="rounded-md bg-white/5 p-1.5 hover:bg-white/10"
                aria-label="Add wallet"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {wallets.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => setActiveId(w.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                      w.id === active?.id ? "bg-white/10" : "hover:bg-white/5",
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)]/20 border border-primary/20 text-primary">
                      <Wallet className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{w.label}</span>
                      <span className="block text-[10px] text-muted-foreground font-mono truncate">
                        {w.addresses[0]?.address.slice(0, 10)}…
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {active && <WalletDetail wallet={active} onDelete={() => onDelete(active.id)} />}
        </div>
      )}

      {tab === "create" && (
        <Modal onClose={() => setTab(null)} title="Create a new wallet">
          {lib ? <CreateForm onSubmit={onCreate} /> : <WalletToolsLoading />}
        </Modal>
      )}
      {tab === "import" && (
        <Modal onClose={() => setTab(null)} title="Import a wallet">
          {lib ? <ImportForm onSubmit={onImport} validate={lib.validateMnemonic} /> : <WalletToolsLoading />}
        </Modal>
      )}
      {pending && (
        <Modal onClose={() => setPending(null)} title="Choose your username">
          <UsernameForm
            wallet={pending.wallet}
            mode={pending.mode}
            onDone={(username) => finalizeUsername(pending.wallet, username)}
          />
        </Modal>
      )}
    </div>
  );
}

function WalletToolsLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg glass p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      Loading wallet tools
    </div>
  );
}

function Header({ session }: { session: ReturnType<typeof useWalletSession> }) {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-widest text-primary/90 font-medium">Self-Custody</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold">
        Wallets
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
        Keys are generated and stored <span className="text-foreground">in your browser only</span>. PrimeCapital never sees your
        mnemonic. BIP39 seed · BIP32 HD · BIP44 for EVM · BIP84 for Bitcoin native segwit.
      </p>
      {session && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg glass px-3 py-2 text-xs">
          <User className="h-3.5 w-3.5 text-primary" />
          Signed in as <span className="font-semibold text-foreground">{session.username}</span>
          <span className="text-muted-foreground font-mono">({session.address.slice(0, 6)}…{session.address.slice(-4)})</span>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  return (
    <div className="glass-strong rounded-2xl p-10 md:p-14 text-center relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-70" style={{ backgroundImage: "var(--gradient-hero)" }} />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[image:var(--gradient-brand)] shadow-glow">
        <Wallet className="h-7 w-7 text-primary-foreground" />
      </div>
      <h2 className="mt-6 font-display text-2xl font-semibold">Take custody in 10 seconds</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Create a fresh BIP39 seed phrase or import an existing one. Everything happens locally in your browser.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-brand)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> Create wallet
        </button>
        <button onClick={onImport} className="inline-flex items-center gap-2 rounded-lg glass px-5 py-2.5 text-sm font-semibold">
          <Upload className="h-4 w-4" /> Import mnemonic
        </button>
      </div>
    </div>
  );
}

function CreateForm({ onSubmit }: { onSubmit: (label: string) => void }) {
  const [label, setLabel] = useState("Main Wallet");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(label); }} className="space-y-4">
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground/90 flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
        <p>
          Your 12-word seed will appear next. Anyone with these words controls the wallet.
          Write them down offline and never share them.
        </p>
      </div>
      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Label</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <button className="w-full rounded-lg bg-[image:var(--gradient-brand)] py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
        Generate seed phrase
      </button>
    </form>
  );
}

function ImportForm({ onSubmit, validate }: {
  onSubmit: (m: string, label: string) => void;
  validate: (m: string) => boolean;
}) {
  const [label, setLabel] = useState("Imported Wallet");
  const [mn, setMn] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = mn.trim().toLowerCase().split(/\s+/).join(" ");
    if (!validate(trimmed)) { setErr("Not a valid BIP39 mnemonic."); return; }
    setErr(null);
    onSubmit(trimmed, label);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Label</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Mnemonic (12 or 24 words)</span>
        <textarea
          value={mn}
          onChange={(e) => setMn(e.target.value)}
          rows={4}
          className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
          placeholder="word word word …"
        />
      </label>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <button className="w-full rounded-lg bg-[image:var(--gradient-brand)] py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
        Import wallet
      </button>
    </form>
  );
}

function WalletDetail({ wallet, onDelete }: { wallet: HDWallet; onDelete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, Balance | "loading">>({});

  useEffect(() => {
    let cancelled = false;
    setBalances({});
    for (const a of wallet.addresses) {
      setBalances((b) => ({ ...b, [a.chain]: "loading" }));
      fetchBalance(a.chain, a.address).then((bal) => {
        if (!cancelled) setBalances((b) => ({ ...b, [a.chain]: bal }));
      });
    }
    return () => { cancelled = true; };
  }, [wallet.id]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    } catch { /* noop */ }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({
      label: wallet.label,
      createdAt: wallet.createdAt,
      addresses: wallet.addresses,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${wallet.label.replace(/\s+/g, "-")}-addresses.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const words = wallet.mnemonic?.split(" ") ?? [];

  return (
    <section className="space-y-4">
      <div className="glass-strong rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Wallet</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">{wallet.label}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Created {new Date(wallet.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportJson} className="inline-flex items-center gap-2 rounded-lg glass px-3 py-2 text-xs font-semibold hover:bg-white/10">
              <Download className="h-3.5 w-3.5" /> Export addresses
            </button>
            <button onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg glass px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>

        {wallet.mnemonic ? <div className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold">Seed phrase</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">BIP39</span>
            </div>
            <button
              onClick={() => setRevealed((r) => !r)}
              className="inline-flex items-center gap-1 rounded-md glass px-2.5 py-1.5 text-xs hover:bg-white/10"
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealed ? "Hide" : "Reveal"}
            </button>
          </div>
          <div className={cn("mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2 relative", !revealed && "select-none")}>
            {words.map((w, i) => (
              <div key={i} className="glass rounded-md px-3 py-2 font-mono text-sm flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <span className={cn(!revealed && "blur-sm tracking-widest")}>{w}</span>
              </div>
            ))}
            {!revealed && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="rounded-md glass px-3 py-1.5 text-xs text-muted-foreground">Click Reveal to view</span>
              </div>
            )}
          </div>
          {revealed && (
            <button
              onClick={() => copy(wallet.mnemonic ?? "", "mnemonic")}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              {copied === "mnemonic" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "mnemonic" ? "Copied" : "Copy phrase"}
            </button>
          )}
        </div> : null}

        <p className="mt-4 text-xs text-muted-foreground flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-success mt-0.5" />
          {wallet.mnemonic
            ? "This phrase never leaves your device. PrimeCapital cannot recover it if lost."
            : "This wallet is signed in on this device. Re-import the seed phrase to reveal recovery words again."}
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Derived addresses</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {wallet.addresses.map((a) => (
            <div key={`${a.chain}-${a.path}`} className="glass rounded-xl p-4 hover:bg-white/[.04] transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.chain} · {a.standard}</p>
                </div>
                <button
                  onClick={() => copy(a.address, a.chain + a.path)}
                  className="rounded-md glass px-2 py-1.5 hover:bg-white/10"
                  aria-label="Copy address"
                >
                  {copied === a.chain + a.path ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-3 font-mono text-xs break-all text-muted-foreground">{a.address}</p>
              <p className="mt-2 text-[10px] font-mono text-muted-foreground/70">{a.path}</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Balance</span>
                <span className="font-mono text-sm">
                  {balances[a.chain] === "loading" || balances[a.chain] === undefined ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {(balances[a.chain] as Balance).amount.toFixed(6)}{" "}
                      <span className="text-muted-foreground">{(balances[a.chain] as Balance).symbol}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-md glass-strong rounded-2xl p-6 shadow-elev">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-white/10 text-muted-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UsernameForm({
  wallet,
  mode,
  onDone,
}: {
  wallet: HDWallet;
  mode: "create" | "import";
  onDone: (username: string) => void;
}) {
  const address = wallet.addresses.find((a) => a.chain === "ETH")?.address ?? wallet.addresses[0]?.address ?? "";
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await lookupProfileByAddress(address);
        if (cancelled) return;
        if (found) {
          setExisting(found.username);
          setUsername(found.username);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lookup failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const clean = username.trim();
    if (existing) {
      onDone(existing);
      return;
    }
    if (!/^[A-Za-z0-9_]{3,24}$/.test(clean)) {
      setErr("3–24 chars, letters/numbers/underscore only.");
      return;
    }
    setBusy(true);
    try {
      if (await isUsernameTaken(clean)) {
        setErr("That username is taken.");
        setBusy(false);
        return;
      }
      const row = await registerWalletProfile(address, clean);
      onDone(row.username);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to register username");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg glass p-3 text-xs text-muted-foreground">
        <p className="uppercase tracking-widest text-[10px] mb-1">Wallet address</p>
        <p className="font-mono break-all text-foreground/90">{address}</p>
      </div>

      {existing ? (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success-foreground/90 flex gap-2">
          <Check className="h-4 w-4 shrink-0 text-success mt-0.5" />
          <p>
            This wallet is already registered as{" "}
            <span className="font-semibold text-foreground">{existing}</span>. Continue to sign in.
          </p>
        </div>
      ) : (
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {mode === "create" ? "Pick a username" : "Register a username for this wallet"}
          </span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. satoshi_42"
            className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Public. Used to log in whenever this wallet is active.
          </span>
        </label>
      )}

      {err && <p className="text-xs text-destructive">{err}</p>}

      <button
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-brand)] py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {existing ? "Sign in" : "Register & sign in"}
      </button>
    </form>
  );
}
