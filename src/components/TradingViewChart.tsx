import { useEffect, useRef } from "react";

interface Props {
  symbol?: string; // e.g. "BINANCE:BTCUSDT"
  interval?: string; // "60" | "D" | ...
  theme?: "dark" | "light";
  height?: number | string;
}

// Loads TradingView Advanced Chart via their embed script (client-only).
export function TradingViewChart({
  symbol = "BINANCE:BTCUSDT",
  interval = "60",
  theme = "dark",
  height = 520,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    el.innerHTML = `<div id="${containerId.current}" style="height:100%"></div>`;

    const load = () =>
      new (window as any).TradingView.widget({
        autosize: true,
        symbol,
        interval,
        timezone: "Etc/UTC",
        theme,
        style: "1",
        locale: "en",
        toolbar_bg: "rgba(0,0,0,0)",
        hide_side_toolbar: false,
        withdateranges: true,
        allow_symbol_change: true,
        studies: ["MASimple@tv-basicstudies", "Volume@tv-basicstudies"],
        container_id: containerId.current,
      });

    if ((window as any).TradingView) {
      load();
    } else {
      const s = document.createElement("script");
      s.src = "https://s3.tradingview.com/tv.js";
      s.async = true;
      s.onload = load;
      document.head.appendChild(s);
    }
  }, [symbol, interval, theme]);

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-xl border border-white/10"
      style={{ height }}
    />
  );
}
