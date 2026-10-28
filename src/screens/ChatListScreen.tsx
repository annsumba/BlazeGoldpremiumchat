import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { Search, MoreVertical, Pin, Plus, MessageCircle, CircleDollarSign, User as UserIcon, Crown, Filter, Bell, X, Download, Wallet, Megaphone, Link2, Receipt, Menu } from 'lucide-react';
import type { IconType } from '@/lib/icons';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';
import { VerifiedBadge, CoinPill } from '@/components/Badges';
import { Ticks } from '@/components/Ticks';
import { useAuth } from '@/lib/auth';
import { countryFlag, countryName } from '@/lib/countries';
import { formatChatTime } from '@/lib/utils';
import type { Broadcast } from '@/lib/types';

type ChatRow = {
  chat_id: string;
  type: 'direct' | 'group';
  name: string;
  avatar_url: string;
  is_pinned: boolean;
  is_muted: boolean;
  last_read_at: string;
  peer_id: string;
  peer_name: string;
  peer_country: string;
  peer_online: boolean;
  peer_last_seen: string;
  peer_verified: boolean;
  peer_avatar: string;
  last_text: string;
  last_type: string;
  last_sender: string;
  last_status: 'sent' | 'delivered' | 'read';
  last_at: string;
  unread: number;
};

type Filter = 'all' | 'unread' | 'groups';

