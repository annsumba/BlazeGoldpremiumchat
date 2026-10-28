import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Message, Profile, Chat, ChatMember } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { VerifiedBadge } from '@/components/Badges';
import { Ticks } from '@/components/Ticks';
import { Modal } from '@/components/Modal';
import { countryFlag, countryName } from '@/lib/countries';
import { formatChatTime, localTimeForCountry, translate, detectLang } from '@/lib/utils';
import type { IconType } from '@/lib/icons';
import {
  ArrowLeft, Phone, Video, MoreVertical, Send, Paperclip, Smile, Mic, Image as ImageIcon,
  Check, CheckCheck, Reply, Copy, Forward, Pencil, Trash2, Star, Info, Languages,
  Eye, X, Search, Pin, Users, Crown, Ban, Flag, Loader2, MapPin, FileText, Contact as ContactIcon,
  Bell, BellOff, Trash, Link as LinkIcon, Shield, ChevronDown, Camera,
} from 'lucide-react';

type Props = {
  chatId: string;
  onBack: () => void;
  onOpenGroupInfo: (chatId: string) => void;
};

const EMOJIS = ['😀','😂','😍','🥰','😎','🤩','😇','🤔','😢','😭','😡','👍','👎','👏','🙏','💪','🔥','💯','👑','⚡','🎉','❤️','💜','🧡','💛','💚','💙','🤍','🖤','✨','💎','🥇','🏆','☕','🍕','🍔','🍗','🎵','🎬','⚽','🏀','🏃','🚗','✈️','🌍','🌙','⭐','🌈'];

