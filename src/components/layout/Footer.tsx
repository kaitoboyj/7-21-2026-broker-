import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)]">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
            </span>
            <span className="font-display text-base font-semibold">Nova<span className="text-gradient">X</span></span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Institutional-grade crypto trading and self-custody, in one interface.
          </p>
        </div>
        <FooterCol title="Products" links={[
          ["Markets", "/markets"],
          ["Trade", "/trade"],
          ["Wallet", "/wallet"],
        ]} />
        <FooterCol title="Company" links={[["About", "/"], ["Careers", "/"], ["Press", "/"]]} />
        <FooterCol title="Resources" links={[["Docs", "/"], ["API", "/"], ["Status", "/"]]} />
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} NovaX Labs. Trading crypto carries risk.</p>
          <p>Prices via CoinGecko. Wallets generated locally in your browser.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="font-display text-sm font-semibold text-foreground mb-3">{title}</h4>
      <ul className="space-y-2">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
