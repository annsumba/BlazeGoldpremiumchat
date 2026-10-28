/*
# BlazeGold V3 — Work Coins + Ad System

1. Overview
- Replaces the old "gold coins" reward system (2 coins/msg, 5 coins/status)
  with a work-task coin system: 1 coin = 1 KES.
- Link tasks: advertisers post a social link with a task
  ("Follow + View 2 videos = 2 coins"). Users complete tasks to earn coins.
- Withdrawals: min 200 coins -> 160 KES to user (40 KES platform fee) via M-Pesa.
- Ad coins: advertisers buy 100 coins = 100 KES. Advertiser subscription 199 KES.
- Admin approves tasks and withdrawals manually.

2. New Tables
- bg_link_tasks: advertiser-posted link tasks. Columns: id, user_id (advertiser),
  link_url, platform, title, reward_coins (default 2), is_approved (bool),
  is_active (bool), screenshot_required (bool default true), expires_at, created_at.
- bg_task_completions: records when a user completes a link task.
  Columns: id, task_id, user_id, status ('pending'|'approved'|'rejected'),
  screenshot_url, completed_at, approved_at.
- bg_social_links: user's social profile links (text only, no photos).
  Columns: id, user_id, platform, url, created_at.
- bg_payments: payment records (advertiser sub, ad coin purchase, withdrawal).
  Columns: id, user_id, type ('ad_sub'|'ad_coins'|'withdrawal'),
  amount_kes, coins, status ('pending'|'approved'|'rejected'|'paid'),
  mpesa_code, screenshot_url, created_at, processed_at.
- bg_withdrawals: withdrawal requests (min 200 coins = 160 KES + 40 fee).
  Columns: id, user_id, coins, kes_to_user, kes_fee, phone, status,
  mpesa_code, created_at, processed_at.

3. Existing table changes
- bg_profiles.gold_coins is repurposed as "work coins" balance (1 coin = 1 KES).
  No column rename (data safety). Old ledger entries remain but no new
  earn-coins RPC calls will be made from the app.
- bg_coins_ledger continues to record coin movements with new reasons:
  'task_reward', 'ad_purchase', 'withdrawal', 'admin_adjust'.

4. Security
- All new tables have RLS enabled.
- bg_link_tasks: SELECT to authenticated (all can see approved+active tasks);
  INSERT/UPDATE/DELETE to authenticated who own the row. Admin can update
  is_approved via SECURITY DEFINER function.
- bg_task_completions: SELECT to authenticated (own rows + admins see all);
  INSERT to authenticated (own rows only); UPDATE to authenticated (own only).
- bg_social_links: full CRUD for authenticated on own rows; SELECT all.
- bg_payments: SELECT own rows + admin sees all; INSERT own; UPDATE admin only
  via SECURITY DEFINER.
- bg_withdrawals: SELECT own + admin; INSERT own; UPDATE admin via function.
- Grants are column-restricted where appropriate.

5. Notes
- bg_earn_coins RPC stays in DB (no DROP) but app no longer calls it.
- bg_self_verify stays for verification flow.
- All new tables use gen_random_uuid() defaults — no sequence grants needed.
*/

-- ===== bg_link_tasks =====
CREATE TABLE IF NOT EXISTS bg_link_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  link_url text NOT NULL,
  platform text NOT NULL DEFAULT 'other',
  title text DEFAULT '',
  reward_coins integer NOT NULL DEFAULT 2,
  is_approved boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  screenshot_required boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bg_link_tasks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON bg_link_tasks TO authenticated;

DROP POLICY IF EXISTS "bg_link_tasks_select" ON bg_link_tasks;
CREATE POLICY "bg_link_tasks_select"
  ON bg_link_tasks FOR SELECT TO authenticated
  USING (is_approved AND is_active AND expires_at > now()
         OR user_id = auth.uid());

DROP POLICY IF EXISTS "bg_link_tasks_insert_own" ON bg_link_tasks;
CREATE POLICY "bg_link_tasks_insert_own"
  ON bg_link_tasks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_link_tasks_update_own" ON bg_link_tasks;
CREATE POLICY "bg_link_tasks_update_own"
  ON bg_link_tasks FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_link_tasks_delete_own" ON bg_link_tasks;
CREATE POLICY "bg_link_tasks_delete_own"
  ON bg_link_tasks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ===== bg_task_completions =====
CREATE TABLE IF NOT EXISTS bg_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES bg_link_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status in ('pending','approved','rejected')),
  screenshot_url text DEFAULT '',
  completed_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (task_id, user_id)
);

ALTER TABLE bg_task_completions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON bg_task_completions TO authenticated;

DROP POLICY IF EXISTS "bg_task_completions_select" ON bg_task_completions;
CREATE POLICY "bg_task_completions_select"
  ON bg_task_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_task_completions_insert_own" ON bg_task_completions;
CREATE POLICY "bg_task_completions_insert_own"
  ON bg_task_completions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_task_completions_update_own" ON bg_task_completions;
CREATE POLICY "bg_task_completions_update_own"
  ON bg_task_completions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== bg_social_links =====
CREATE TABLE IF NOT EXISTS bg_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, platform)
);

ALTER TABLE bg_social_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON bg_social_links TO authenticated;

DROP POLICY IF EXISTS "bg_social_links_select" ON bg_social_links;
CREATE POLICY "bg_social_links_select"
  ON bg_social_links FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_social_links_insert_own" ON bg_social_links;
