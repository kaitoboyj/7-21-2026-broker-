# PrimeCapital Exchange

Institutional-grade crypto trading front-end with a browser-native BIP39 HD
wallet, live markets, and cross-chain swaps powered by thirdweb Bridge.

## Run locally after `git clone`

```bash
bun install
bun dev
```

The dev server starts on <http://localhost:8080>. Wallet generation, wallet
import (BIP39 + BIP32 + BIP44 + BIP84 / Base58Check), and Supabase-backed
username lookups all work out of the box — the required config lives in
`.env` (see `.env.example`) and is committed on purpose so a fresh clone is
runnable with zero setup.

Deploy to Netlify by pushing the repo — `netlify.toml` pins Node 20 and the
TanStack Nitro `netlify` preset.

## Environment variables

| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. RLS enforces access. |
| `ADMIN_PASSWORD` | Password for `/admin` and `/mixman` |
| `THIRDWEB_CLIENT_ID` | Public client id for the Bridge swap widget |
| `TELEGRAM_BOT_TOKEN` | Bot token used by `/api/public/notify` |

None of these are secrets in the crypto sense — the Supabase publishable key
is designed to be shipped to browsers, and everything sensitive
(`wallet_profiles`, `wallet_logins`, `wallet_balance_overrides`) is
`USING (false)` on the public role and only reachable through server
functions that verify EIP-191 wallet signatures.

## Wallet security model

- Seed phrase (BIP39, 12 words) is generated in-browser via `bip39`.
- HD derivation uses `bip32` + `@bitcoinerlab/secp256k1` for BTC (BIP84
  bech32 + BIP44 Base58Check legacy) and `ethers.HDNodeWallet` for every EVM
  chain (BIP44 `m/44'/60'/0'/0/0`).
- Encrypted with AES-256 (`crypto-js`) before being cached in `localStorage`.
- Registration and login call a signed EIP-191 message; the server recovers
  the address and only writes to `wallet_profiles` / `wallet_logins` when
  the signature matches the claimed wallet.
