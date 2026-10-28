import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Status, Profile, LinkTask, TaskCompletion } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { VerifiedBadge } from '@/components/Badges';
import { countryFlag } from '@/lib/countries';
import { formatChatTime } from '@/lib/utils';
import { ArrowLeft, Plus, Pencil, Eye, X, Crown, Loader2, Send, Sparkles, Trash2, ChevronLeft, ChevronRight, Link2, Play, Camera, Check, Upload, ExternalLink, Clock, Coins } from 'lucide-react';

const STATUS_GRADIENTS = [
  { label: 'Gold', grad: 'linear-gradient(160deg, #FFD700 0%, #FFA500 100%)' },
  { label: 'Sunset', grad: 'linear-gradient(160deg, #FF6A00 0%, #FF2D55 100%)' },
  { label: 'Ocean', grad: 'linear-gradient(160deg, #2563EB 0%, #7C3AED 100%)' },
  { label: 'Forest', grad: 'linear-gradient(160deg, #10B981 0%, #064E3B 100%)' },
  { label: 'Berry', grad: 'linear-gradient(160deg, #8B5CF6 0%, #DB2777 100%)' },
];
const EMOJIS = ['👑', '⚡', '🔥', '💎', '✨', '🎉', '❤️', '🥇', '🏆', '🇰🇪'];

const PLATFORMS = [
  'youtube', 'tiktok', 'instagram', 'twitter', 'snapchat', 'facebook', 'linkedin', 'other',
];

