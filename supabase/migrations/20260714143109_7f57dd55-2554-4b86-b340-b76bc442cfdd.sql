DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallet_balance_overrides'
      AND policyname = 'No direct client access to wallet balance overrides'
  ) THEN
    CREATE POLICY "No direct client access to wallet balance overrides"
    ON public.wallet_balance_overrides
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false);
  END IF;
END $$;