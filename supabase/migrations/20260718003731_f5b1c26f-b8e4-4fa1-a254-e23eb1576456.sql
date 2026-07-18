DROP POLICY IF EXISTS "Anyone can record a wallet login" ON public.wallet_logins;
DROP POLICY IF EXISTS "Register a wallet profile with a valid address" ON public.wallet_profiles;
DROP POLICY IF EXISTS "No direct client writes to wallet logins" ON public.wallet_logins;
DROP POLICY IF EXISTS "No direct client writes to wallet profiles" ON public.wallet_profiles;

REVOKE INSERT, UPDATE, DELETE ON public.wallet_logins FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_profiles FROM anon, authenticated;
GRANT ALL ON public.wallet_logins TO service_role;
GRANT ALL ON public.wallet_profiles TO service_role;

CREATE POLICY "No direct client writes to wallet logins"
ON public.wallet_logins
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "No direct client writes to wallet profiles"
ON public.wallet_profiles
FOR INSERT
TO anon, authenticated
WITH CHECK (false);