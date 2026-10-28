import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Chat, ChatMember, Profile } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { VerifiedBadge } from '@/components/Badges';
import { COUNTRIES, countryFlag } from '@/lib/countries';
import { ArrowLeft, Users, Crown, UserPlus, Link as LinkIcon, Settings, LogOut, Shield, Check, Loader2, Search, X } from 'lucide-react';

export const GroupInfo = ({ chatId, onBack }: { chatId: string; onBack: () => void }) => {
  const { profile } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const load = async () => {
    const { data: c } = await supabase.from('bg_chats').select('*').eq('id', chatId).maybeSingle();
    setChat(c as Chat | null);
    const { data: ms } = await supabase.from('bg_chat_members').select('*').eq('chat_id', chatId);
    setMembers((ms ?? []) as ChatMember[]);
    const ids = (ms ?? []).map((m) => m.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from('bg_profiles').select('*').in('id', ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as Profile));
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [chatId]);

  const me = members.find((m) => m.user_id === profile?.id);
  const isAdminRole = me?.role === 'admin' || me?.role === 'owner';

  const removeMember = async (m: ChatMember) => {
    if (!isAdminRole) return;
    await supabase.from('bg_chat_members').delete().eq('id', m.id);
    load();
  };
  const makeAdmin = async (m: ChatMember) => {
    if (me?.role !== 'owner') return;
    await supabase.from('bg_chat_members').update({ role: 'admin' }).eq('id', m.id);
    load();
  };
  const leaveGroup = async () => {
    if (!me) return;
    await supabase.from('bg_chat_members').delete().eq('id', me.id);
    onBack();
  };

  const copyInvite = () => {
    if (!chat?.invite_code) return;
    navigator.clipboard?.writeText(`blazegold.chat/join/${chat.invite_code}`);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const saveSettings = async (onlyAdmins: boolean, approve: boolean) => {
    await supabase.from('bg_chats').update({ only_admins_send: onlyAdmins, approve_members: approve }).eq('id', chatId);
    setSettingsOpen(false);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-gold-300" /></div>;

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <span className="font-semibold">Group info</span>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Group header */}
        <div className="flex flex-col items-center py-8 px-6 text-center border-b border-white/5">
          <div className="w-24 h-24 rounded-full gold-gradient-soft border-2 border-gold-300/40 flex items-center justify-center text-gold-300 font-bold text-2xl mb-3">
            {(chat?.name ?? 'G').slice(0, 2).toUpperCase()}
          </div>
          <h2 className="font-display font-bold text-xl">{chat?.name}</h2>
          <p className="text-sm text-gray-400 mt-1">{chat?.description || 'No description'}</p>
          <p className="text-xs text-gray-500 mt-2">{members.length} members</p>
          {chat?.invite_code && (
            <button onClick={copyInvite} className="mt-4 btn-ghost px-4 py-2 flex items-center gap-2 text-sm">
              <LinkIcon size={14} /> {inviteCopied ? 'Copied!' : `blazegold.chat/join/${chat.invite_code}`}
            </button>
          )}
        </div>

        {/* Members */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gold-300/70 font-medium">{members.length} MEMBERS</span>
            {isAdminRole && (
              <button onClick={() => setAddOpen(true)} className="text-sm text-gold-300 flex items-center gap-1">
                <UserPlus size={14} /> Add
              </button>
            )}
          </div>
          <div className="space-y-1">
            {members.map((m) => {
              const p = profiles[m.user_id];
              return (
                <div key={m.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 group">
                  <Avatar name={p?.display_name ?? 'U'} src={p?.avatar_url} size={42} showOnlineDot online={p?.online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{p?.display_name ?? 'User'}</span>
                      {p?.is_verified && <VerifiedBadge size={12} />}
                      {m.role !== 'member' && <Crown size={13} className="text-gold-300" />}
                      <span className="ml-auto text-sm">{p ? countryFlag(p.country) : ''}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{p?.email}</p>
                  </div>
                  {isAdminRole && m.user_id !== profile?.id && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {me?.role === 'owner' && m.role === 'member' && (
                        <button onClick={() => makeAdmin(m)} title="Make admin" className="p-1.5 rounded-full hover:bg-white/10"><Shield size={15} className="text-gold-300" /></button>
                      )}
                      <button onClick={() => removeMember(m)} title="Remove" className="p-1.5 rounded-full hover:bg-white/10"><LogOut size={15} className="text-red-300" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 space-y-1 border-t border-white/5">
          {isAdminRole && (
            <button onClick={() => setSettingsOpen(true)} className="w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/5 text-gray-200">
              <Settings size={18} className="text-gold-300" /> Group settings
            </button>
          )}
          <button onClick={leaveGroup} className="w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/5 text-red-300">
            <LogOut size={18} /> Leave group
          </button>
        </div>
      </div>

      <AddMembersModal open={addOpen} onClose={() => setAddOpen(false)} chatId={chatId} existingIds={members.map((m) => m.user_id)} onDone={load} />
      <GroupSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} chat={chat} onSave={saveSettings} />
    </div>
  );
};

const AddMembersModal = ({ open, onClose, chatId, existingIds, onDone }: { open: boolean; onClose: () => void; chatId: string; existingIds: string[]; onDone: () => void }) => {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [added, setAdded] = useState<string[]>([]);

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    const { data } = await supabase.from('bg_profiles').select('*').or(`email.ilike.%${q}%,display_name.ilike.%${q}%`).neq('id', profile?.id ?? '').limit(20);
    setResults((data ?? []).filter((p) => !existingIds.includes(p.id)) as Profile[]);
  };

  const add = async (p: Profile) => {
    await supabase.from('bg_chat_members').insert({ chat_id: chatId, user_id: p.id, role: 'member' });
    setAdded((a) => [...a, p.id]);
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add members">
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-300/70" />
        <input autoFocus value={query} onChange={(e) => search(e.target.value)} placeholder="Search users..." className="input-gold w-full pl-10 pr-3 py-2.5 text-sm" />
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
        {results.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5">
            <Avatar name={p.display_name} src={p.avatar_url} size={38} />
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate block">{p.display_name}</span>
              <span className="text-xs text-gray-500">{p.email}</span>
            </div>
            {added.includes(p.id) ? (
              <Check size={18} className="text-green-400" />
            ) : (
              <button onClick={() => add(p)} className="px-3 py-1.5 rounded-full gold-bg text-ink-900 text-xs font-semibold">Add</button>
            )}
          </div>
        ))}
        {query.length >= 2 && results.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No new users found.</p>}
      </div>
    </Modal>
  );
};

const GroupSettingsModal = ({ open, onClose, chat, onSave }: { open: boolean; onClose: () => void; chat: Chat | null; onSave: (onlyAdmins: boolean, approve: boolean) => void }) => {
  const [onlyAdmins, setOnlyAdmins] = useState(chat?.only_admins_send ?? false);
  const [approve, setApprove] = useState(chat?.approve_members ?? false);
  return (
    <Modal open={open} onClose={onClose} title="Group settings"
      footer={<button onClick={() => onSave(onlyAdmins, approve)} className="btn-gold w-full py-2.5">Save</button>}>
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div><p className="font-medium text-sm">Only admins can send</p><p className="text-xs text-gray-500">Members can only read</p></div>
          <Toggle on={onlyAdmins} set={setOnlyAdmins} />
        </label>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div><p className="font-medium text-sm">Approve new members</p><p className="text-xs text-gray-500">Admins approve before joining</p></div>
          <Toggle on={approve} set={setApprove} />
        </label>
      </div>
    </Modal>
  );
};

const Toggle = ({ on, set }: { on: boolean; set: (v: boolean) => void }) => (
  <button onClick={() => set(!on)} className={`w-12 h-7 rounded-full transition relative ${on ? 'gold-bg' : 'bg-ink-700'}`}>
    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition ${on ? 'left-6' : 'left-1'}`} />
  </button>
);
