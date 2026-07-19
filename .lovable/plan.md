## What "Cannot read properties of undefined (reading 'from')" means

It's the Buffer polyfill race. `bip32.fromSeed(...)` (and `bitcoinjs-lib` internals) call `Buffer.from(...)`. In the browser, `Buffer` isn't a global — we polyfill it from the `buffer` npm package. If any crypto library module evaluates *before* the polyfill lands on `globalThis`, `Buffer` is `undefined` and `Buffer.from(...)` throws exactly that error. Today we already install it in `src/router.tsx` and again inside `src/lib/hdwallet.ts`, but under some load orders (HMR, code-split chunks, `/swap` route pulling `ethers` first) a dependency still resolves `Buffer` before our shim runs.

## Goals

1. Kill the Buffer race for good — wallet generate/import never throws again.
2. Make the repo runnable from a fresh `git clone` with `bun install && bun dev` — Supabase, logo, Telegram, Thirdweb all work with zero extra setup.
3. Show the connected wallet's mnemonic on `/wallet`, hidden by default, with a copy button.
4. Add a cumulative-yield % display next to the existing tick % on the Yield card.

## Plan

### 1. Fix Buffer / BIP39 / Base58 permanently

- Add a Vite-level shim so `Buffer` is a true global before any user or vendor module runs:
  - In `vite.config.ts`, add `define: { global: 'globalThis' }` and use `vite-plugin-node-polyfills` (or an explicit `optimizeDeps.esbuildOptions.inject`) to inject a `buffer` shim into every client bundle.
  - Add `resolve.alias` so `buffer` always resolves to the browser build.
- Simplify `src/lib/hdwallet.ts`: go back to normal static `import` statements now that the shim is guaranteed. Remove the `await import()` dance (which was itself a source of ordering fragility) and the defensive `ensureBuffer` retries.
- Keep `src/lib/buffer-polyfill.ts` as a belt-and-braces first import in `src/router.tsx` and `src/start.ts`.
- Verify at build-time with a Playwright script that:
  - `/wallet` → Generate produces 12 words, a valid BIP84 bech32 address (`bc1…`), a valid BIP44 Base58Check legacy address (`1…`), and an EVM `0x…` address.
  - Import of a known test mnemonic yields the same well-known addresses.
  - `/swap` loads without touching wallet derivation before the shim.

### 2. Make the repo standalone (clone-and-run)

- Keep `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `THIRDWEB_CLIENT_ID`, `ADMIN_PASSWORD`, and `TELEGRAM_BOT_TOKEN` in `.env` (they're already there) and document them in a new `README.md` "Run locally" section. These are the publishable/anon key + a shared bot token the user has explicitly chosen to commit — no service_role key.      
- Add `.env.example` mirroring `.env` so contributors see the required vars.
- Fix client code so it doesn't require server-only secrets at runtime for the wallet flow:
  - `src/routes/api/public/notify.ts` already reads `process.env.TELEGRAM_BOT_TOKEN`; keep the `.env` value as the source of truth for local dev and Netlify.
  - `src/routes/api/public/thirdweb-config.ts` returns `THIRDWEB_CLIENT_ID` from `process.env` — same treatment.
- Confirm `netlify.toml` maps the same env vars so a Netlify deploy of a fresh clone Just Works.
- Logo: `src/assets/primecapital-logo.png` is externalized via `.asset.json` → Lovable CDN. On a clone that's fine (URL is absolute), but we'll add a local fallback copy in `public/logo.png` and reference it from the favicon link + as an `onError` fallback in `Navbar` so the logo still renders if the CDN pointer is ever unreachable. also i want you to add superbase service role key to teh .env if necessary 

### 3. Show wallet phrase on /wallet

- On `/wallet`, for the active session's wallet, add a "Recovery phrase" card:
  - Blurred by default with a "Reveal" toggle.
  - Copy-to-clipboard button using the existing `CopyButton` component.
  - Shows the 12/24-word mnemonic from the currently-unlocked HD wallet (already decrypted in memory when the wallet is active).
  - Warning text: "Anyone with this phrase controls the wallet."

### 4. Cumulative yield % on the dashboard

- Extend `useYieldDisplay` to also return `totalPct` = `((value + yieldValue) / initial - 1) * 100`, i.e. gain of `initial + yield` vs `initial`.
- In the Yield section on the home/dashboard, render a second badge next to the fluctuating `+0.00%`, labeled "Total", showing `totalPct` formatted like `+0.70%` (green if ≥0, red if <0). No change to the live tick behavior.

### 5. Verification

- Run the Playwright test suite for `/wallet` (generate + import a known mnemonic → assert BIP84 + BIP44 addresses byte-for-byte), plus a screenshot of the dashboard yield card showing both percentages.

## Technical notes

- `vite-plugin-node-polyfills` with `{ include: ['buffer', 'process'], globals: { Buffer: true, process: true } }` injects a real `Buffer` global before any chunk executes, which is what fixes the ordering bug definitively.
- No DB migration is needed. No new secrets requested.
- No changes to Supabase RLS/policies — they're already deny-all with server-fn access.
- Committing `TELEGRAM_BOT_TOKEN` and `ADMIN_PASSWORD` to `.env` in the repo is a deliberate tradeoff the user has asked for so that clones work without setup. I'll flag this in the README so it's not surprising later.