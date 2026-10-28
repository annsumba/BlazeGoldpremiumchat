import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Profile } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { VerifiedBadge } from '@/components/Badges';
import { countryFlag } from '@/lib/countries';
import { localTimeForCountry } from '@/lib/utils';
import { ArrowLeft, Phone, Mic, MicOff, PhoneOff, Loader2, PhoneCall, Crown } from 'lucide-react';

export const CallsScreen = ({ onBack }: { onBack: () => void }) => {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState<Profile | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [stage, setStage] = useState<'ringing' | 'active'>('ringing');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      // load peers you have a direct chat with
      const { data: myMembers } = await supabase.from('bg_chat_members').select('chat_id').eq('user_id', profile.id);
      const ids = (myMembers ?? []).map((m) => m.chat_id);
      if (!ids.length) { setLoading(false); return; }
      const { data: peerMembers } = await supabase.from('bg_chat_members').select('user_id').in('chat_id', ids).neq('user_id', profile.id);
      const peerIds = Array.from(new Set((peerMembers ?? []).map((m) => m.user_id)));
      if (peerIds.length) {
        const { data: profs } = await supabase.from('bg_profiles').select('*').in('id', peerIds);
        setContacts((profs ?? []) as Profile[]);
      }
      setLoading(false);
    };
    load();
  }, [profile]);

  const startCall = (p: Profile) => {
    setCalling(p);
    setStage('ringing');
    setSeconds(0);
    setMuted(false);
    // simulate peer picking up after 2.5s
    setTimeout(() => {
      setStage('active');
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }, 2500);
  };

  const endCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCalling(null);
    setSeconds(0);
    setStage('ringing');
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (calling) {
    return (
      <div className="flex flex-col h-full bg-ink-950 animate-fade-in">
        <div className="absolute inset-0 bg-gold-radial opacity-40" />
        <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Avatar name={calling.display_name} src={calling.avatar_url} size={120} ring="gold" showOnlineDot online={calling.online} />
          <h2 className="mt-5 font-display font-bold text-2xl flex items-center gap-2">
            {calling.display_name}
            {calling.is_verified && <VerifiedBadge size={16} />}
          </h2>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">{countryFlag(calling.country)} {calling.online ? 'online' : 'offline'}</p>
          <p className="mt-4 text-gold-300 font-mono text-lg">
            {stage === 'ringing' ? 'Calling...' : fmtTime(seconds)}
          </p>
          {stage === 'ringing' && (
            <div className="mt-2 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 rounded-full gold-bg animate-typing" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="relative flex items-center justify-center gap-6 pb-12">
          <button
            onClick={() => setMuted((m) => !m)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${muted ? 'bg-white text-ink-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition animate-gold-pulse"
          >
            <PhoneOff size={26} />
          </button>
          <div className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center">
            <Mic size={22} className="opacity-40" />
          </div>
        </div>
        <p className="relative text-center text-xs text-gray-500 pb-4">Voice call (mock) · {countryFlag(calling.country)} time {localTimeForCountry(calling.country)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <span className="font-semibold">Calls</span>
        <span className="ml-auto text-xs text-gold-300/70 flex items-center gap-1"><Phone size={12} /> Voice calls</span>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-4 py-4">
          <div className="card p-4 mb-4 gold-gradient-soft border border-gold-300/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full gold-bg text-ink-900 flex items-center justify-center"><PhoneCall size={20} /></div>
              <div>
                <p className="font-semibold text-sm">Start a voice call</p>
                <p className="text-xs text-gray-400">Pick a contact below to call them over the internet.</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gold-300/70 font-medium mb-2">YOUR CONTACTS</p>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gold-300" /></div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Phone size={32} className="text-gold-300/50" />
              <p className="mt-2 text-sm text-gray-400">No contacts yet. Start a chat first, then call them here.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {contacts.map((c) => (
                <button key={c.id} onClick={() => startCall(c)} className="w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/5 transition text-left">
                  <Avatar name={c.display_name} src={c.avatar_url} size={44} ring={c.is_verified ? 'gold' : 'none'} showOnlineDot online={c.online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{c.display_name}</span>
                      {c.is_verified && <VerifiedBadge size={12} />}
                      <span className="ml-auto text-sm">{countryFlag(c.country)}</span>
                    </div>
                    <p className="text-xs text-gray-500">{c.online ? 'online' : 'offline'} · {localTimeForCountry(c.country)}</p>
                  </div>
                  <span className="w-9 h-9 rounded-full gold-bg text-ink-900 flex items-center justify-center"><Phone size={16} /></span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-6 flex items-center justify-center gap-2 text-xs text-gray-600">
          <Crown size={12} className="text-gold-300" /> Voice & video calls powered by BlazeGold
        </div>
      </div>
    </div>
  );
};
