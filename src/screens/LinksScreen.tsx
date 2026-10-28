import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { SocialLink } from '@/lib/types';
import { ArrowLeft, Plus, Trash2, Loader2, X, Youtube, Instagram, Twitter, Facebook, Linkedin, Music2, Save, Check } from 'lucide-react';

const PLATFORMS = [
  { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'tiktok', label: 'TikTok', icon: Music2 },
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'twitter', label: 'Twitter / X', icon: Twitter },
  { key: 'snapchat', label: 'Snapchat', icon: Plus },
  { key: 'facebook', label: 'Facebook', icon: Facebook },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
];

export const LinksScreen = ({ onBack }: { onBack: () => void }) => {
  const { profile } = useAuth();
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPlatform, setAddPlatform] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('bg_social_links').select('*').eq('user_id', profile.id).order('created_at', { ascending: true });
    setLinks((data ?? []) as SocialLink[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addLink = async () => {
    if (!profile || !addPlatform || !url.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('bg_social_links').insert({ user_id: profile.id, platform: addPlatform, url: url.trim() });
    setSaving(false);
    if (error) { alert('Could not save link. You may already have this platform added.'); return; }
    setAddPlatform(null); setUrl(''); load();
  };

  const updateLink = async (id: string, newUrl: string) => {
    await supabase.from('bg_social_links').update({ url: newUrl }).eq('id', id);
    setSaved(true); setTimeout(() => setSaved(false), 1200);
    load();
  };

  const deleteLink = async (id: string) => {
    if (!confirm('Remove this link?')) return;
    await supabase.from('bg_social_links').delete().eq('id', id);
    load();
  };

  const platformMeta = (key: string) => PLATFORMS.find((p) => p.key === key);
  const availablePlatforms = PLATFORMS.filter((p) => !links.some((l) => l.platform === p.key));

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <span className="font-semibold">My Links</span>
        {saved && <span className="ml-auto text-xs text-green-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        <p className="text-xs text-gray-400 px-1">Add all your social media profile links. These show on your profile for others to find and follow you.</p>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gold-300" /></div>
        ) : (
          <>
            {links.map((link) => {
              const meta = platformMeta(link.platform);
              const Icon = meta?.icon ?? Plus;
              return (
                <div key={link.id} className="card p-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gold-300 shrink-0">
                    <Icon size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{meta?.label ?? link.platform}</p>
                    <input
                      defaultValue={link.url}
                      onBlur={(e) => { if (e.target.value !== link.url) updateLink(link.id, e.target.value); }}
                      className="w-full bg-transparent text-sm outline-none focus:text-gold-300 transition"
                    />
                  </div>
                  <button onClick={() => deleteLink(link.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-full transition">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}

            {availablePlatforms.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-gray-400 mb-2 ml-1">Add a link</p>
                <div className="flex flex-wrap gap-2">
                  {availablePlatforms.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button key={p.key} onClick={() => { setAddPlatform(p.key); setUrl(''); }} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition">
                        <Icon size={15} /> {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {links.length === 0 && availablePlatforms.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">All links added!</p>
            )}
          </>
        )}
      </div>

      {/* Add link modal */}
      {addPlatform && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setAddPlatform(null)}>
          <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Add {platformMeta(addPlatform)?.label}</h3>
              <button onClick={() => setAddPlatform(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={`https://${addPlatform}.com/yourusername`}
                className="input-gold w-full px-3 py-2.5 text-sm"
              />
              <button onClick={addLink} disabled={saving || !url.trim()} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
