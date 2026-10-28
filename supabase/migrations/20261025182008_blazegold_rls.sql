/*
# BlazeGold RLS — policies, grants, admin RPCs (part 2)

App has a sign-in screen → all policies target `authenticated`.
- Profiles: everyone reads; a user inserts/updates only their own row,
  and only the user-editable columns (display_name, bio, avatar_url,
  country, status_text, online, last_seen). Admin columns (is_admin,
  is_verified, is_banned, is_muted, gold_coins) are NOT user-writable.
- Chats: members read/insert/update; owner deletes.
- Members: members of the chat read; self or admin/owner of chat insert/
  update/delete.
- Messages: chat members read/insert; sender updates/deletes own.
  Admin burn goes through the SECURITY DEFINER RPC `bg_admin_burn_message`.
- Receipts: sender + recipient see; recipient inserts/updates own.
- Status: anyone reads active; owner inserts/updates/deletes own.
- Status views: owner + viewer read; viewer inserts own.
- Broadcasts: anyone reads active (no user insert — admin RPC only).
- Reports: reporter inserts; (admin reads via service role).
- Coins ledger: owner reads.

Admin-only mutations are wrapped in SECURITY DEFINER functions that call
bg_is_admin(auth.uid()). EXECUTE revoked from PUBLIC/anon, granted to
authenticated. A trigger creates a bg_profiles row on new auth signup.
*/

-- ---------- bg_profiles ----------
ALTER TABLE bg_profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON bg_profiles TO authenticated;
GRANT UPDATE (display_name, bio, avatar_url, country, status_text, online, last_seen)
  ON bg_profiles TO authenticated;
GRANT INSERT (id, email, display_name, country, bio, avatar_url, status_text)
  ON bg_profiles TO authenticated;

DROP POLICY IF EXISTS "bg_profiles_select_all" ON bg_profiles;
CREATE POLICY "bg_profiles_select_all"
  ON bg_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bg_profiles_insert_self" ON bg_profiles;
CREATE POLICY "bg_profiles_insert_self"
  ON bg_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "bg_profiles_update_self" ON bg_profiles;
CREATE POLICY "bg_profiles_update_self"
  ON bg_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------- bg_chats ----------
ALTER TABLE bg_chats ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON bg_chats TO authenticated;

DROP POLICY IF EXISTS "bg_chats_select_member" ON bg_chats;
CREATE POLICY "bg_chats_select_member"
  ON bg_chats FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_chats.id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "bg_chats_insert_creator" ON bg_chats;
CREATE POLICY "bg_chats_insert_creator"
  ON bg_chats FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "bg_chats_update_member" ON bg_chats;
CREATE POLICY "bg_chats_update_member"
  ON bg_chats FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_chats.id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_chats.id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "bg_chats_delete_owner" ON bg_chats;
CREATE POLICY "bg_chats_delete_owner"
  ON bg_chats FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ---------- bg_chat_members ----------
ALTER TABLE bg_chat_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON bg_chat_members TO authenticated;

DROP POLICY IF EXISTS "bg_members_select_member" ON bg_chat_members;
CREATE POLICY "bg_members_select_member"
  ON bg_chat_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bg_chat_members m2 WHERE m2.chat_id = bg_chat_members.chat_id AND m2.user_id = auth.uid()));

DROP POLICY IF EXISTS "bg_members_insert_member" ON bg_chat_members;
CREATE POLICY "bg_members_insert_member"
  ON bg_chat_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_chat_members.chat_id AND m.user_id = auth.uid() AND m.role in ('admin','owner'))
  );

DROP POLICY IF EXISTS "bg_members_update_self_or_admin" ON bg_chat_members;
CREATE POLICY "bg_members_update_self_or_admin"
  ON bg_chat_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_chat_members.chat_id AND m.user_id = auth.uid() AND m.role in ('admin','owner')))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_chat_members.chat_id AND m.user_id = auth.uid() AND m.role in ('admin','owner')));

DROP POLICY IF EXISTS "bg_members_delete_self_or_admin" ON bg_chat_members;
CREATE POLICY "bg_members_delete_self_or_admin"
  ON bg_chat_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_chat_members.chat_id AND m.user_id = auth.uid() AND m.role in ('admin','owner')));

-- ---------- bg_messages ----------
ALTER TABLE bg_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON bg_messages TO authenticated;

DROP POLICY IF EXISTS "bg_messages_select_member" ON bg_messages;
CREATE POLICY "bg_messages_select_member"
  ON bg_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_messages.chat_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "bg_messages_insert_member" ON bg_messages;
CREATE POLICY "bg_messages_insert_member"
  ON bg_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM bg_chat_members m WHERE m.chat_id = bg_messages.chat_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "bg_messages_update_sender" ON bg_messages;
CREATE POLICY "bg_messages_update_sender"
  ON bg_messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "bg_messages_delete_sender" ON bg_messages;
CREATE POLICY "bg_messages_delete_sender"
  ON bg_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- ---------- bg_message_receipts ----------
