
DROP POLICY IF EXISTS "Anyone can read wallet profiles" ON public.wallet_profiles;
DROP POLICY IF EXISTS "No direct read of wallet profiles" ON public.wallet_profiles;
CREATE POLICY "No direct read of wallet profiles" ON public.wallet_profiles FOR SELECT USING (false);

DROP POLICY IF EXISTS "No direct read of wallet logins" ON public.wallet_logins;
CREATE POLICY "No direct read of wallet logins" ON public.wallet_logins FOR SELECT USING (false);
