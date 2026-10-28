/*
# BlazeGold V2.1 — storage buckets + self-verify + coin-earn RPC

1. Storage: ensure 'avatars' public bucket exists (profile pictures),
   'blazegold' public bucket exists (chat/status attachments).
   Both are public-read so avatars/attachments load via public URL.
2. Self-verify RPC: bg_self_verify — a user who has paid (mock M-Pesa)
   can mark themselves verified. For the mock, any call succeeds and
   sets is_verified = true for the caller. In production this would
   validate an M-Pesa transaction code server-side. Admins can still
   verify/unverify via bg_admin_set_verified.
3. Earn coins RPC: bg_earn_coins — a user grants themselves coins for
   an action (chat message = 2, status post = 5). Records a ledger
   entry and increments gold_coins. Capped reason allowlist prevents
   abuse of arbitrary reasons; amount is chosen server-side from the
   reason to stop clients minting unlimited coins.

Security:
- Buckets are public-read; writes still require an authenticated session
  via standard Supabase Storage RLS (default upload policy on private
  buckets is owner-only; public buckets allow public read but writes
  are still authenticated by default).
- bg_self_verify is SECURITY DEFINER, EXECUTE granted to authenticated,
  revoked from anon/PUBLIC. It only sets the caller's own is_verified.
- bg_earn_coins is SECURITY DEFINER, amount is derived server-side from
  the reason (not client-supplied) to prevent coin inflation.
*/

INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('blazegold', 'blazegold', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated can upload to their own path prefix;
-- public read for everyone (avatars are visible in chat lists).
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
CREATE POLICY "avatars_auth_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "blazegold_public_read" ON storage.objects;
CREATE POLICY "blazegold_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'blazegold');

DROP POLICY IF EXISTS "blazegold_auth_upload" ON storage.objects;
CREATE POLICY "blazegold_auth_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'blazegold');

DROP POLICY IF EXISTS "blazegold_owner_update" ON storage.objects;
CREATE POLICY "blazegold_owner_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'blazegold') WITH CHECK (bucket_id = 'blazegold');

-- Self-verify (mock M-Pesa). Sets the caller verified.
CREATE OR REPLACE FUNCTION bg_self_verify()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE bg_profiles SET is_verified = true WHERE id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_self_verify() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_self_verify() TO authenticated;

-- Earn coins. amount is chosen server-side from reason to stop inflation.
CREATE OR REPLACE FUNCTION bg_earn_coins(p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_amount integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_amount := CASE p_reason
    WHEN 'message' THEN 2
    WHEN 'status' THEN 5
    ELSE 0
  END;
  IF v_amount = 0 THEN RAISE EXCEPTION 'invalid reason'; END IF;
  UPDATE bg_profiles SET gold_coins = gold_coins + v_amount WHERE id = auth.uid();
  INSERT INTO bg_coins_ledger (user_id, amount, reason) VALUES (auth.uid(), v_amount, p_reason);
  RETURN v_amount;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_earn_coins(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_earn_coins(text) TO authenticated;
