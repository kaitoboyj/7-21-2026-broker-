import {
  lookupProfileByAddressFn,
  isUsernameTakenFn,
  recordWalletLoginFn,
  registerWalletProfileFn,
} from "@/lib/wallet-profile.functions";

// The canonical wallet identifier is the derived Ethereum address (first EVM entry).
export function walletAddressFor(addresses: { chain: string; address: string }[]): string {
  const eth = addresses.find((a) => a.chain === "ETH") ?? addresses[0];
  return eth?.address ?? "";
}

export interface WalletProfileRow {
  wallet_address: string;
  username: string;
}

export async function lookupProfileByAddress(address: string): Promise<WalletProfileRow | null> {
  const { profile } = await lookupProfileByAddressFn({ data: { wallet_address: address } });
  return profile ?? null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const { taken } = await isUsernameTakenFn({ data: { username } });
  return taken;
}

export async function registerWalletProfile(address: string, username: string, signature: string): Promise<WalletProfileRow> {
  const { profile } = await registerWalletProfileFn({ data: { wallet_address: address, username, signature } });
  return profile;
}

export async function recordWalletLogin(
  address: string,
  event: "create" | "import" | "signin",
  signature: string,
  username?: string,
) {
  try {
    await recordWalletLoginFn({ data: {
      wallet_address: address,
      username: username ?? undefined,
      event,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
      signature,
    } });
  } catch {
    /* best-effort logging */
  }
}

// --- Active-session persistence (client-only, wallet-based "login") ---

const SESSION_KEY = "prime:session:v1";

export interface WalletSession {
  address: string;
  username: string;
  wallet?: WalletSnapshot;
}

export interface WalletSnapshot {
  id: string;
  label: string;
  createdAt: number;
  mnemonic?: string;
  addresses: Array<{
    chain: string;
    name: string;
    path: string;
    address: string;
    standard: "BIP84" | "BIP44";
  }>;
}

export function loadSession(): WalletSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as WalletSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: WalletSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("prime:session-change"));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("prime:session-change"));
}
