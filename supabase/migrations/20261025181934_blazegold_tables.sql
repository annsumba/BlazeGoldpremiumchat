/*
# BlazeGold schema — tables only (part 1)

Creates all tables and indexes. RLS policies come in part 2 so cross-table
policy predicates can reference tables that already exist.

Tables:
- bg_profiles: per-user profile + operator fields (is_admin, is_verified,
  is_banned, is_muted, gold_coins). User-editable columns restricted via GRANT.
- bg_chats: direct or group chat container.
- bg_chat_members: membership with role, pin, mute, last_read_at.
- bg_messages: messages with type, reply, star, view-once, edit, soft delete.
- bg_message_receipts: per-recipient delivered/read state (gold ticks).
- bg_status: 24h gold status stories + sponsored admin statuses.
- bg_status_views: who viewed a status.
- bg_broadcasts: admin gold announcement banner.
- bg_reports: user reports.
- bg_coins_ledger: gold coin earn/spend audit.
*/

CREATE TABLE IF NOT EXISTS bg_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT 'Gold User',
  country text NOT NULL DEFAULT 'KE',
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  status_text text DEFAULT '',
  is_verified boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  gold_coins integer NOT NULL DEFAULT 0,
  online boolean NOT NULL DEFAULT false,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bg_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type in ('direct','group')),
  name text DEFAULT '',
  description text DEFAULT '',
  avatar_url text DEFAULT '',
  created_by uuid REFERENCES bg_profiles(id) ON DELETE SET NULL,
  only_admins_send boolean NOT NULL DEFAULT false,
  approve_members boolean NOT NULL DEFAULT false,
  invite_code text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bg_chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES bg_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role in ('member','admin','owner')),
  is_pinned boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  last_read_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS bg_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES bg_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'text' CHECK (type in ('text','image','voice','document','location','contact','system')),
  text text DEFAULT '',
  attachment_url text DEFAULT '',
  attachment_name text DEFAULT '',
  reply_to_id uuid REFERENCES bg_messages(id) ON DELETE SET NULL,
  is_starred boolean NOT NULL DEFAULT false,
  is_view_once boolean NOT NULL DEFAULT false,
  viewed_by uuid[] DEFAULT '{}',
  original_text text DEFAULT '',
  translated_text text DEFAULT '',
  target_lang text DEFAULT '',
  edited_at timestamptz,
  deleted_by uuid,
  deleted_for uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'sent' CHECK (status in ('sent','delivered','read')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bg_message_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES bg_messages(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  UNIQUE (message_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS bg_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'text' CHECK (type in ('text','image','video')),
  text text DEFAULT '',
  bg_color text DEFAULT '#FFD700',
  attachment_url text DEFAULT '',
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsor_name text DEFAULT '',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bg_status_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES bg_status(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE (status_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS bg_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  type text NOT NULL DEFAULT 'announcement' CHECK (type in ('announcement','update','sponsor')),
  created_by uuid REFERENCES bg_profiles(id) ON DELETE SET NULL,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bg_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES bg_profiles(id) ON DELETE CASCADE,
  target_message_id uuid REFERENCES bg_messages(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bg_coins_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES bg_profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL DEFAULT 'chat',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bg_messages_chat_created ON bg_messages (chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bg_chat_members_user ON bg_chat_members (user_id);
CREATE INDEX IF NOT EXISTS idx_bg_chat_members_chat ON bg_chat_members (chat_id);
CREATE INDEX IF NOT EXISTS idx_bg_status_user ON bg_status (user_id, expires_at);
