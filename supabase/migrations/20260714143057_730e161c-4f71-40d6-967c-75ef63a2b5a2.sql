ALTER TABLE public.wallet_balance_overrides
  ADD COLUMN IF NOT EXISTS yield_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_balance_frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_live_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS mock_live_balance NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.wallet_balance_overrides.usd_balance IS 'Legacy total display override retained for older app code.';
COMMENT ON COLUMN public.wallet_balance_overrides.yield_balance IS 'Admin-set demo/yield balance shown separately from live wallet balance.';
COMMENT ON COLUMN public.wallet_balance_overrides.live_balance_frozen IS 'When true, the displayed live balance is locked to frozen_live_balance.';
COMMENT ON COLUMN public.wallet_balance_overrides.frozen_live_balance IS 'Locked live-balance USD value captured or entered by admin.';
COMMENT ON COLUMN public.wallet_balance_overrides.mock_live_balance IS 'Admin-entered USD amount added to the live wallet balance before optional freezing.';