export const ChatListScreen = ({ onOpenChat, onNewChat, onOpenProfile, onOpenStatus, onOpenAdmin, onOpenEarnings, onOpenAdvertise, onOpenLinks, onOpenPaymentHistory, installPrompt }: {
  onOpenChat: (chatId: string) => void;
  onNewChat: () => void;
  onOpenProfile: () => void;
  onOpenStatus: () => void;
  onOpenAdmin: () => void;
  onOpenEarnings: () => void;
  onOpenAdvertise: () => void;
  onOpenLinks: () => void;
  onOpenPaymentHistory: () => void;
  installPrompt: () => void;
}) => {
  const { profile, signOut } = useAuth();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = () => setCanInstall(true);
    window.addEventListener('appinstallable', handler);
    return () => window.removeEventListener('appinstallable', handler);
  }, []);

  useEffect(() => {
    const loadBroadcast = async () => {
      const { data } = await supabase
        .from('bg_broadcasts')
        .select('*')
        .or('expires_at.gt.now(),expires_at.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setBroadcast(data as Broadcast | null);
    };
    loadBroadcast();
    const sub = supabase
      .channel('broadcasts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bg_broadcasts' }, loadBroadcast)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const loadChats = async () => {
    if (!profile) return;
    setLoading(true);
    const { data: members } = await supabase
      .from('bg_chat_members')
      .select('chat_id, is_pinned, is_muted, last_read_at')
      .eq('user_id', profile.id);

    if (!members || members.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const chatIds = members.map((m) => m.chat_id);
    const { data: chatsData } = await supabase
      .from('bg_chats')
      .select('*')
      .in('id', chatIds);

    const { data: allMembers } = await supabase
      .from('bg_chat_members')
      .select('chat_id, user_id, role')
      .in('chat_id', chatIds);

    const peerIds = Array.from(
      new Set(
        (allMembers ?? [])
          .filter((m) => m.user_id !== profile.id)
          .map((m) => m.user_id)
      )
    );
    const { data: peers } = await supabase
      .from('bg_profiles')
      .select('*')
      .in('id', peerIds);

    const peerMap = new Map<string, Profile>((peers ?? []).map((p) => [p.id, p as Profile]));

    const rows: ChatRow[] = [];
    for (const m of members) {
      const chat = (chatsData ?? []).find((c) => c.id === m.chat_id);
      if (!chat) continue;
      const chatMembers = (allMembers ?? []).filter((x) => x.chat_id === chat.id);
      const peerMember = chatMembers.find((x) => x.user_id !== profile.id);
      const peer = peerMember ? peerMap.get(peerMember.user_id) : null;

      // last message
      const { data: lastMsgs } = await supabase
        .from('bg_messages')
        .select('text, type, sender_id, status, created_at, deleted_by')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const last = lastMsgs?.[0];

      const unread = last && new Date(last.created_at) > new Date(m.last_read_at) && last.sender_id !== profile.id ? 1 : 0;

      const name = chat.type === 'group' ? chat.name : peer?.display_name ?? 'Unknown';
      const avatar = chat.type === 'group' ? chat.avatar_url : peer?.avatar_url ?? '';

      rows.push({
        chat_id: chat.id,
        type: chat.type,
        name: name || (chat.type === 'group' ? 'Group' : 'Chat'),
        avatar_url: avatar,
        is_pinned: m.is_pinned,
        is_muted: m.is_muted,
        last_read_at: m.last_read_at,
        peer_id: peer?.id ?? '',
        peer_name: peer?.display_name ?? '',
        peer_country: peer?.country ?? 'KE',
        peer_online: peer?.online ?? false,
        peer_last_seen: peer?.last_seen ?? chat.created_at,
        peer_verified: peer?.is_verified ?? false,
        peer_avatar: peer?.avatar_url ?? '',
        last_text: last ? (last.deleted_by ? '🚫 message removed' : previewText(last.text, last.type)) : 'No messages yet',
        last_type: last?.type ?? 'text',
        last_sender: last?.sender_id ?? '',
        last_status: last?.status ?? 'sent',
        last_at: last?.created_at ?? chat.created_at,
        unread,
      });
    }

    rows.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
    });
    setChats(rows);
    setLoading(false);
  };

  useEffect(() => {
    loadChats();
    // realtime: messages
    const sub = supabase
      .channel('chatlist-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bg_messages' }, () => loadChats())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bg_messages' }, () => loadChats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bg_chat_members' }, () => loadChats())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const filtered = chats.filter((c) => {
    if (filter === 'unread' && c.unread === 0) return false;
    if (filter === 'groups' && c.type !== 'group') return false;
    if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const pinned = filtered.filter((c) => c.is_pinned);
  const rest = filtered.filter((c) => !c.is_pinned);

  return (
    <div className="flex flex-col h-full bg-ink-900">
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <CoinPill />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((m) => !m)}
                className="p-2 rounded-full hover:bg-white/5 transition"
                aria-label="Menu"
              >
                <Menu size={20} className="text-gray-300" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-56 card shadow-gold z-20 py-1 animate-slide-up">
                    <MenuItem icon={Wallet} label="My Earnings" onClick={() => { setMenuOpen(false); onOpenEarnings(); }} gold />
                    <MenuItem icon={Megaphone} label="Advertise" onClick={() => { setMenuOpen(false); onOpenAdvertise(); }} />
                    <MenuItem icon={Link2} label="My Links" onClick={() => { setMenuOpen(false); onOpenLinks(); }} />
                    <MenuItem icon={Receipt} label="Payment History" onClick={() => { setMenuOpen(false); onOpenPaymentHistory(); }} />
                    <div className="my-1 border-t border-white/5" />
                    <MenuItem icon={UserIcon} label="My Profile" onClick={() => { setMenuOpen(false); onOpenProfile(); }} />
                    <MenuItem icon={CircleDollarSign} label="Gold Status" onClick={() => { setMenuOpen(false); onOpenStatus(); }} />
                    {canInstall && <MenuItem icon={Download} label="Install App" onClick={() => { setMenuOpen(false); installPrompt(); }} />}
                    {profile?.is_admin && <MenuItem icon={Crown} label="Admin Panel" gold onClick={() => { setMenuOpen(false); onOpenAdmin(); }} />}
                    <MenuItem icon={MessageCircle} label="Sign out" onClick={() => { setMenuOpen(false); signOut(); }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-300/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats..."
              className="input-gold w-full pl-10 pr-3 py-2.5 text-sm"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {(['all', 'unread', 'groups'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize whitespace-nowrap transition ${
                filter === f
                  ? 'gold-bg text-ink-900 shadow-gold-sm'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* Broadcast banner */}
      {broadcast && (
        <div className={`mx-3 mt-3 rounded-xl2 px-4 py-2.5 flex items-start gap-2 animate-slide-up ${
          broadcast.type === 'update' ? 'bg-blue-500/15 border border-blue-400/30' :
          broadcast.type === 'sponsor' ? 'gold-gradient-soft border border-gold-300/30' :
          'bg-gold-300/10 border border-gold-300/30'
        }`}>
          <Bell size={16} className="text-gold-300 mt-0.5 shrink-0" />
          <p className="text-sm text-gold-100 flex-1">{broadcast.message}</p>
          <button onClick={() => setBroadcast(null)} className="text-gray-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Crown size={20} className="text-gold-300 animate-pulse" /> <span className="ml-2">Loading your chats...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onNewChat={onNewChat} />
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="px-3 pt-3">
                <span className="text-xs text-gold-300/70 px-2 flex items-center gap-1"><Pin size={11} /> Pinned</span>
              </div>
            )}
            {pinned.map((c) => <ChatRowItem key={c.chat_id} row={c} mineId={profile?.id ?? ''} onClick={() => onOpenChat(c.chat_id)} />)}
            {pinned.length > 0 && rest.length > 0 && <div className="h-2" />}
            {rest.map((c) => <ChatRowItem key={c.chat_id} row={c} mineId={profile?.id ?? ''} onClick={() => onOpenChat(c.chat_id)} />)}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={onNewChat}
        className="absolute bottom-20 right-5 w-14 h-14 rounded-full gold-bg text-ink-900 shadow-gold-lg flex items-center justify-center animate-gold-pulse z-20"
        aria-label="New chat"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
};

const previewText = (text: string, type: string): string => {
  if (type === 'image') return '📷 Photo';
  if (type === 'voice') return '🎙 Voice note';
  if (type === 'document') return '📄 Document';
  if (type === 'location') return '📍 Location';
  if (type === 'contact') return '👤 Contact';
  return text;
};

const ChatRowItem = ({ row, mineId, onClick }: { row: ChatRow; mineId: string; onClick: () => void }) => {
  const mine = row.last_sender === mineId;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition text-left border-b border-white/[0.03]"
    >
      <div className="relative shrink-0">
        {row.type === 'group' ? (
          <div className="w-12 h-12 rounded-full gold-gradient-soft border border-gold-300/30 flex items-center justify-center text-gold-300 font-bold">
            {row.name.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <Avatar name={row.peer_name} src={row.peer_avatar} size={48} ring={row.peer_verified ? 'gold' : 'none'} showOnlineDot online={row.peer_online} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {row.is_pinned && <Pin size={12} className="text-gold-300 shrink-0" />}
          <span className="font-semibold truncate text-white">{row.name}</span>
          {row.type === 'direct' && <span className="text-sm shrink-0">{countryFlag(row.peer_country)}</span>}
          {row.peer_verified && <VerifiedBadge size={13} />}
          {row.is_muted && <span className="text-gray-500 text-xs">🔇</span>}
          {row.type === 'direct' && (
            <span className={`shrink-0 text-xs ${row.peer_online ? 'text-green-400 font-medium' : 'text-gray-500'}`}>
              {row.peer_online ? 'online' : `last seen ${formatChatTime(row.peer_last_seen)}`}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-500 shrink-0">{formatChatTime(row.last_at)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {mine && <Ticks status={row.last_status} mine />}
          <span className={`text-sm truncate ${row.unread ? 'text-white font-medium' : 'text-gray-400'}`}>
            {row.last_text}
          </span>
          {row.unread > 0 && (
            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full gold-bg text-ink-900 text-xs font-bold flex items-center justify-center shadow-gold-sm">
              {row.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const MenuItem = ({ icon: Icon, label, onClick, gold }: { icon: IconType; label: string; onClick: () => void; gold?: boolean }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition text-left ${gold ? 'text-gold-300' : 'text-gray-200'}`}>
    <Icon size={16} /> {label}
  </button>
);

const EmptyState = ({ onNewChat }: { onNewChat: () => void }) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="w-20 h-20 rounded-full gold-gradient-soft border border-gold-300/30 flex items-center justify-center mb-4">
      <MessageCircle size={36} className="text-gold-300" />
    </div>
    <h3 className="font-display font-bold text-lg">No chats yet</h3>
    <p className="text-sm text-gray-400 mt-1 max-w-xs">Start a conversation with anyone in the world — just their email is enough.</p>
    <button onClick={onNewChat} className="btn-gold mt-5 px-5 py-2.5 flex items-center gap-2 text-sm">
      <Plus size={16} /> Start a new chat
    </button>
  </div>
);
