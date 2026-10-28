import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { VerifiedBadge } from '@/components/Badges';
import { COUNTRIES, countryFlag } from '@/lib/countries';
import { Search, Users, MessageCircle, X, Crown, Loader2 } from 'lucide-react';
import type { Profile } from '@/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onChatStarted: (chatId: string) => void;
};

export const NewChatModal = ({ open, onClose, onChatStarted }: Props) => {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Profile[]>([]);

  // group form
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('bg_profiles')
      .select('*')
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', profile?.id ?? '')
      .limit(20);
    setResults((data ?? []) as Profile[]);
    setSearching(false);
  };

  const startDirect = async (peer: Profile) => {
    if (!profile) return;
    // find existing direct chat with this peer
    const { data: myMembers } = await supabase
      .from('bg_chat_members')
      .select('chat_id')
      .eq('user_id', profile.id);
    const myChatIds = (myMembers ?? []).map((m) => m.chat_id);
    if (myChatIds.length) {
      const { data: peerMembers } = await supabase
        .from('bg_chat_members')
        .select('chat_id, user_id')
        .in('chat_id', myChatIds)
        .eq('user_id', peer.id)
        .maybeSingle();
      if (peerMembers) {
        onChatStarted(peerMembers.chat_id);
        return;
      }
    }
    // create new direct chat
    const { data: chat, error } = await supabase
      .from('bg_chats')
      .insert({ type: 'direct', created_by: profile.id })
      .select('*')
      .single();
    if (error || !chat) return;
    await supabase.from('bg_chat_members').insert([
      { chat_id: chat.id, user_id: profile.id, role: 'owner' },
      { chat_id: chat.id, user_id: peer.id, role: 'member' },
    ]);
    onChatStarted(chat.id);
  };

  const toggleSelect = (p: Profile) => {
    setSelected((s) => (s.find((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]));
  };

  const createGroup = async () => {
    if (!profile || !groupName.trim() || selected.length === 0) return;
    setCreating(true);
    const code = Math.random().toString(36).slice(2, 10);
    const { data: chat, error } = await supabase
      .from('bg_chats')
      .insert({ type: 'group', name: groupName.trim(), description: groupDesc.trim(), created_by: profile.id, invite_code: code })
      .select('*')
      .single();
    if (error || !chat) { setCreating(false); return; }
    const members = [
      { chat_id: chat.id, user_id: profile.id, role: 'owner' as const },
      ...selected.map((s) => ({ chat_id: chat.id, user_id: s.id, role: 'member' as const })),
    ];
    await supabase.from('bg_chat_members').insert(members);
    setCreating(false);
    reset();
    onChatStarted(chat.id);
  };

  const reset = () => {
    setQuery(''); setResults([]); setSelected([]); setGroupName(''); setGroupDesc(''); setTab('direct');
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New Chat">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('direct')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
            tab === 'direct' ? 'gold-bg text-ink-900' : 'bg-white/5 text-gray-300'
          }`}
        >
          <MessageCircle size={16} /> Direct
        </button>
        <button
          onClick={() => setTab('group')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
            tab === 'group' ? 'gold-bg text-ink-900' : 'bg-white/5 text-gray-300'
          }`}
        >
          <Users size={16} /> Group
        </button>
      </div>

      {tab === 'direct' ? (
        <>
          <div className="relative mb-3">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-300/70" />
            <input
              autoFocus
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search by name or email..."
              className="input-gold w-full pl-10 pr-3 py-2.5 text-sm"
            />
          </div>
          {searching && <p className="text-sm text-gray-500 px-1 py-2">Searching...</p>}
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => { startDirect(p); reset(); onClose(); }}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition text-left"
              >
                <Avatar name={p.display_name} src={p.avatar_url} size={42} ring={p.is_verified ? 'gold' : 'none'} showOnlineDot online={p.online} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{p.display_name}</span>
                    {p.is_verified && <VerifiedBadge size={12} />}
                    {p.is_admin && <Crown size={13} className="text-gold-300" />}
                    <span className="ml-auto text-sm">{countryFlag(p.country)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{p.email}</p>
                </div>
              </button>
            ))}
            {query.length >= 2 && !searching && results.length === 0 && (
              <p className="text-sm text-gray-500 px-2 py-6 text-center">No users found. Try another name or email.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 ml-1">Group name</label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="My Gold Squad"
                className="input-gold w-full px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 ml-1">Description (optional)</label>
              <input
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="What's this group about?"
                className="input-gold w-full px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="relative mb-3">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-300/70" />
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Add members by name or email..."
              className="input-gold w-full pl-10 pr-3 py-2.5 text-sm"
            />
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selected.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full gold-gradient-soft border border-gold-300/30 text-sm">
                  <Avatar name={p.display_name} size={22} />
                  {p.display_name}
                  <button onClick={() => toggleSelect(p)} className="text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
            {results.map((p) => {
              const sel = selected.find((x) => x.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition text-left ${sel ? 'gold-gradient-soft' : 'hover:bg-white/5'}`}
                >
                  <Avatar name={p.display_name} src={p.avatar_url} size={38} showOnlineDot online={p.online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{p.display_name}</span>
                      <span className="ml-auto text-sm">{countryFlag(p.country)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{p.email}</p>
                  </div>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${sel ? 'gold-bg border-gold-300' : 'border-gray-600'}`}>
                    {sel && <span className="text-ink-900 text-xs font-bold">✓</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={createGroup}
            disabled={!groupName.trim() || selected.length === 0 || creating}
            className="btn-gold w-full py-3 mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <Crown size={16} />}
            Create Group ({selected.length} members)
          </button>
        </>
      )}
    </Modal>
  );
};
