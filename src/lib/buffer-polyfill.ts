// Ensure global Buffer is installed BEFORE any crypto lib (bip39, bitcoinjs-lib,
// bip32) evaluates its module body. ES imports are hoisted, so this polyfill
// must live in its own module and be imported first.
//
// CRITICAL: We use a synchronous require-style approach AND a static import
// to maximise the chance that Buffer is defined before downstream libs run.

import { Buffer as PolyfillBuffer } from "buffer";

// Force-assign on every surface that any lib might check
(globalThis as any).Buffer = PolyfillBuffer;

if (typeof window !== "undefined") {
  (window as any).Buffer = PolyfillBuffer;
}

if (typeof self !== "undefined") {
  (self as any).Buffer = PolyfillBuffer;
}

export { PolyfillBuffer as Buffer };
