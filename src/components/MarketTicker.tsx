import { useQuery } from "@tanstack/react-query";
import { marketsQuery, formatUSD, formatPct } from "@/lib/prices";
import { cn } from "@/lib/utils";

export function MarketTicker() {
  const { data } = useQuery(marketsQuery(20));
  const coins = data ?? [];
  if (coins.length === 0) return <div className="h-10" />;
  const loop = [...coins, ...coins];
  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-black/20">
      <div className="animate-ticker flex gap-8 whitespace-nowrap py-2.5">
        {loop.map((c, i) => {
          const up = (c.price_change_percentage_24h ?? 0) >= 0;
          return (
            <div key={`${c.id}-${i}`} className="flex items-center gap-2 text-sm">
              <img src={c.image} alt="" className="h-4 w-4 rounded-full" />
              <span className="font-medium">{c.symbol.toUpperCase()}</span>
              <span className="text-muted-foreground">{formatUSD(c.current_price)}</span>
              <span className={cn("font-mono text-xs", up ? "text-success" : "text-destructive")}>
                {formatPct(c.price_change_percentage_24h)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