ALTER TABLE bg_message_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON bg_message_receipts TO authenticated;

DROP POLICY IF EXISTS "bg_receipts_select_party" ON bg_message_receipts;
CREATE POLICY "bg_receipts_select_party"
  ON bg_message_receipts FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM bg_messages m WHERE m.id = bg_message_receipts.message_id AND m.sender_id = auth.uid())
  );

DROP POLICY IF EXISTS "bg_receipts_insert_recipient" ON bg_message_receipts;
CREATE POLICY "bg_receipts_insert_recipient"
  ON bg_message_receipts FOR INSERT TO authenticated
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "bg_receipts_update_recipient" ON bg_message_receipts;
CREATE POLICY "bg_receipts_update_recipient"
  ON bg_message_receipts FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ---------- bg_status ----------
ALTER TABLE bg_status ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON bg_status TO authenticated;

DROP POLICY IF EXISTS "bg_status_select_active" ON bg_status;
CREATE POLICY "bg_status_select_active"
  ON bg_status FOR SELECT TO authenticated
  USING (expires_at > now());

DROP POLICY IF EXISTS "bg_status_insert_own" ON bg_status;
CREATE POLICY "bg_status_insert_own"
  ON bg_status FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bg_status_update_own" ON bg_status;
CREATE POLICY "bg_status_update_own"
  ON bg_status FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bg_status_delete_own" ON bg_status;
CREATE POLICY "bg_status_delete_own"
  ON bg_status FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------- bg_status_views ----------
ALTER TABLE bg_status_views ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON bg_status_views TO authenticated;

DROP POLICY IF EXISTS "bg_status_views_select_owner" ON bg_status_views;
CREATE POLICY "bg_status_views_select_owner"
  ON bg_status_views FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM bg_status s WHERE s.id = bg_status_views.status_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "bg_status_views_insert_viewer" ON bg_status_views;
CREATE POLICY "bg_status_views_insert_viewer"
  ON bg_status_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- ---------- bg_broadcasts ----------
ALTER TABLE bg_broadcasts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON bg_broadcasts TO authenticated;

DROP POLICY IF EXISTS "bg_broadcasts_select_active" ON bg_broadcasts;
CREATE POLICY "bg_broadcasts_select_active"
  ON bg_broadcasts FOR SELECT TO authenticated
  USING (expires_at > now() OR expires_at IS NULL);

-- ---------- bg_reports ----------
ALTER TABLE bg_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON bg_reports TO authenticated;

DROP POLICY IF EXISTS "bg_reports_insert_reporter" ON bg_reports;
CREATE POLICY "bg_reports_insert_reporter"
  ON bg_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- ---------- bg_coins_ledger ----------
ALTER TABLE bg_coins_ledger ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON bg_coins_ledger TO authenticated;

DROP POLICY IF EXISTS "bg_coins_select_own" ON bg_coins_ledger;
CREATE POLICY "bg_coins_select_own"
  ON bg_coins_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------- Admin helper + RPC functions ----------
CREATE OR REPLACE FUNCTION bg_is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM bg_profiles WHERE id = uid), false);
$$;
REVOKE EXECUTE ON FUNCTION bg_is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_is_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION bg_admin_burn_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM bg_messages WHERE id = p_message_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_burn_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_burn_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION bg_admin_set_ban(p_user_id uuid, p_banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE bg_profiles SET is_banned = p_banned WHERE id = p_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_set_ban(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_set_ban(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION bg_admin_set_mute(p_user_id uuid, p_muted boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE bg_profiles SET is_muted = p_muted WHERE id = p_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_set_mute(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_set_mute(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION bg_admin_set_verified(p_user_id uuid, p_verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE bg_profiles SET is_verified = p_verified WHERE id = p_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_set_verified(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_set_verified(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION bg_grant_coins(p_user_id uuid, p_amount integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE bg_profiles SET gold_coins = gold_coins + p_amount WHERE id = p_user_id;
  INSERT INTO bg_coins_ledger (user_id, amount, reason) VALUES (p_user_id, p_amount, p_reason);
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_grant_coins(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_grant_coins(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION bg_admin_broadcast(p_message text, p_type text, p_hours integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO bg_broadcasts (message, type, created_by, expires_at)
  VALUES (p_message, p_type, auth.uid(), now() + (p_hours || ' hours')::interval)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_broadcast(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_broadcast(text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION bg_admin_sponsored_status(p_type text, p_text text, p_sponsor text, p_bg text, p_hours integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO bg_status (user_id, type, text, bg_color, is_sponsored, sponsor_name, expires_at)
  VALUES (auth.uid(), p_type, p_text, p_bg, true, p_sponsor, now() + (p_hours || ' hours')::interval)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_sponsored_status(text, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_sponsored_status(text, text, text, text, integer) TO authenticated;

-- ---------- new-user trigger ----------
CREATE OR REPLACE FUNCTION bg_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO bg_profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Gold User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bg_on_auth_user_created ON auth.users;
CREATE TRIGGER bg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION bg_handle_new_user();