export const ChatRoom = ({ chatId, onBack, onOpenGroupInfo }: Props) => {
  const { profile } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [peer, setPeer] = useState<Profile | null>(null);
  const [typing, setTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [menuMsg, setMenuMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [searchInChat, setSearchInChat] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [burnTarget, setBurnTarget] = useState<Message | null>(null);
  const [viewOnceMsg, setViewOnceMsg] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelTyping = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const myMembership = members.find((m) => m.user_id === profile?.id);
  const isGroup = chat?.type === 'group';
  const isAdminRole = myMembership?.role === 'admin' || myMembership?.role === 'owner';

  const peerMember = !isGroup ? members.find((m) => m.user_id !== profile?.id) : null;

  const loadChat = useCallback(async () => {
    if (!profile) return;
    const { data: c } = await supabase.from('bg_chats').select('*').eq('id', chatId).maybeSingle();
    setChat(c as Chat | null);
    const { data: ms } = await supabase.from('bg_chat_members').select('*').eq('chat_id', chatId);
    setMembers((ms ?? []) as ChatMember[]);
    const ids = (ms ?? []).map((m) => m.user_id).filter((id) => id !== profile.id);
    if (ids.length) {
      const { data: profs } = await supabase.from('bg_profiles').select('*').in('id', ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p as Profile; });
      setMemberProfiles(map);
      if (!c || c.type === 'direct') {
        const pId = (ms ?? []).find((m) => m.user_id !== profile.id)?.user_id;
        if (pId) setPeer(map[pId] ?? null);
      }
    }
  }, [chatId, profile]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('bg_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data ?? []) as Message[]);
    setLoading(false);
    setTimeout(scrollToBottom, 50);
  }, [chatId]);

  const markRead = useCallback(async () => {
    if (!profile) return;
    await supabase
      .from('bg_chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', profile.id);
    // mark incoming messages read for sender's tick
    const incoming = messages.filter((m) => m.sender_id !== profile.id && m.status !== 'read');
    for (const m of incoming) {
      await supabase.from('bg_messages').update({ status: 'read' }).eq('id', m.id);
    }
  }, [profile, chatId, messages]);

  useEffect(() => {
    loadChat();
    loadMessages();
    // realtime
    const ch = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bg_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(scrollToBottom, 50);
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bg_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? (payload.new as Message) : m)));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bg_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
      )
      .subscribe();
    channelRef.current = ch;

    const typingCh = supabase
      .channel(`typing-${chatId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.userId !== profile?.id) setTyping(true);
        setTimeout(() => setTyping(false), 3000);
      })
      .on('broadcast', { event: 'stop-typing' }, (payload) => {
        if (payload.payload?.userId !== profile?.id) setTyping(false);
      })
      .subscribe();
    channelTyping.current = typingCh;

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(typingCh);
    };
  }, [chatId, profile?.id, loadChat, loadMessages]);

  useEffect(() => { if (!loading) markRead(); }, [messages.length, loading, markRead]);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const sendTyping = (typing: boolean) => {
    if (!channelTyping.current || !profile) return;
    channelTyping.current.send({ type: 'broadcast', event: typing ? 'typing' : 'stop-typing', payload: { userId: profile.id } });
  };

  const onType = (v: string) => {
    setText(v);
    sendTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sendTyping(false), 1500);
  };

  const send = async () => {
    if (!profile || !chat) return;
    if (editing) {
      if (text.trim() && Date.now() - new Date(editing.created_at).getTime() < 15 * 60 * 1000) {
        await supabase
          .from('bg_messages')
          .update({ text: text.trim(), edited_at: new Date().toISOString() })
          .eq('id', editing.id);
      }
      setEditing(null);
      setText('');
      setReplyTo(null);
      return;
    }
    if (!text.trim()) return;
    if (chat.only_admins_send && !isAdminRole) return;
    const msg = {
      chat_id: chatId,
      sender_id: profile.id,
      type: 'text' as const,
      text: text.trim(),
      reply_to_id: replyTo?.id ?? null,
      status: 'sent' as const,
    };
    setText('');
    setReplyTo(null);
    sendTyping(false);
    await supabase.from('bg_messages').insert(msg);
  };

  const sendAttachment = async (type: Message['type'], url: string, name = '') => {
    if (!profile) return;
    await supabase.from('bg_messages').insert({
      chat_id: chatId, sender_id: profile.id, type, text: '', attachment_url: url, attachment_name: name, status: 'sent',
    });
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>, viewOnce = false) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const path = `${chatId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('blazegold').upload(path, file);
    if (error) {
      // fallback: use object URL as preview-only (won't persist)
      const url = URL.createObjectURL(file);
      await sendAttachment('image', url, file.name);
      return;
    }
    const { data: pub } = supabase.storage.from('blazegold').getPublicUrl(path);
    await supabase.from('bg_messages').insert({
      chat_id: chatId, sender_id: profile.id, type: 'image', text: '', attachment_url: pub.publicUrl, attachment_name: file.name, is_view_once: viewOnce, status: 'sent',
    });
    setShowAttach(false);
  };

  const onPickDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const path = `${chatId}/${Date.now()}-${file.name}`;
    await supabase.storage.from('blazegold').upload(path, file);
    const { data: pub } = supabase.storage.from('blazegold').getPublicUrl(path);
    await sendAttachment('document', pub.publicUrl, file.name);
    setShowAttach(false);
  };

  const recordVoice = async () => {
    // simple: prompt user is not ideal; instead we record 5s via MediaRecorder
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const path = `${chatId}/voice-${Date.now()}.webm`;
        await supabase.storage.from('blazegold').upload(path, blob);
        const { data: pub } = supabase.storage.from('blazegold').getPublicUrl(path);
        await sendAttachment('voice', pub.publicUrl, 'voice.webm');
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      setTimeout(() => rec.stop(), 5000);
    } catch {
      alert('Microphone permission needed to record voice notes.');
    }
  };

  const openContext = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    setMenuMsg(msg);
    setContextPos({ x: e.clientX, y: e.clientY });
  };

  // Long press for mobile: show the action menu
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressMoved = useRef(false);

  const startLongPress = (e: React.TouchEvent, msg: Message) => {
    if (msg.deleted_by) return;
    longPressMoved.current = false;
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      if (!longPressMoved.current) {
        setMenuMsg(msg);
        setContextPos({ x: Math.min(startX, window.innerWidth - 220), y: Math.min(startY, window.innerHeight - 360) });
      }
    }, 500);
  };

  // Swipe right to reply
  const swipeState = useRef<Record<string, { startX: number; startY: number; deltaX: number }>>({});

  const onMsgTouchStart = (e: React.TouchEvent, msg: Message) => {
    const touch = e.touches[0];
    swipeState.current[msg.id] = { startX: touch.clientX, startY: touch.clientY, deltaX: 0 };
    startLongPress(e, msg);
  };

  const onMsgTouchMove = (e: React.TouchEvent, msg: Message) => {
    const st = swipeState.current[msg.id];
    if (!st) return;
    const touch = e.touches[0];
    st.deltaX = touch.clientX - st.startX;
    if (Math.abs(st.deltaX) > 10 || Math.abs(touch.clientY - st.startY) > 10) {
      longPressMoved.current = true;
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
  };

  const onMsgTouchEnd = (msg: Message) => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    const st = swipeState.current[msg.id];
    if (!st) return;
    if (st.deltaX > 60 && !msg.deleted_by) {
      setReplyTo(msg);
    }
    delete swipeState.current[msg.id];
  };

  // Desktop drag-to-reply (mouse swipe)
  const mouseSwipe = useRef<{ startX: number; msg: Message | null }>({ startX: 0, msg: null });

  const onMsgMouseDown = (e: React.MouseEvent, msg: Message) => {
    if (msg.deleted_by) return;
    mouseSwipe.current = { startX: e.clientX, msg };
  };

  const onMsgMouseUp = (e: React.MouseEvent) => {
    const ms = mouseSwipe.current;
    if (!ms.msg) return;
    const dx = e.clientX - ms.startX;
    if (dx > 60 && !ms.msg.deleted_by) {
      setReplyTo(ms.msg);
    }
    mouseSwipe.current = { startX: 0, msg: null };
  };

  const doAction = async (action: string) => {
    if (!menuMsg || !profile) return;
    const m = menuMsg;
    setMenuMsg(null);
    setContextPos(null);
    switch (action) {
      case 'reply':
        setReplyTo(m); break;
      case 'copy':
        navigator.clipboard?.writeText(m.text); break;
      case 'forward':
        // simple forward: copy text and prompt
        const targetEmail = prompt('Forward to (email):');
        if (targetEmail) {
          const { data: tp } = await supabase.from('bg_profiles').select('*').eq('email', targetEmail.trim()).maybeSingle();
          if (tp) {
            const { data: myM } = await supabase.from('bg_chat_members').select('chat_id').eq('user_id', profile.id);
            const ids = (myM ?? []).map((x) => x.chat_id);
            let chatIdF: string | null = null;
            if (ids.length) {
              const { data: pm } = await supabase.from('bg_chat_members').select('chat_id').in('chat_id', ids).eq('user_id', tp.id).maybeSingle();
              chatIdF = pm?.chat_id ?? null;
            }
            if (!chatIdF) {
              const { data: nc } = await supabase.from('bg_chats').insert({ type: 'direct', created_by: profile.id }).select('*').single();
              chatIdF = nc?.id ?? null;
              if (chatIdF) await supabase.from('bg_chat_members').insert([{ chat_id: chatIdF, user_id: profile.id, role: 'owner' }, { chat_id: chatIdF, user_id: tp.id, role: 'member' }]);
            }
            if (chatIdF) await supabase.from('bg_messages').insert({ chat_id: chatIdF, sender_id: profile.id, type: m.type, text: m.text, attachment_url: m.attachment_url, status: 'sent' });
          }
        }
        break;
      case 'edit':
        if (m.sender_id === profile.id && Date.now() - new Date(m.created_at).getTime() < 15 * 60 * 1000) {
          setEditing(m); setText(m.text); setReplyTo(null);
        }
        break;
      case 'delete-me':
        await supabase.from('bg_messages').update({ deleted_for: [...m.deleted_for, profile.id] }).eq('id', m.id);
        break;
      case 'delete-everyone':
        if (m.sender_id === profile.id && Date.now() - new Date(m.created_at).getTime() < 60 * 60 * 1000) {
          await supabase.from('bg_messages').update({ deleted_by: profile.id, text: '', attachment_url: '' }).eq('id', m.id);
        }
        break;
      case 'star':
        await supabase.from('bg_messages').update({ is_starred: !m.is_starred }).eq('id', m.id);
        break;
      case 'burn':
        setBurnTarget(m); break;
      case 'info':
        setInfoOpen(true); break;
    }
  };

  const doTranslate = async (m: Message) => {
    const lang = detectLang(m.text);
    const translated = translate(m.text, lang);
    await supabase.from('bg_messages').update({ original_text: m.text, translated_text: translated, target_lang: lang === 'en' ? 'sw' : 'en' }).eq('id', m.id);
  };

  const togglePin = async () => {
    if (!myMembership) return;
    await supabase.from('bg_chat_members').update({ is_pinned: !myMembership.is_pinned }).eq('id', myMembership.id);
    setHeaderMenu(false);
  };
  const toggleMute = async () => {
    if (!myMembership) return;
    await supabase.from('bg_chat_members').update({ is_muted: !myMembership.is_muted }).eq('id', myMembership.id);
    setHeaderMenu(false);
  };

  const reportUser = async () => {
    if (!peer || !profile) return;
    const reason = prompt('Report reason:');
    if (!reason) return;
    await supabase.from('bg_reports').insert({ reporter_id: profile.id, target_user_id: peer.id, reason });
    setHeaderMenu(false);
    alert('Report sent. Thank you.');
  };

  const burnMessage = async () => {
    if (!burnTarget) return;
    await supabase.rpc('bg_admin_burn_message', { p_message_id: burnTarget.id });
    setBurnTarget(null);
  };

  const filteredMsgs = searchQ
    ? messages.filter((m) => m.text.toLowerCase().includes(searchQ.toLowerCase()))
    : messages;

  const headerName = isGroup ? chat?.name : peer?.display_name ?? 'Chat';
  const headerSub = isGroup
    ? `${members.length} members`
    : peer
    ? peer.online ? 'online' : `last seen ${formatChatTime(peer.last_seen)}`
    : '';

  return (
    <div className="flex flex-col h-full bg-ink-900 relative" style={{ backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(255,215,0,0.05), transparent 50%)' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10 transition">
          <ArrowLeft size={20} className="text-gray-200" />
        </button>
        <button onClick={() => isGroup && onOpenGroupInfo(chatId)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          {isGroup ? (
            <div className="w-10 h-10 rounded-full gold-gradient-soft border border-gold-300/30 flex items-center justify-center text-gold-300 font-bold shrink-0">
              {(chat?.name ?? 'G').slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <Avatar name={peer?.display_name ?? 'G'} src={peer?.avatar_url} size={40} ring={peer?.is_verified ? 'gold' : 'none'} showOnlineDot online={peer?.online} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold truncate text-white">{headerName}</span>
              {!isGroup && peer && <span>{countryFlag(peer.country)}</span>}
              {!isGroup && peer?.is_verified && <VerifiedBadge size={12} />}
              {isGroup && <Users size={13} className="text-gold-300" />}
            </div>
            <p className="text-xs text-gray-400 truncate">
              {typing ? <span className="text-gold-300">typing...</span> : headerSub}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          {!isGroup && (
            <>
              <button onClick={() => alert('Calls coming soon to BlazeGold')} className="p-2 rounded-full hover:bg-white/10 transition"><Phone size={18} className="text-gold-300" /></button>
              <button onClick={() => alert('Video calls coming soon')} className="p-2 rounded-full hover:bg-white/10 transition hidden sm:block"><Video size={18} className="text-gold-300" /></button>
            </>
          )}
          <div className="relative">
            <button onClick={() => setHeaderMenu((m) => !m)} className="p-2 rounded-full hover:bg-white/10 transition">
              <MoreVertical size={18} className="text-gray-300" />
            </button>
            {headerMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setHeaderMenu(false)} />
                <div className="absolute right-0 mt-1 w-56 card shadow-gold z-20 py-1 animate-slide-up">
                  <HMenu icon={Search} label="Search in chat" onClick={() => { setSearchInChat(true); setHeaderMenu(false); }} />
                  <HMenu icon={Pin} label={myMembership?.is_pinned ? 'Unpin chat' : 'Pin chat'} onClick={togglePin} />
                  <HMenu icon={myMembership?.is_muted ? Bell : BellOff} label={myMembership?.is_muted ? 'Unmute' : 'Mute'} onClick={toggleMute} />
                  {isGroup && <HMenu icon={Info} label="Group info" onClick={() => { onOpenGroupInfo(chatId); setHeaderMenu(false); }} />}
                  {!isGroup && peer && <HMenu icon={Flag} label="Report user" onClick={reportUser} danger />}
                  {!isGroup && peer && profile?.is_admin && <HMenu icon={Shield} label="View as Ghost (Admin)" onClick={() => setHeaderMenu(false)} />}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {searchInChat && (
        <div className="px-3 py-2 glass border-b border-gold-300/10 flex items-center gap-2">
          <Search size={16} className="text-gold-300" />
          <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search messages..." className="flex-1 bg-transparent outline-none text-sm" />
          <button onClick={() => { setSearchInChat(false); setSearchQ(''); }}><X size={16} className="text-gray-400" /></button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="animate-spin text-gold-300" size={20} /></div>
        ) : filteredMsgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Crown size={32} className="text-gold-300/60" />
            <p className="mt-2 text-sm">Say hello in gold 👑</p>
          </div>
        ) : (
          filteredMsgs.map((m, i) => {
            const mine = m.sender_id === profile?.id;
            const sender = memberProfiles[m.sender_id] ?? (m.sender_id === profile?.id ? profile : null);
            const isDeletedForMe = m.deleted_for.includes(profile?.id ?? '');
            const isDeletedAll = !!m.deleted_by;
            const showAvatar = isGroup && !mine;
            const prev = filteredMsgs[i - 1];
            const grouped = prev && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60000;
            if (isDeletedForMe) return null;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-2'}`}>
                {showAvatar && (grouped ? <div className="w-8" /> : <Avatar name={sender?.display_name ?? 'U'} src={sender?.avatar_url} size={32} />)}
                <div
                  onContextMenu={(e) => !isDeletedAll && openContext(e, m)}
                  onTouchStart={(e) => !isDeletedAll && onMsgTouchStart(e, m)}
                  onTouchMove={(e) => !isDeletedAll && onMsgTouchMove(e, m)}
                  onTouchEnd={() => !isDeletedAll && onMsgTouchEnd(m)}
                  onMouseDown={(e) => !isDeletedAll && onMsgMouseDown(e, m)}
                  onMouseUp={(e) => !isDeletedAll && onMsgMouseUp(e)}
                  className={`relative max-w-[78%] sm:max-w-[65%] px-3 py-2 text-sm rounded-2xl cursor-pointer select-none transition-transform ${
                    mine
                      ? 'gold-bg text-ink-900 rounded-br-md'
                      : 'bg-ink-800 text-white rounded-bl-md border border-white/5'
                  } ${m.is_starred ? 'ring-1 ring-gold-300' : ''}`}
                >
                  {isGroup && !mine && !grouped && (
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-xs font-semibold text-gold-300">{sender?.display_name ?? 'User'}</span>
                      {sender?.is_verified && <VerifiedBadge size={10} />}
                    </div>
                  )}
                  {m.reply_to_id && (() => {
                    const r = messages.find((x) => x.id === m.reply_to_id);
                    return r ? (
                      <div className={`mb-1 px-2 py-1 rounded-lg text-xs border-l-2 ${mine ? 'bg-ink-900/20 border-ink-900' : 'bg-gold-300/10 border-gold-300'}`}>
                        <p className="font-semibold opacity-80">{memberProfiles[r.sender_id]?.display_name ?? (r.sender_id === profile?.id ? 'You' : 'User')}</p>
                        <p className="truncate opacity-70">{r.text || `[${r.type}]`}</p>
                      </div>
                    ) : null;
                  })()}
                  {isDeletedAll ? (
                    <span className="italic opacity-60">🚫 This message was removed</span>
                  ) : m.type === 'image' ? (
                    m.is_view_once ? (
                      <button onClick={() => setViewOnceMsg(m)} className="block">
                        <div className="flex items-center gap-2 px-2 py-3 rounded-lg bg-ink-900/30">
                          <Eye size={18} /> <span>View once photo</span>
                        </div>
                      </button>
                    ) : (
                      <img src={m.attachment_url} alt="" className="rounded-lg max-w-full max-h-60 border-2 border-gold-300/40" />
                    )
                  ) : m.type === 'voice' ? (
                    <div className="flex items-center gap-2 py-1">
                      <Mic size={16} /> <span>Voice note</span>
                      <audio controls src={m.attachment_url} className="h-7 max-w-[180px]" />
                    </div>
                  ) : m.type === 'document' ? (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-1 underline">
                      <FileText size={16} /> {m.attachment_name || 'Document'}
                    </a>
                  ) : m.type === 'location' ? (
                    <div className="flex items-center gap-2 py-1"><MapPin size={16} /> Location shared</div>
                  ) : m.type === 'contact' ? (
                    <div className="flex items-center gap-2 py-1"><ContactIcon size={16} /> {m.text}</div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      {m.translated_text && (
                        <p className={`mt-1 text-xs italic ${mine ? 'text-ink-900/70' : 'text-gold-200'}`}>
                          🌐 {m.translated_text}
                        </p>
                      )}
                    </>
                  )}
                  <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${mine ? 'text-ink-900/70' : 'text-gray-400'}`}>
                    {m.edited_at && <span>edited</span>}
                    {m.is_starred && <Star size={10} className="text-gold-400" fill="#FFD700" />}
                    <span>{formatChatTime(m.created_at)}</span>
                    <Ticks status={m.status} mine={mine} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-3 py-2 bg-ink-850 border-t border-gold-300/15 flex items-center gap-2">
          <Reply size={16} className="text-gold-300" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gold-300 font-semibold">Replying to {memberProfiles[replyTo.sender_id]?.display_name ?? 'user'}</p>
            <p className="text-xs text-gray-400 truncate">{replyTo.text || `[${replyTo.type}]`}</p>
          </div>
          <button onClick={() => setReplyTo(null)}><X size={16} className="text-gray-400" /></button>
        </div>
      )}
      {editing && (
        <div className="px-3 py-2 bg-ink-850 border-t border-gold-300/15 flex items-center gap-2">
          <Pencil size={16} className="text-gold-300" />
          <p className="text-xs text-gold-300 flex-1">Editing message</p>
          <button onClick={() => { setEditing(null); setText(''); }}><X size={16} className="text-gray-400" /></button>
        </div>
      )}

      {/* Emoji panel */}
      {showEmoji && (
        <div className="px-3 py-2 bg-ink-850 border-t border-gold-300/10 grid grid-cols-9 gap-1 max-h-40 overflow-y-auto scrollbar-thin">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => { setText((t) => t + e); }} className="text-xl p-1.5 rounded hover:bg-white/10">{e}</button>
          ))}
        </div>
      )}

      {/* Attach panel */}
      {showAttach && (
        <div className="px-4 py-3 bg-ink-850 border-t border-gold-300/10 grid grid-cols-4 gap-3">
          <AttachBtn icon={ImageIcon} label="Photo" color="bg-purple-500/20 text-purple-300" >
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e)} />
          </AttachBtn>
          <AttachBtn icon={Eye} label="View Once" color="bg-pink-500/20 text-pink-300">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e, true)} />
          </AttachBtn>
          <AttachBtn icon={FileText} label="Document" color="bg-blue-500/20 text-blue-300">
            <input type="file" className="hidden" onChange={onPickDoc} />
          </AttachBtn>
          <AttachBtn icon={Mic} label="Voice" color="bg-orange-500/20 text-orange-300" onClick={recordVoice} />
        </div>
      )}

      {/* Composer */}
      <div className="px-3 py-2.5 bg-ink-850 border-t border-gold-300/10 flex items-end gap-2">
        <button onClick={() => { setShowEmoji((s) => !s); setShowAttach(false); }} className="p-2 rounded-full hover:bg-white/10 transition">
          <Smile size={22} className="text-gold-300" />
        </button>
        <button onClick={() => { setShowAttach((s) => !s); setShowEmoji(false); }} className="p-2 rounded-full hover:bg-white/10 transition">
          <Paperclip size={22} className="text-gold-300" />
        </button>
        <textarea
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={chat?.only_admins_send && !isAdminRole ? 'Only admins can send...' : 'Message...'}
          rows={1}
          className="flex-1 bg-ink-800 border border-gold-300/10 rounded-2xl px-3 py-2.5 text-sm resize-none outline-none focus:border-gold-300/40 max-h-24"
        />
        {text.trim() ? (
          <button onClick={send} className="w-11 h-11 rounded-full gold-bg text-ink-900 flex items-center justify-center shadow-gold-sm shrink-0">
            <Send size={18} />
          </button>
        ) : (
          <button onClick={recordVoice} className="w-11 h-11 rounded-full gold-bg text-ink-900 flex items-center justify-center shadow-gold-sm shrink-0">
            <Mic size={18} />
          </button>
        )}
      </div>

      {/* Context menu */}
      {menuMsg && contextPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setMenuMsg(null); setContextPos(null); }} />
          <div
            className="fixed z-50 card shadow-gold-lg py-1 w-52 animate-slide-up"
            style={{ left: Math.min(contextPos.x, window.innerWidth - 220), top: Math.min(contextPos.y, window.innerHeight - 360) }}
          >
            <CMenu icon={Reply} label="Reply" onClick={() => doAction('reply')} />
            <CMenu icon={Copy} label="Copy" onClick={() => doAction('copy')} />
            {menuMsg.sender_id === profile?.id && Date.now() - new Date(menuMsg.created_at).getTime() < 15 * 60 * 1000 && menuMsg.type === 'text' && (
              <CMenu icon={Pencil} label="Edit" onClick={() => doAction('edit')} />
            )}
            <CMenu icon={Trash2} label={menuMsg.sender_id === profile?.id ? 'Delete' : 'Delete for me'} onClick={() => doAction('delete-me')} danger />
            {menuMsg.sender_id === profile?.id && Date.now() - new Date(menuMsg.created_at).getTime() < 60 * 60 * 1000 && (
              <CMenu icon={Trash2} label="Delete for everyone" onClick={() => doAction('delete-everyone')} danger />
            )}
            <CMenu icon={Forward} label="Forward" onClick={() => doAction('forward')} />
            <CMenu icon={Languages} label="Auto-translate (SW↔EN)" onClick={() => { doTranslate(menuMsg); setMenuMsg(null); setContextPos(null); }} />
            <CMenu icon={Star} label={menuMsg.is_starred ? 'Unstar' : 'Star'} onClick={() => doAction('star')} />
            <CMenu icon={Info} label="Info" onClick={() => doAction('info')} />
            {profile?.is_admin && (
              <CMenu icon={Crown} label="Burn (admin)" onClick={() => doAction('burn')} gold />
            )}
          </div>
        </>
      )}

      {/* Message info modal */}
      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="Message info">
        {menuMsg && (
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-400">Sent:</span> {new Date(menuMsg.created_at).toLocaleString()}</div>
            {menuMsg.edited_at && <div><span className="text-gray-400">Edited:</span> {new Date(menuMsg.edited_at).toLocaleString()}</div>}
            <div><span className="text-gray-400">Status:</span> <span className="capitalize text-gold-300">{menuMsg.status}</span></div>
            <div><span className="text-gray-400">Type:</span> <span className="capitalize">{menuMsg.type}</span></div>
          </div>
        )}
      </Modal>

      {/* Burn confirm */}
      <Modal open={!!burnTarget} onClose={() => setBurnTarget(null)} title="Burn message"
        footer={<div className="flex gap-2"><button onClick={() => setBurnTarget(null)} className="btn-ghost flex-1 py-2.5">Cancel</button><button onClick={burnMessage} className="btn-gold flex-1 py-2.5">Burn permanently</button></div>}>
        <p className="text-sm text-gray-300">Burning removes this message everywhere with no trace. This cannot be undone.</p>
      </Modal>

      {/* View once image */}
      <Modal open={!!viewOnceMsg} onClose={() => setViewOnceMsg(null)} title="View once">
        {viewOnceMsg && <img src={viewOnceMsg.attachment_url} alt="" className="rounded-lg max-w-full" />}
        <p className="text-xs text-gray-400 mt-2">This photo closes when you dismiss it.</p>
      </Modal>
    </div>
  );
};

const HMenu = ({ icon: Icon, label, onClick, danger }: { icon: IconType; label: string; onClick: () => void; danger?: boolean }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition text-left ${danger ? 'text-red-300' : 'text-gray-200'}`}>
    <Icon size={16} /> {label}
  </button>
);
const CMenu = ({ icon: Icon, label, onClick, danger, gold }: { icon: IconType; label: string; onClick: () => void; danger?: boolean; gold?: boolean }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition text-left ${danger ? 'text-red-300' : gold ? 'text-gold-300' : 'text-gray-200'}`}>
    <Icon size={16} /> {label}
  </button>
);

const AttachBtn = ({ icon: Icon, label, color, children, onClick }: { icon: IconType; label: string; color: string; children?: React.ReactNode; onClick?: () => void }) => (
  <label className={`flex flex-col items-center gap-1.5 py-3 rounded-xl ${color} cursor-pointer hover:opacity-80 transition`}>
    <Icon size={22} />
    <span className="text-xs">{label}</span>
    {onClick ? <button onClick={onClick} className="hidden" /> : children}
  </label>
);
