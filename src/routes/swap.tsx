import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Wallet } from "lucide-react";
import { useWalletSession } from "@/hooks/useWalletSession";
import { getPrivateKey } from "@/lib/wallet-signer";
import { SwapWidget } from "@/components/SwapWidget";

export const Route = createFileRoute("/swap")({
  head: () => ({
    meta: [
      { title: "Swap — PrimeCapital Cross-Chain" },
      { name: "description", content: "Bridge and swap tokens across chains directly from your self-custody wallet, powered by thirdweb Bridge." },
      { property: "og:title", content: "Cross-chain swap · PrimeCapital" },
      { property: "og:description", content: "Real on-chain cross-chain swaps from your imported or generated wallet." },
    ],
  }),
  component: SwapPage,
});

function SwapPage() {
  const session = useWalletSession();
  const [pk, setPk] = useState<string | null | undefined>(undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener("prime:signer-change", refresh);
    return () => window.removeEventListener("prime:signer-change", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session?.address) {
      setPk(null);
      return;
    }

    setPk(undefined);
    const started = Date.now();
    const refresh = () => {
      const key = getPrivateKey(session.address);
      if (cancelled) return;
      if (key) {
        setPk(key);
        return;
      }
      if (Date.now() - started < 2500) {
        window.setTimeout(refresh, 250);
      } else {
        setPk(null);
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [session?.address, tick]);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-primary/90 font-medium">Cross-Chain</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold flex items-center gap-3">
          <ArrowLeftRight className="h-7 w-7 text-primary" /> Swap
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Bridge and swap tokens across EVM chains directly from your wallet. Transactions
          are signed locally by your imported or generated wallet — funds move on-chain
          from your real address.
        </p>
      </div>

      {!session ? (
        <NeedsWallet reason="signin" />
      ) : pk === undefined ? (
        <div className="glass rounded-xl p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          Loading wallet signer…
        </div>
      ) : !pk ? (
        <NeedsWallet reason="rehydrate" />
      ) : (
        <SwapWidget privateKey={pk} address={session.address} />
      )}
    </div>
  );
}

function NeedsWallet({ reason }: { reason: "signin" | "rehydrate" }) {
  return (
    <div className="glass-strong rounded-2xl p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] shadow-glow">
        <Wallet className="h-6 w-6 text-primary-foreground" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold">
        {reason === "signin" ? "Sign in with a wallet" : "Unlock your wallet"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {reason === "signin"
          ? "Create or import a wallet to enable cross-chain swaps."
          : "Your session is active but the signing key is not loaded in this tab. Re-open your wallet to unlock swapping."}
      </p>
      <Link
        to="/wallet"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-brand)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
      >
        Go to Wallet
      </Link>
    </div>
  );
}
