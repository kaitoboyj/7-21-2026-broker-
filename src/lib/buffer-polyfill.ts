// Ensure global Buffer is installed BEFORE any crypto lib (bip39, bitcoinjs-lib,
// bip32) evaluates its module body. ES imports are hoisted, so this polyfill
// must live in its own module and be imported first.
import { Buffer as PolyfillBuffer } from "buffer";

const g = globalThis as any;
if (!g.Buffer || typeof g.Buffer.from !== "function") g.Buffer = PolyfillBuffer;
if (typeof window !== "undefined") {
  const w = window as any;
  if (!w.Buffer || typeof w.Buffer.from !== "function") w.Buffer = PolyfillBuffer;
}

export {};
