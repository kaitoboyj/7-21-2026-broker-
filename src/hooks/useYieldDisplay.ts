import { useEffect, useState } from "react";

const MIN_DELAY_MS = 4_000;
const MAX_DELAY_MS = 10 * 60_000;
const MAX_MOVE_PCT = 7;

function randomMovePct() {
  const direction = Math.random() < 0.5 ? -1 : 1;
  return direction * Math.random() * MAX_MOVE_PCT;
}

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export function useYieldDisplay(baseValue: number) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    setPct(0);
    if (!Number.isFinite(baseValue) || baseValue <= 0) return;

    let timer: number | undefined;
    const tick = () => {
      setPct(randomMovePct());
      timer = window.setTimeout(tick, randomDelay());
    };

    timer = window.setTimeout(tick, randomDelay());
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [baseValue]);

  const value = Math.max(0, baseValue * (1 + pct / 100));
  return { value, pct };
}