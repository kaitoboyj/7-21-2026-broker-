// Client-only HD wallet utilities.
// BIP39 mnemonic -> BIP32 HD -> BIP44/BIP84 derivation.
// EVM chains share the same address; BTC uses BIP84 native segwit (bech32).
// AES-encrypted local storage via crypto-js.

// Ensure Buffer is available globally for bitcoinjs-lib when the browser polyfill provides it.
import { Buffer as PolyfillBuffer } from "buffer";
if (typeof globalThis !== "undefined" && !(globalThis as any).Buffer && PolyfillBuffer) {
  (globalThis as any).Buffer = PolyfillBuffer;
}

import * as bip39 from "bip39";
import * as bitcoin from "bitcoinjs-lib";
import { BIP32Factory } from "bip32";
import ecc from "@bitcoinerlab/secp256k1";
import { HDNodeWallet } from "ethers";
import CryptoJS from "crypto-js";

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

export type ChainKey = "BTC" | "BTC_LEGACY" | "ETH" | "BNB" | "MATIC" | "ARB" | "OP" | "AVAX";

export interface ChainAddress {
  chain: ChainKey;
  name: string;
  path: string;
  address: string;
  standard: "BIP84" | "BIP44";
}

export interface HDWallet {
  id: string;
  label: string;
  createdAt: number;
  mnemonic: string; // stored plaintext ONLY in-memory; persisted encrypted
  addresses: ChainAddress[];
}

const CHAINS: { key: ChainKey; name: string; slip44: number }[] = [
  { key: "ETH", name: "Ethereum", slip44: 60 },
  { key: "BNB", name: "BNB Chain", slip44: 60 },
  { key: "MATIC", name: "Polygon", slip44: 60 },
  { key: "ARB", name: "Arbitrum", slip44: 60 },
  { key: "OP", name: "Optimism", slip44: 60 },
  { key: "AVAX", name: "Avalanche C", slip44: 60 },
];

function pubkeyBytes(pubkey: Uint8Array): Uint8Array {
  const BufferCtor = typeof globalThis !== "undefined" ? (globalThis as any).Buffer : undefined;
  return BufferCtor?.from ? BufferCtor.from(pubkey) : Uint8Array.from(pubkey);
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `wallet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39.generateMnemonic(strength);
}

export function validateMnemonic(m: string): boolean {
  return bip39.validateMnemonic(m.trim());
}

export function deriveAddresses(mnemonic: string): ChainAddress[] {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const results: ChainAddress[] = [];

  // BTC — BIP84 native segwit m/84'/0'/0'/0/0
  const root = bip32.fromSeed(seed);
  const btcNode = root.derivePath("m/84'/0'/0'/0/0");
  const { address: btcAddr } = bitcoin.payments.p2wpkh({
    pubkey: pubkeyBytes(btcNode.publicKey),
    network: bitcoin.networks.bitcoin,
  });
  results.push({
    chain: "BTC",
    name: "Bitcoin",
    path: "m/84'/0'/0'/0/0",
    address: btcAddr ?? "",
    standard: "BIP84",
  });

  // BTC legacy — BIP44 Base58Check P2PKH m/44'/0'/0'/0/0
  const btcLegacyNode = root.derivePath("m/44'/0'/0'/0/0");
  const { address: btcLegacyAddr } = bitcoin.payments.p2pkh({
    pubkey: pubkeyBytes(btcLegacyNode.publicKey),
    network: bitcoin.networks.bitcoin,
  });
  results.push({
    chain: "BTC_LEGACY",
    name: "Bitcoin Legacy",
    path: "m/44'/0'/0'/0/0",
    address: btcLegacyAddr ?? "",
    standard: "BIP44",
  });

  // EVM — BIP44 m/44'/60'/0'/0/0 (single address covers all EVM chains)
  const evm = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0");
  for (const c of CHAINS) {
    results.push({
      chain: c.key,
      name: c.name,
      path: "m/44'/60'/0'/0/0",
      address: evm.address,
      standard: "BIP44",
    });
  }
  return results;
}

export function createWallet(label = "Main Wallet"): HDWallet {
  const mnemonic = generateMnemonic();
  return {
    id: randomId(),
    label,
    createdAt: Date.now(),
    mnemonic,
    addresses: deriveAddresses(mnemonic),
  };
}

export function importFromMnemonic(mnemonic: string, label = "Imported Wallet"): HDWallet {
  const trimmed = mnemonic.trim().toLowerCase().split(/\s+/).join(" ");
  if (!validateMnemonic(trimmed)) throw new Error("Invalid BIP39 mnemonic");
  return {
    id: randomId(),
    label,
    createdAt: Date.now(),
    mnemonic: trimmed,
    addresses: deriveAddresses(trimmed),
  };
}

// ---- Encrypted local storage -------------------------------------------------

const STORAGE_KEY = "prime:wallets:v1";

interface StoredWallet {
  id: string;
  label: string;
  createdAt: number;
  cipher: string; // AES(mnemonic)
  addresses: ChainAddress[];
}

export function saveWallets(wallets: HDWallet[], passphrase: string) {
  const stored: StoredWallet[] = wallets.map((w) => ({
    id: w.id,
    label: w.label,
    createdAt: w.createdAt,
    cipher: CryptoJS.AES.encrypt(w.mnemonic, passphrase).toString(),
    addresses: w.addresses,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function loadEncryptedWallets(): StoredWallet[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredWallet[];
  } catch {
    return [];
  }
}

export function decryptWallet(stored: StoredWallet, passphrase: string): HDWallet {
  const bytes = CryptoJS.AES.decrypt(stored.cipher, passphrase);
  const mnemonic = bytes.toString(CryptoJS.enc.Utf8);
  if (!mnemonic || !validateMnemonic(mnemonic)) {
    throw new Error("Wrong passphrase");
  }
  return {
    id: stored.id,
    label: stored.label,
    createdAt: stored.createdAt,
    mnemonic,
    addresses: stored.addresses,
  };
}

export function clearAllWallets() {
  localStorage.removeItem(STORAGE_KEY);
}