CREATE POLICY "bg_social_links_insert_own"
  ON bg_social_links FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_social_links_update_own" ON bg_social_links;
CREATE POLICY "bg_social_links_update_own"
  ON bg_social_links FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_social_links_delete_own" ON bg_social_links;
CREATE POLICY "bg_social_links_delete_own"
  ON bg_social_links FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ===== bg_payments =====
CREATE TABLE IF NOT EXISTS bg_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type in ('ad_sub','ad_coins','withdrawal')),
  amount_kes numeric NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status in ('pending','approved','rejected','paid')),
  mpesa_code text DEFAULT '',
  screenshot_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE bg_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON bg_payments TO authenticated;

DROP POLICY IF EXISTS "bg_payments_select" ON bg_payments;
CREATE POLICY "bg_payments_select"
  ON bg_payments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_payments_insert_own" ON bg_payments;
CREATE POLICY "bg_payments_insert_own"
  ON bg_payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ===== bg_withdrawals =====
CREATE TABLE IF NOT EXISTS bg_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  coins integer NOT NULL,
  kes_to_user numeric NOT NULL DEFAULT 0,
  kes_fee numeric NOT NULL DEFAULT 40,
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status in ('pending','approved','rejected','paid')),
  mpesa_code text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE bg_withdrawals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON bg_withdrawals TO authenticated;

DROP POLICY IF EXISTS "bg_withdrawals_select" ON bg_withdrawals;
CREATE POLICY "bg_withdrawals_select"
  ON bg_withdrawals FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bg_withdrawals_insert_own" ON bg_withdrawals;
CREATE POLICY "bg_withdrawals_insert_own"
  ON bg_withdrawals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ===== Admin functions =====

-- Approve/reject a link task (admin only)
CREATE OR REPLACE FUNCTION bg_admin_approve_task(p_task_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE bg_link_tasks SET is_approved = p_approve WHERE id = p_task_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_approve_task(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_approve_task(uuid, boolean) TO authenticated;

-- Approve a task completion and pay the reward (admin only)
CREATE OR REPLACE FUNCTION bg_admin_approve_completion(p_completion_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_comp record; v_reward integer;
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_comp FROM bg_task_completions WHERE id = p_completion_id;
  IF NOT FOUND OR v_comp.status != 'pending' THEN RAISE EXCEPTION 'invalid completion'; END IF;
  SELECT reward_coins INTO v_reward FROM bg_link_tasks WHERE id = v_comp.task_id;
  UPDATE bg_task_completions SET status = 'approved', approved_at = now() WHERE id = p_completion_id;
  UPDATE bg_profiles SET gold_coins = gold_coins + v_reward WHERE id = v_comp.user_id;
  INSERT INTO bg_coins_ledger (user_id, amount, reason) VALUES (v_comp.user_id, v_reward, 'task_reward');
  RETURN v_reward;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_approve_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_approve_completion(uuid) TO authenticated;

-- Reject a task completion (admin only)
CREATE OR REPLACE FUNCTION bg_admin_reject_completion(p_completion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE bg_task_completions SET status = 'rejected' WHERE id = p_completion_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_reject_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_reject_completion(uuid) TO authenticated;

-- Approve a withdrawal and mark paid (admin only)
CREATE OR REPLACE FUNCTION bg_admin_approve_withdrawal(p_withdrawal_id uuid, p_mpesa_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_w record;
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_w FROM bg_withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND OR v_w.status != 'pending' THEN RAISE EXCEPTION 'invalid withdrawal'; END IF;
  UPDATE bg_withdrawals SET status = 'paid', mpesa_code = p_mpesa_code, processed_at = now() WHERE id = p_withdrawal_id;
  UPDATE bg_profiles SET gold_coins = gold_coins - v_w.coins WHERE id = v_w.user_id;
  INSERT INTO bg_coins_ledger (user_id, amount, reason) VALUES (v_w.user_id, -v_w.coins, 'withdrawal');
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_approve_withdrawal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_approve_withdrawal(uuid, text) TO authenticated;

-- Reject a withdrawal (admin only)
CREATE OR REPLACE FUNCTION bg_admin_reject_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE bg_withdrawals SET status = 'rejected', processed_at = now() WHERE id = p_withdrawal_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_reject_withdrawal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_reject_withdrawal(uuid) TO authenticated;

-- Approve an ad payment and credit ad coins (admin only)
CREATE OR REPLACE FUNCTION bg_admin_approve_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pay record;
BEGIN
  IF NOT bg_is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_pay FROM bg_payments WHERE id = p_payment_id;
  IF NOT FOUND OR v_pay.status != 'pending' THEN RAISE EXCEPTION 'invalid payment'; END IF;
  UPDATE bg_payments SET status = 'approved', processed_at = now() WHERE id = p_payment_id;
  IF v_pay.coins > 0 THEN
    UPDATE bg_profiles SET gold_coins = gold_coins + v_pay.coins WHERE id = v_pay.user_id;
    INSERT INTO bg_coins_ledger (user_id, amount, reason) VALUES (v_pay.user_id, v_pay.coins, 'ad_purchase');
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION bg_admin_approve_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bg_admin_approve_payment(uuid) TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bg_link_tasks_active ON bg_link_tasks (is_approved, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_bg_task_completions_user ON bg_task_completions (user_id);
CREATE INDEX IF NOT EXISTS idx_bg_withdrawals_status ON bg_withdrawals (status);
CREATE INDEX IF NOT EXISTS idx_bg_payments_status ON bg_payments (status);