export const StatusScreen = ({ onBack, onOpenChat }: { onBack: () => void; onOpenChat: (chatId: string) => void }) => {
  const { profile } = useAuth();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [tasks, setTasks] = useState<LinkTask[]>([]);
  const [taskProfiles, setTaskProfiles] = useState<Record<string, Profile>>({});
  const [myCompletions, setMyCompletions] = useState<Record<string, TaskCompletion>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [views, setViews] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTab, setComposerTab] = useState<'text' | 'link'>('text');
  const [viewing, setViewing] = useState<{ items: Status[]; idx: number; ownerId: string } | null>(null);
  const [textStatus, setTextStatus] = useState('');
  const [bgColor, setBgColor] = useState(0);
  const [posting, setPosting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [zoom, setZoom] = useState(1);
  const pinchDist = useRef(0);

  // Link task composer state
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPlatform, setLinkPlatform] = useState('youtube');
  const [linkTitle, setLinkTitle] = useState('');

  const load = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase.from('bg_status').select('*').gt('expires_at', now).order('created_at', { ascending: false });
    const all = (data ?? []) as Status[];
    setStatuses(all);
    const ids = Array.from(new Set(all.map((s) => s.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from('bg_profiles').select('*').in('id', ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as Profile));
      setProfiles(map);
    }
    const vMap: Record<string, number> = {};
    if (all.length) {
      const { data: vs } = await supabase.from('bg_status_views').select('status_id').in('status_id', all.map((s) => s.id));
      (vs ?? []).forEach((v) => { vMap[v.status_id] = (vMap[v.status_id] ?? 0) + 1; });
    }
    setViews(vMap);

    // Load approved link tasks
    const { data: taskData } = await supabase
      .from('bg_link_tasks')
      .select('*')
      .eq('is_approved', true)
      .eq('is_active', true)
      .gt('expires_at', now)
      .order('created_at', { ascending: false });
    const taskList = (taskData ?? []) as LinkTask[];
    setTasks(taskList);
    const tIds = Array.from(new Set(taskList.map((t) => t.user_id)));
    if (tIds.length) {
      const { data: tProfs } = await supabase.from('bg_profiles').select('*').in('id', tIds);
      const tMap: Record<string, Profile> = {};
      (tProfs ?? []).forEach((p) => (tMap[p.id] = p as Profile));
      setTaskProfiles(tMap);
    }

    // Load my completions
    if (profile) {
      const { data: comps } = await supabase.from('bg_task_completions').select('*').eq('user_id', profile.id);
      const cMap: Record<string, TaskCompletion> = {};
      (comps ?? []).forEach((c) => { cMap[c.task_id] = c as TaskCompletion; });
      setMyCompletions(cMap);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const byUser = new Map<string, Status[]>();
  statuses.forEach((s) => {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  });
  const grouped: { user: Profile | null; items: Status[] }[] = [];
  byUser.forEach((items, uid) => grouped.push({ user: profiles[uid] ?? null, items }));

  const sponsored = statuses.filter((s) => s.is_sponsored);
  const myStatuses = grouped.find((g) => g.user?.id === profile?.id)?.items ?? [];
  const others = grouped.filter((g) => g.user?.id !== profile?.id);

  const postText = async () => {
    if (!profile || !textStatus.trim()) return;
    setPosting(true);
    await supabase.from('bg_status').insert({ user_id: profile.id, type: 'text', text: textStatus.trim(), bg_color: String(bgColor) });
    setTextStatus(''); setBgColor(0); setPosting(false); setComposerOpen(false);
    load();
  };

  const postLinkTask = async () => {
    if (!profile || !linkUrl.trim()) return;
    setPosting(true);
    const { error } = await supabase.from('bg_link_tasks').insert({
      user_id: profile.id,
      link_url: linkUrl.trim(),
      platform: linkPlatform,
      title: linkTitle.trim() || `Follow + View 2 videos`,
      reward_coins: 2,
      is_approved: false,
      screenshot_required: true,
    });
    setPosting(false);
    if (error) { alert('Could not post link task. Please try again.'); return; }
    setLinkUrl(''); setLinkTitle(''); setLinkPlatform('youtube'); setComposerOpen(false);
    alert('Link task submitted! An admin will review and approve it shortly.');
    load();
  };

  const openViewer = (group: { user: Profile | null; items: Status[] }, idx = 0) => {
    setZoom(1);
    setViewing({ items: group.items, idx, ownerId: group.user?.id ?? group.items[0].user_id });
    recordView(group.items[idx]);
  };

  const recordView = (s: Status) => {
    if (profile && s.user_id !== profile.id) {
      supabase.from('bg_status_views').upsert({ status_id: s.id, viewer_id: profile.id }).then(() => load());
    }
  };

  const next = () => {
    if (!viewing) return;
    setZoom(1);
    if (viewing.idx + 1 < viewing.items.length) {
      const ni = viewing.idx + 1;
      setViewing({ ...viewing, idx: ni });
      recordView(viewing.items[ni]);
    } else {
      setViewing(null);
    }
  };
  const prev = () => {
    if (!viewing || viewing.idx === 0) return;
    setZoom(1);
    const pi = viewing.idx - 1;
    setViewing({ ...viewing, idx: pi });
  };

  const deleteStatus = async (id: string) => {
    await supabase.from('bg_status').delete().eq('id', id);
    setViewing(null);
    load();
  };

  const sendReply = async () => {
    if (!profile || !current || !replyText.trim()) return;
    const peerId = current.user_id;
    if (peerId === profile.id) return;
    setSendingReply(true);
    try {
      const { data: myMembers } = await supabase.from('bg_chat_members').select('chat_id').eq('user_id', profile.id);
      const myChatIds = (myMembers ?? []).map((m) => m.chat_id);
      let chatId: string | null = null;
      if (myChatIds.length) {
        const { data: peerMember } = await supabase.from('bg_chat_members').select('chat_id').in('chat_id', myChatIds).eq('user_id', peerId).maybeSingle();
        chatId = peerMember?.chat_id ?? null;
      }
      if (!chatId) {
        const { data: chat, error } = await supabase.from('bg_chats').insert({ type: 'direct', created_by: profile.id }).select('*').single();
        if (error || !chat) { setSendingReply(false); return; }
        chatId = chat.id;
        await supabase.from('bg_chat_members').insert([
          { chat_id: chatId, user_id: profile.id, role: 'owner' },
          { chat_id: chatId, user_id: peerId, role: 'member' },
        ]);
      }
      const statusPreview = current.type === 'text' ? current.text : 'Status';
      const body = `↩️ Replied to your status "${statusPreview.slice(0, 40)}":\n${replyText.trim()}`;
      const finalChatId = chatId as string;
      await supabase.from('bg_messages').insert({ chat_id: finalChatId, sender_id: profile.id, type: 'text', text: body, status: 'sent' });
      setReplyText('');
      setViewing(null);
      onOpenChat(finalChatId);
    } catch {
      alert('Could not send reply. Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const expiryLabel = (s: Status): string => {
    const ms = new Date(s.expires_at).getTime() - Date.now();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  const current = viewing ? viewing.items[viewing.idx] : null;

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <span className="font-semibold">Gold Status</span>
        <span className="ml-auto text-xs text-gold-300/70">disappears in 24h</span>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* My status */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="w-full flex items-center gap-3">
            <button
              onClick={() => myStatuses.length ? openViewer({ user: profile, items: myStatuses }) : setComposerOpen(true)}
              className="relative shrink-0"
            >
              <Avatar name={profile?.display_name ?? 'Me'} src={profile?.avatar_url} size={52} ring="status" />
              <span
                onClick={(e) => { e.stopPropagation(); setComposerOpen(true); setComposerTab('text'); }}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full gold-bg text-ink-900 flex items-center justify-center border-2 border-ink-900 cursor-pointer hover:scale-110 transition"
              >
                <Plus size={14} />
              </span>
            </button>
            <button onClick={() => myStatuses.length ? openViewer({ user: profile, items: myStatuses }) : setComposerOpen(true)} className="text-left flex-1 min-w-0">
              <p className="font-semibold">My status</p>
              <p className="text-xs text-gray-400">{myStatuses.length ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''} · ${expiryLabel(myStatuses[0])}` : 'Tap to add status'}</p>
            </button>
          </div>
        </div>

        {/* Photo Status Coming Soon banner */}
        <div className="mx-4 mt-3 rounded-xl bg-blue-500/10 border border-blue-400/20 px-4 py-3 flex items-center gap-2">
          <Camera size={18} className="text-blue-400 shrink-0" />
          <p className="text-sm text-blue-300">Photo Status Coming Soon</p>
        </div>

        {/* Link Tasks section */}
        <div className="px-4 pt-4 pb-1 text-xs text-gold-300/70 font-medium flex items-center gap-1.5">
          <Link2 size={12} /> LINK TASKS — earn coins
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gold-300" /></div>
        ) : tasks.length === 0 ? (
          <div className="px-4 py-3">
            <p className="text-sm text-gray-500">No link tasks available right now. Check back soon!</p>
          </div>
        ) : (
          <div className="px-4 py-2 space-y-3">
            {tasks.map((task) => {
              const comp = myCompletions[task.id];
              const advertiser = taskProfiles[task.user_id];
              return (
                <LinkTaskCard
                  key={task.id}
                  task={task}
                  advertiser={advertiser ?? null}
                  completion={comp ?? null}
                />
              );
            })}
          </div>
        )}

        {/* Sponsored */}
        {sponsored.length > 0 && (
          <>
            <div className="px-4 pt-4 pb-1 text-xs text-gold-300/70 font-medium">SPONSORED</div>
            {sponsored.map((s) => (
              <button key={s.id} onClick={() => openViewer({ user: profiles[s.user_id], items: [s] })} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left">
                <div className="relative">
                  <Avatar name="Sponsored" size={52} ring="status" />
                  <Crown size={16} className="absolute -top-1 -right-1 text-gold-300 bg-ink-900 rounded-full p-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate gold-text">{s.sponsor_name || 'Sponsored'}</p>
                  <p className="text-xs text-gray-400 truncate">{s.text || 'Tap to view'}</p>
                </div>
                <span className="text-xs text-gray-500">{views[s.id] ?? 0} views</span>
              </button>
            ))}
          </>
        )}

        <div className="px-4 pt-4 pb-1 text-xs text-gold-300/70 font-medium">RECENT UPDATES</div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gold-300" /></div>
        ) : others.length === 0 && sponsored.length === 0 ? (
          <div className="flex flex-col items-center py-16 px-6 text-center">
            <Sparkles size={32} className="text-gold-300/60" />
            <p className="mt-2 text-sm text-gray-400">No status updates yet. Be the first to share gold!</p>
          </div>
        ) : (
          others.map((g) => (
            <button key={g.user?.id} onClick={() => openViewer(g)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left border-b border-white/[0.02]">
              <Avatar name={g.user?.display_name ?? 'U'} src={g.user?.avatar_url} size={52} ring="status" showOnlineDot online={g.user?.online} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold truncate">{g.user?.display_name ?? 'User'}</span>
                  {g.user?.is_verified && <VerifiedBadge size={12} />}
                  <span className="text-sm">{g.user ? countryFlag(g.user.country) : ''}</span>
                </div>
                <p className="text-xs text-gray-400">{g.items.length} update{g.items.length > 1 ? 's' : ''} · {expiryLabel(g.items[0])}</p>
              </div>
            </button>
          ))
        )}
      </div>

      <button onClick={() => { setComposerOpen(true); setComposerTab('text'); }} className="absolute bottom-5 right-5 w-14 h-14 rounded-full gold-bg text-ink-900 shadow-gold-lg flex items-center justify-center z-20">
        <Pencil size={22} />
      </button>

      {/* Composer */}
      <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title="New Gold Status">
        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-2 bg-white/5 rounded-xl p-1">
            <button onClick={() => setComposerTab('text')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${composerTab === 'text' ? 'gold-bg text-ink-900' : 'text-gray-300'}`}>
              Text Status
            </button>
            <button onClick={() => setComposerTab('link')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${composerTab === 'link' ? 'gold-bg text-ink-900' : 'text-gray-300'}`}>
              <Link2 size={14} /> Link Task
            </button>
          </div>

          {composerTab === 'text' ? (
            <>
              <div className="rounded-2xl p-6 min-h-[200px] flex items-center justify-center relative overflow-hidden" style={{ background: STATUS_GRADIENTS[bgColor].grad }}>
                <textarea autoFocus value={textStatus} onChange={(e) => setTextStatus(e.target.value)} placeholder="Share your golden moment..." rows={3} className="w-full bg-transparent text-center text-[28px] leading-snug font-display font-bold text-white outline-none resize-none placeholder:text-white/60" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.55)' }} />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2 ml-1">Background color</p>
                <div className="flex gap-2.5 items-center">
                  {STATUS_GRADIENTS.map((g, i) => (
                    <button key={g.label} onClick={() => setBgColor(i)} title={g.label} className={`w-9 h-9 rounded-full border-2 transition ${bgColor === i ? 'border-gold-300 scale-110 shadow-gold-sm' : 'border-white/20'}`} style={{ background: g.grad }} />
                  ))}
                  <div className="flex gap-1 ml-auto">
                    {EMOJIS.slice(0, 5).map((e) => (
                      <button key={e} onClick={() => setTextStatus((t) => t + e)} className="text-lg w-8 h-8 rounded-full hover:bg-white/10">{e}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={postText} disabled={!textStatus.trim() || posting} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Post status
              </button>
            </>
          ) : (
            <LinkTaskComposer
              linkUrl={linkUrl} setLinkUrl={setLinkUrl}
              linkPlatform={linkPlatform} setLinkPlatform={setLinkPlatform}
              linkTitle={linkTitle} setLinkTitle={setLinkTitle}
              posting={posting}
              onSubmit={postLinkTask}
            />
          )}
        </div>
      </Modal>

      {/* Viewer */}
      {viewing && current && (
        <div className="fixed inset-0 z-50 flex flex-col animate-fade-in">
          <div className="absolute inset-0" style={{ background: current.type === 'text' ? gradientFor(current.bg_color) : '#000000' }} />

          <div className="relative flex gap-1.5 px-4 pt-4">
            {viewing.items.map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
                <div className={`h-full bg-white transition-all ${i === viewing.idx ? 'w-full' : i < viewing.idx ? 'w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>

          <div className="relative flex items-center justify-between p-4 mt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Avatar name={profiles[current.user_id]?.display_name ?? 'U'} src={profiles[current.user_id]?.avatar_url} size={38} />
              <div>
                <p className="text-sm font-semibold text-white">{profiles[current.user_id]?.display_name ?? 'User'}</p>
                <p className="text-xs text-white/70">{formatChatTime(current.created_at)} · {expiryLabel(current)}</p>
              </div>
            </div>
            <button onClick={() => setViewing(null)} className="p-2 text-white"><X size={22} /></button>
          </div>

          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            {current.type === 'text' ? (
              <p className="text-[28px] sm:text-3xl leading-snug font-display font-bold text-center text-white max-w-lg px-6" style={{ textShadow: '0 3px 18px rgba(0,0,0,0.6)' }}>{current.text}</p>
            ) : (
              <img src={current.attachment_url} alt="" draggable={false} className="max-w-full max-h-full object-contain select-none transition-transform duration-150" style={{ transform: `scale(${zoom})`, touchAction: 'manipulation' }} onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))} />
            )}
          </div>

          {viewing.idx > 0 && (
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"><ChevronLeft size={24} /></button>
          )}
          {viewing.idx + 1 < viewing.items.length && (
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"><ChevronRight size={24} /></button>
          )}

          {current.user_id !== profile?.id && (
            <div className="relative px-4 pb-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }} placeholder={`Reply to ${profiles[current.user_id]?.display_name ?? 'status'}...`} className="flex-1 rounded-full bg-white/15 text-white placeholder:text-white/60 px-4 py-2.5 text-sm outline-none focus:bg-white/20 transition" />
                <button onClick={sendReply} disabled={!replyText.trim() || sendingReply} className="w-10 h-10 rounded-full gold-bg text-ink-900 flex items-center justify-center disabled:opacity-50 shrink-0">
                  {sendingReply ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          )}

          <div className="relative p-4 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 text-sm text-white/80">
              <Eye size={15} /> {views[current.id] ?? 0} views
            </div>
            {current.user_id === profile?.id && (
              <button onClick={() => deleteStatus(current.id)} className="text-red-300 flex items-center gap-1 text-sm"><Trash2 size={15} /> Delete</button>
            )}
            {current.is_sponsored && <span className="text-gold-300 text-xs flex items-center gap-1"><Crown size={13} /> Sponsored</span>}
          </div>

          <button className="absolute right-0 top-0 h-full w-1/3 z-0" onClick={(e) => { e.stopPropagation(); next(); }} />
        </div>
      )}
    </div>
  );
};

