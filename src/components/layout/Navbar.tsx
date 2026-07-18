import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, User, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/hooks/useWalletSession";
import { clearSession } from "@/lib/wallet-auth";
import { forgetPrivateKey } from "@/lib/wallet-signer";
import logoAsset from "@/assets/primecapital-logo.png.asset.json";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/markets", label: "Markets" },
  { to: "/trade", label: "Trade" },
  { to: "/swap", label: "Swap" },
  { to: "/wallet", label: "Wallet" },
  { to: "/news", label: "News" },
  { to: "/how-it-works", label: "How it works" },
] as const;

export function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const session = useWalletSession();

  const signOut = () => {
    if (session?.address) forgetPrivateKey(session.address);
    clearSession();
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="glass border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src={logoAsset.url}
              alt="PrimeCapital"
              className="h-9 w-9 rounded-lg object-contain shadow-glow"
            />
            <span className="font-display text-lg font-semibold tracking-tight">
              Prime<span className="text-gradient">Capital</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-md bg-white/5 ring-1 ring-white/10" aria-hidden />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {session ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-md glass px-3 py-2 text-sm font-medium">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground">{session.username}</span>
                </span>
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </>
            ) : (
              <Link
                to="/wallet"
                className="rounded-md bg-[image:var(--gradient-brand)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition"
              >
                Get started
              </Link>

            )}
          </div>

          <button
            className="md:hidden rounded-md p-2 text-foreground/80 hover:bg-white/5"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden glass border-b border-white/5">
          <nav className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
            {session ? (
              <button
                onClick={signOut}
                className="mt-2 rounded-md bg-[image:var(--gradient-brand)] px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/wallet"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-md bg-[image:var(--gradient-brand)] px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
              >
                Get started
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
