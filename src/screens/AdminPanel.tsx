import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Profile, Message, Chat, LinkTask, TaskCompletion, Withdrawal, Payment } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { VerifiedBadge } from '@/components/Badges';
import { countryFlag } from '@/lib/countries';
import { formatChatTime } from '@/lib/utils';
import { ArrowLeft, Crown, Users, MessageCircle, Globe, Shield, Ban, Bell, Trash2, Flame, Coins, Eye, Loader2, Search, X, Send, TrendingUp, Activity, Link2, Check, XCircle, Wallet, Receipt, Megaphone } from 'lucide-react';
import type { IconType } from '@/lib/icons';

type Tab = 'overview' | 'users' | 'tasks' | 'completions' | 'withdrawals' | 'payments' | 'ghost' | 'broadcast' | 'sponsor' | 'reports';

export const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<Profile[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, online: 0, totalMessages: 0, groups: 0 });
  const [byCountry, setByCountry] = useState<{ country: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [ghostChat, setGhostChat] = useState<Chat | null>(null);
  const [ghostMsgs, setGhostMsgs] = useState<Message[]>([]);
  const [ghostProfiles, setGhostProfiles] = useState<Record<string, Profile>>({});
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [sponsorModal, setSponsorModal] = useState(false);
  const [tasks, setTasks] = useState<LinkTask[]>([]);
  const [completions, setCompletions] = useState<(TaskCompletion & { task?: LinkTask })[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [taskProfiles, setTaskProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: us } = await supabase.from('bg_profiles').select('*').order('created_at', { ascending: false });
    setUsers((us ?? []) as Profile[]);
    const online = (us ?? []).filter((u) => u.online).length;
    const { count: msgCount } = await supabase.from('bg_messages').select('*', { count: 'exact', head: true });
    const { data: groups } = await supabase.from('bg_chats').select('*').eq('type', 'group');
    setStats({ totalUsers: us?.length ?? 0, online, totalMessages: msgCount ?? 0, groups: groups?.length ?? 0 });
    const cc: Record<string, number> = {};
    (us ?? []).forEach((u) => { cc[u.country] = (cc[u.country] ?? 0) + 1; });
    setByCountry(Object.entries(cc).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 8));
    setLoading(false);
  }, []);

  const loadTasks = async () => {
    const { data } = await supabase.from('bg_link_tasks').select('*').order('created_at', { ascending: false }).limit(50);
    const taskList = (data ?? []) as LinkTask[];
    setTasks(taskList);
    const uIds = Array.from(new Set(taskList.map((t) => t.user_id)));
    if (uIds.length) {
      const { data: profs } = await supabase.from('bg_profiles').select('*').in('id', uIds);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as Profile));
      setTaskProfiles(map);
    }
  };

  const loadCompletions = async () => {
    const { data } = await supabase.from('bg_task_completions').select('*').eq('status', 'pending').order('completed_at', { ascending: false }).limit(50);
    const comps = (data ?? []) as TaskCompletion[];
    if (comps.length) {
      const { data: taskData } = await supabase.from('bg_link_tasks').select('*').in('id', comps.map((c) => c.task_id));
      const taskMap: Record<string, LinkTask> = {};
      (taskData ?? []).forEach((t) => (taskMap[t.id] = t as LinkTask));
      setCompletions(comps.map((c) => ({ ...c, task: taskMap[c.task_id] })));
    } else { setCompletions([]); }
  };

  const loadWithdrawals = async () => {
    const { data } = await supabase.from('bg_withdrawals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
    setWithdrawals((data ?? []) as Withdrawal[]);
  };

  const loadPayments = async () => {
    const { data } = await supabase.from('bg_payments').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
    setPayments((data ?? []) as Payment[]);
  };

  useEffect(() => { load(); }, [load]);

  const loadChats = async () => {
    const { data } = await supabase.from('bg_chats').select('*').order('created_at', { ascending: false }).limit(50);
    setChats((data ?? []) as Chat[]);
  };

  const openGhost = async (c: Chat) => {
    setGhostChat(c);
    const { data: ms } = await supabase.from('bg_messages').select('*').eq('chat_id', c.id).order('created_at', { ascending: true }).limit(100);
    setGhostMsgs((ms ?? []) as Message[]);
    const ids = Array.from(new Set((ms ?? []).map((m) => m.sender_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from('bg_profiles').select('*').in('id', ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as Profile));
      setGhostProfiles(map);
    }
  };

  const burn = async (m: Message) => {
    if (!confirm('Burn this message permanently?')) return;
    await supabase.rpc('bg_admin_burn_message', { p_message_id: m.id });
    setGhostMsgs((prev) => prev.filter((x) => x.id !== m.id));
  };

  const ban = async (u: Profile, ban: boolean) => {
    await supabase.rpc('bg_admin_set_ban', { p_user_id: u.id, p_banned: ban });
    load();
  };
  const mute = async (u: Profile, mute: boolean) => {
    await supabase.rpc('bg_admin_set_mute', { p_user_id: u.id, p_muted: mute });
    load();
  };
  const verify = async (u: Profile, v: boolean) => {
    await supabase.rpc('bg_admin_set_verified', { p_user_id: u.id, p_verified: v });
    load();
  };
  const grantCoins = async (u: Profile) => {
    const amt = Number(prompt(`Grant gold coins to ${u.display_name}:`, '100'));
    if (!amt) return;
    await supabase.rpc('bg_grant_coins', { p_user_id: u.id, p_amount: amt, p_reason: 'admin_grant' });
    load();
  };

  const filteredUsers = users.filter((u) =>
    !search || u.display_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!profile?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Crown size={40} className="text-gray-600" />
        <p className="mt-3 text-gray-400">Admin access only.</p>
        <button onClick={onBack} className="btn-gold mt-4 px-4 py-2 text-sm">Go back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <Crown size={18} className="text-gold-300" />
        <span className="font-display font-bold gold-text">BlazeGod Panel</span>
        <span className="ml-auto text-xs text-gold-300/60 hidden sm:block">Secret Admin</span>
      </header>

      {/* Tabs */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar border-b border-white/5">
        {([
          ['overview', 'Overview', TrendingUp], ['users', 'Users', Users], ['ghost', 'Ghost View', Eye],
          ['broadcast', 'Broadcast', Bell], ['sponsor', 'Sponsor', Crown], ['reports', 'Reports', Shield],
        ] as [Tab, string, React.ComponentType<{ size?: number; className?: string }>][]).map(([t, label, Icon]) => (
          <button key={t} onClick={() => { setTab(t); if (t === 'ghost') loadChats(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${tab === t ? 'gold-bg text-ink-900' : 'bg-white/5 text-gray-300'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gold-300" /></div> : (
          <>
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard icon={Users} label="Total users" value={stats.totalUsers} />
                  <StatCard icon={Activity} label="Online now" value={stats.online} accent="green" />
                  <StatCard icon={MessageCircle} label="Messages" value={stats.totalMessages} />
                  <StatCard icon={Crown} label="Groups" value={stats.groups} />
                </div>
                <div className="card p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Globe size={16} className="text-gold-300" /> Top countries</h3>
                  <div className="space-y-2">
                    {byCountry.map((c) => (
                      <div key={c.country} className="flex items-center gap-2">
                        <span className="text-xl">{countryFlag(c.country)}</span>
                        <span className="text-sm flex-1">{c.country}</span>
                        <div className="w-32 h-2 rounded-full bg-ink-700 overflow-hidden">
                          <div className="h-full gold-bg" style={{ width: `${(c.count / stats.totalUsers) * 100}%` }} />
                        </div>
                        <span className="text-sm text-gold-300 font-semibold w-8 text-right">{c.count}</span>
                      </div>
                    ))}
                    {byCountry.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-300/70" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="input-gold w-full pl-10 pr-3 py-2.5 text-sm" />
                </div>
                {filteredUsers.map((u) => (
                  <div key={u.id} className="card p-3 group">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.display_name} src={u.avatar_url} size={44} ring={u.is_verified ? 'gold' : 'none'} showOnlineDot online={u.online} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate">{u.display_name}</span>
                          {u.is_verified && <VerifiedBadge size={12} />}
                          {u.is_admin && <Crown size={13} className="text-gold-300" />}
                          {u.is_banned && <Ban size={13} className="text-red-400" />}
                          <span className="ml-auto text-sm">{countryFlag(u.country)}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{u.email} · {u.gold_coins} coins</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <ABtn onClick={() => verify(u, !u.is_verified)} gold>{u.is_verified ? 'Unverify' : 'Verify'}</ABtn>
                      <ABtn onClick={() => grantCoins(u)}><Coins size={13} /> Coins</ABtn>
                      <ABtn onClick={() => mute(u, !u.is_muted)}>{u.is_muted ? 'Unmute' : 'Mute'}</ABtn>
                      <ABtn onClick={() => ban(u, !u.is_banned)} danger>{u.is_banned ? 'Unban' : 'Ban'}</ABtn>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && <p className="text-center text-gray-500 py-8">No users found.</p>}
              </div>
            )}

            {tab === 'ghost' && (
              <div className="space-y-3">
                {!ghostChat ? (
                  <>
                    <p className="text-xs text-gray-400 px-1">View any chat without appearing online. Messages stay unread for the other party.</p>
                    {chats.map((c) => (
                      <button key={c.id} onClick={() => openGhost(c)} className="card w-full p-3 flex items-center gap-3 hover:border-gold-300/30 transition text-left">
                        <div className="w-10 h-10 rounded-full gold-gradient-soft border border-gold-300/30 flex items-center justify-center text-gold-300 font-bold text-sm">
                          {(c.name || c.id.slice(0, 2)).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{c.name || 'Direct chat'}</p>
                          <p className="text-xs text-gray-500 capitalize">{c.type} · {formatChatTime(c.created_at)}</p>
                        </div>
                        <Eye size={16} className="text-gold-300" />
                      </button>
                    ))}
                    {chats.length === 0 && <p className="text-center text-gray-500 py-8">No chats yet.</p>}
                  </>
                ) : (
                  <div>
                    <button onClick={() => setGhostChat(null)} className="text-sm text-gold-300 mb-3 flex items-center gap-1"><ArrowLeft size={14} /> Back to chats</button>
                    <p className="font-semibold mb-3">{ghostChat.name || 'Direct chat'}</p>
                    <div className="space-y-1.5">
                      {ghostMsgs.map((m) => (
                        <div key={m.id} className={`flex ${m.sender_id === profile?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm group ${m.sender_id === profile?.id ? 'gold-bg text-ink-900' : 'bg-ink-800'}`}>
                            {m.type !== 'text' && <span className="text-xs opacity-70">[{m.type}]</span>}
                            <p>{m.text || `[${m.type}]`}</p>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-[10px] opacity-60">{ghostProfiles[m.sender_id]?.display_name ?? 'User'} · {formatChatTime(m.created_at)}</span>
                              <button onClick={() => burn(m)} className="opacity-0 group-hover:opacity-100 text-red-400 transition"><Flame size={13} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {ghostMsgs.length === 0 && <p className="text-center text-gray-500 py-8">No messages in this chat.</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'broadcast' && (
              <div className="space-y-3">
                <div className="card p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Bell size={16} className="text-gold-300" /> Send Gold Announcement</h3>
                  <p className="text-sm text-gray-400 mb-3">A gold banner appears at the top of every user's chat list.</p>
                  <button onClick={() => setBroadcastModal(true)} className="btn-gold px-4 py-2.5 text-sm flex items-center gap-2"><Send size={15} /> New broadcast</button>
                </div>
              </div>
            )}

            {tab === 'sponsor' && (
              <div className="space-y-3">
                <div className="card p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Crown size={16} className="text-gold-300" /> Sponsored Gold Status</h3>
                  <p className="text-sm text-gray-400 mb-3">Post a business ad status shown to ALL users for 24 hours.</p>
                  <button onClick={() => setSponsorModal(true)} className="btn-gold px-4 py-2.5 text-sm flex items-center gap-2"><Send size={15} /> Post sponsored status</button>
                </div>
              </div>
            )}

            {tab === 'reports' && (
              <div className="card p-6 text-center">
                <Shield size={32} className="text-gold-300/60 mx-auto" />
                <p className="mt-2 text-sm text-gray-400">No reports yet. User reports will appear here.</p>
              </div>
            )}
          </>
        )}
      </div>

      <BroadcastModal open={broadcastModal} onClose={() => setBroadcastModal(false)} />
      <SponsorModal open={sponsorModal} onClose={() => setSponsorModal(false)} />
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }: { icon: IconType; label: string; value: number; accent?: string }) => (
  <div className="card p-4">
    <Icon size={20} className={accent === 'green' ? 'text-green-400' : 'text-gold-300'} />
    <p className="text-2xl font-bold mt-2">{value.toLocaleString()}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
);
const ABtn = ({ children, onClick, danger, gold }: { children: React.ReactNode; onClick: () => void; danger?: boolean; gold?: boolean }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${danger ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : gold ? 'gold-bg text-ink-900' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>{children}</button>
);

const BroadcastModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<'announcement' | 'update' | 'sponsor'>('announcement');
  const [hours, setHours] = useState(24);
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    await supabase.rpc('bg_admin_broadcast', { p_message: msg.trim(), p_type: type, p_hours: hours });
    setMsg(''); setSending(false); onClose();
    alert('Broadcast sent to all users!');
  };
  return (
    <Modal open={open} onClose={onClose} title="New broadcast"
      footer={<button onClick={send} disabled={sending || !msg.trim()} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send to all users</button>}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1 ml-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input-gold w-full px-3 py-2.5 text-sm">
            <option value="announcement" className="bg-ink-850">Announcement (gold)</option>
            <option value="update" className="bg-ink-850">Force update (blue)</option>
            <option value="sponsor" className="bg-ink-850">Sponsor (gold soft)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1 ml-1">Message</label>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="New update available! Tap to refresh..." />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1 ml-1">Duration (hours)</label>
          <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="input-gold w-full px-3 py-2.5 text-sm" />
        </div>
      </div>
    </Modal>
  );
};

const SponsorModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [sponsor, setSponsor] = useState('');
  const [text, setText] = useState('');
  const [bg, setBg] = useState('#FFD700');
  const [hours, setHours] = useState(24);
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!text.trim() || !sponsor.trim()) return;
    setSending(true);
    await supabase.rpc('bg_admin_sponsored_status', { p_type: 'text', p_text: text.trim(), p_sponsor: sponsor.trim(), p_bg: bg, p_hours: hours });
    setSponsor(''); setText(''); setSending(false); onClose();
    alert('Sponsored status posted to all users!');
  };
  return (
    <Modal open={open} onClose={onClose} title="Sponsored status"
      footer={<button onClick={send} disabled={sending || !text.trim() || !sponsor.trim()} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Post to all users</button>}>
      <div className="space-y-3">
        <div><label className="block text-xs text-gray-400 mb-1 ml-1">Business name</label><input value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="Acme Ltd" /></div>
        <div><label className="block text-xs text-gray-400 mb-1 ml-1">Status text</label><textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="Special offer for BlazeGold users!" /></div>
        <div><label className="block text-xs text-gray-400 mb-1 ml-1">Background</label><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-full h-10 rounded-lg bg-transparent" /></div>
        <div><label className="block text-xs text-gray-400 mb-1 ml-1">Duration (hours)</label><input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="input-gold w-full px-3 py-2.5 text-sm" /></div>
      </div>
    </Modal>
  );
};
