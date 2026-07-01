import { useEffect, useState } from "react";
import { loadSession, type WalletSession } from "@/lib/wallet-auth";

export function useWalletSession(): WalletSession | null {
  const [session, setSession] = useState<WalletSession | null>(null);

  useEffect(() => {
    setSession(loadSession());
    const handler = () => setSession(loadSession());
    window.addEventListener("prime:session-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("prime:session-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return session;
}