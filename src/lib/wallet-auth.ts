import { supabase } from "@/integrations/supabase/client";

// The canonical wallet identifier is the derived Ethereum address (first EVM entry).
// It's unique per BIP39 seed and keeps things simple across chains.
export function walletAddressFor(addresses: { chain: string; address: string }[]): string {
  const eth = addresses.find((a) => a.chain === "ETH") ?? addresses[0];
  return eth?.address ?? "";
}

export interface WalletProfileRow {
  wallet_address: string;
  username: string;
}

export async function lookupProfileByAddress(address: string): Promise<WalletProfileRow | null> {
  const { data, error } = await supabase
    .from("wallet_profiles")
    .select("wallet_address, username")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("wallet_profiles")
    .select("username")
    .ilike("username", username)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function registerWalletProfile(address: string, username: string): Promise<WalletProfileRow> {
  const { data, error } = await supabase
    .from("wallet_profiles")
    .insert({ wallet_address: address, username })
    .select("wallet_address, username")
    .single();
  if (error) throw error;
  return data;
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