// ===== Link Task Composer =====
const LinkTaskComposer = ({ linkUrl, setLinkUrl, linkPlatform, setLinkPlatform, linkTitle, setLinkTitle, posting, onSubmit }: {
  linkUrl: string; setLinkUrl: (v: string) => void;
  linkPlatform: string; setLinkPlatform: (v: string) => void;
  linkTitle: string; setLinkTitle: (v: string) => void;
  posting: boolean; onSubmit: () => void;
}) => (
  <div className="space-y-4">
    <div className="rounded-xl bg-gold-300/10 border border-gold-300/20 p-3">
      <p className="text-xs text-gold-200">
        Post your social link as a task. Users will follow you + view 2 videos to earn 2 coins. You need advertiser subscription + ad coins to post.
      </p>
    </div>
    <div>
      <label className="block text-xs text-gray-400 mb-1 ml-1">Platform</label>
      <select value={linkPlatform} onChange={(e) => setLinkPlatform(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm capitalize">
        {PLATFORMS.map((p) => <option key={p} value={p} className="bg-ink-850 capitalize">{p}</option>)}
      </select>
    </div>
    <div>
      <label className="block text-xs text-gray-400 mb-1 ml-1">Link URL</label>
      <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="https://youtube.com/@yourchannel" />
    </div>
    <div>
      <label className="block text-xs text-gray-400 mb-1 ml-1">Task title (optional)</label>
      <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="Follow + View 2 videos" />
    </div>
    <div className="rounded-lg bg-white/5 p-3 text-xs space-y-1">
      <div className="flex justify-between"><span className="text-gray-400">Reward per completion</span><span className="text-gold-300 font-medium">2 coins</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Task</span><span className="text-gray-300">Follow + View 2 videos</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Proof</span><span className="text-gray-300">Screenshot + 1 min stay</span></div>
    </div>
    <button onClick={onSubmit} disabled={!linkUrl.trim() || posting} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
      {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit for approval
    </button>
    <p className="text-xs text-gray-500 text-center">Admin will review and approve your link task before it goes live.</p>
  </div>
);

// ===== Link Task Card with Do Task flow =====
const LinkTaskCard = ({ task, advertiser, completion }: { task: LinkTask; advertiser: Profile | null; completion: TaskCompletion | null }) => {
  const [step, setStep] = useState<'idle' | 'opened' | 'waiting' | 'upload' | 'done'>(
    completion ? (completion.status === 'approved' ? 'done' : completion.status === 'pending' ? 'done' : 'idle') : 'idle'
  );
  const [elapsed, setElapsed] = useState(0);
  const [screenshotUrl, setScreenshotUrl] = useState(completion?.screenshot_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startTask = () => {
    window.open(task.link_url, '_blank');
    setStep('waiting');
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= 60) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('upload');
          return 60;
        }
        return s + 1;
      });
    }, 1000);
  };

  const onUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `task-proof/${Date.now()}-${file.name}`;
    await supabase.storage.from('blazegold').upload(path, file);
    const { data: pub } = supabase.storage.from('blazegold').getPublicUrl(path);
    setScreenshotUrl(pub.publicUrl);
    setUploading(false);
  };

  const submitCompletion = async () => {
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSubmitting(false); return; }
    const { error } = await supabase.from('bg_task_completions').insert({
      task_id: task.id,
      user_id: userId,
      status: 'pending',
      screenshot_url: screenshotUrl,
    });
    setSubmitting(false);
    if (error) { alert('You may have already completed this task.'); return; }
    setStep('done');
  };

  if (step === 'done' || (completion && completion.status !== 'rejected')) {
    return (
      <div className="card p-4 border border-green-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
            <Check size={20} className="text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{task.title || 'Task completed'}</p>
            <p className="text-xs text-gray-400">
              {completion?.status === 'approved' ? 'Approved — 2 coins earned!' : 'Pending admin approval'}
            </p>
          </div>
          <Coins size={16} className="text-gold-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      {/* Header: advertiser info */}
      <div className="flex items-center gap-2 mb-3">
        <Avatar name={advertiser?.display_name ?? 'Adv'} src={advertiser?.avatar_url} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{advertiser?.display_name ?? 'Advertiser'}</p>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gold-300/10 text-gold-300 capitalize">{task.platform}</span>
        </div>
      </div>

      {/* Link */}
      <a href={task.link_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:underline mb-3 break-all">
        <ExternalLink size={14} className="shrink-0" /> {task.link_url}
      </a>

      {/* Task description */}
      <div className="rounded-lg bg-gold-300/5 border border-gold-300/15 p-3 mb-3">
        <p className="text-sm text-gold-200 font-medium flex items-center gap-2">
          <Coins size={15} className="text-gold-300" /> Task: Follow + View 2 videos = {task.reward_coins} coins
        </p>
      </div>

      {/* Step flow */}
      {step === 'idle' && (
        <button onClick={startTask} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 text-sm">
          <Play size={16} fill="currentColor" /> Do Task
        </button>
      )}

      {step === 'waiting' && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-amber-300 text-sm">
            <Clock size={16} className="animate-pulse" />
            Stay on page: {60 - elapsed}s remaining
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full gold-bg transition-all" style={{ width: `${(elapsed / 60) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400 text-center">Return here after watching. The button unlocks at 60s.</p>
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 text-center">Time's up! Upload screenshot proof (optional) and submit.</p>
          <label className="btn-ghost w-full py-2.5 flex items-center justify-center gap-2 cursor-pointer text-sm">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {screenshotUrl ? 'Screenshot uploaded' : 'Upload screenshot (optional)'}
            <input type="file" accept="image/*" className="hidden" onChange={onUploadProof} />
          </label>
          <button onClick={submitCompletion} disabled={submitting} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Submit for approval
          </button>
        </div>
      )}
    </div>
  );
};

const gradientFor = (color?: string | null): string => {
  if (color == null) return STATUS_GRADIENTS[0].grad;
  const idx = Number(color);
  if (!Number.isNaN(idx) && idx >= 0 && idx < STATUS_GRADIENTS.length) return STATUS_GRADIENTS[idx].grad;
  return STATUS_GRADIENTS[0].grad;
};
