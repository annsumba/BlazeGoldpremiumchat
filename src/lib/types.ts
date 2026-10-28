export type Profile = {
  id: string;
  email: string;
  display_name: string;
  country: string;
  bio: string;
  avatar_url: string;
  status_text: string;
  is_verified: boolean;
  is_admin: boolean;
  is_banned: boolean;
  is_muted: boolean;
  gold_coins: number;
  online: boolean;
  last_seen: string;
  created_at: string;
};

export type Chat = {
  id: string;
  type: 'direct' | 'group';
  name: string;
  description: string;
  avatar_url: string;
  created_by: string | null;
  only_admins_send: boolean;
  approve_members: boolean;
  invite_code: string | null;
  created_at: string;
};

export type MemberRole = 'member' | 'admin' | 'owner';
export type ChatMember = {
  id: string;
  chat_id: string;
  user_id: string;
  role: MemberRole;
  is_pinned: boolean;
  is_muted: boolean;
  last_read_at: string;
  joined_at: string;
};

export type MessageType =
  | 'text'
  | 'image'
  | 'voice'
  | 'document'
  | 'location'
  | 'contact'
  | 'system';

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  type: MessageType;
  text: string;
  attachment_url: string;
  attachment_name: string;
  reply_to_id: string | null;
  is_starred: boolean;
  is_view_once: boolean;
  viewed_by: string[];
  original_text: string;
  translated_text: string;
  target_lang: string;
  edited_at: string | null;
  deleted_by: string | null;
  deleted_for: string[];
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
};

export type StatusType = 'text' | 'image' | 'video' | 'voice';
export type Status = {
  id: string;
  user_id: string;
  type: StatusType;
  text: string;
  bg_color: string;
  attachment_url: string;
  is_sponsored: boolean;
  sponsor_name: string;
  expires_at: string;
  created_at: string;
};

export type StatusView = {
  id: string;
  status_id: string;
  viewer_id: string;
  viewed_at: string;
};

export type Broadcast = {
  id: string;
  message: string;
  type: 'announcement' | 'update' | 'sponsor';
  created_by: string | null;
  expires_at: string | null;
  created_at: string;
};

export type CoinLedger = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
};

export type LinkTask = {
  id: string;
  user_id: string;
  link_url: string;
  platform: string;
  title: string;
  reward_coins: number;
  is_approved: boolean;
  is_active: boolean;
  screenshot_required: boolean;
  expires_at: string;
  created_at: string;
};

export type TaskCompletion = {
  id: string;
  task_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  screenshot_url: string;
  completed_at: string;
  approved_at: string | null;
};

export type SocialLink = {
  id: string;
  user_id: string;
  platform: string;
  url: string;
  created_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  type: 'ad_sub' | 'ad_coins' | 'withdrawal';
  amount_kes: number;
  coins: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  mpesa_code: string;
  screenshot_url: string;
  created_at: string;
  processed_at: string | null;
};

export type Withdrawal = {
  id: string;
  user_id: string;
  coins: number;
  kes_to_user: number;
  kes_fee: number;
  phone: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  mpesa_code: string;
  created_at: string;
  processed_at: string | null;
};
