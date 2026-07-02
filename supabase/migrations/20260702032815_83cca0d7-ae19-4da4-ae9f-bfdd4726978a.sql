
CREATE TABLE public.wallet_balance_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  usd_balance NUMERIC,
  token_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.wallet_balance_overrides TO service_role;

ALTER TABLE public.wallet_balance_overrides ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: only service_role (used by admin server fns) can touch this table.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_wallet_balance_overrides_updated_at
BEFORE UPDATE ON public.wallet_balance_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
