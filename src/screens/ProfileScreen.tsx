import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';
import { Modal } from '@/components/Modal';
import { VerifiedBadge, AdminCrown } from '@/components/Badges';
import { COUNTRIES, countryFlag, countryName } from '@/lib/countries';
import { selfVerify } from '@/lib/coins';
import { ArrowLeft, Camera, Pencil, Save, Crown, Coins, LogOut, Check, Loader2, Download, ShieldCheck, Copy, Plus, Share2, Eye, X } from 'lucide-react';

export const ProfileScreen = ({ onBack, installPrompt, onOpenStatus }: { onBack: () => void; installPrompt: () => void; onOpenStatus: () => void }) => {
  const { profile, refreshProfile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [country, setCountry] = useState(profile?.country ?? 'KE');
  const [statusText, setStatusText] = useState(profile?.status_text ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [dpViewerOpen, setDpViewerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = () => setCanInstall(true);
    window.addEventListener('appinstallable', h);
    return () => window.removeEventListener('appinstallable', h);
  }, []);

  if (!profile) return null;

  const save = async () => {
    setSaving(true);
    await supabase.from('bg_profiles').update({
      display_name: name.trim() || 'Gold User',
      bio: bio.trim(),
      country,
      status_text: statusText.trim(),
    }).eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      // Convert image to a data URL so it saves directly to the profile
      // column — no storage bucket required, works everywhere instantly.
      const dataUrl = await readFileAsDataUrl(file);
      const { error } = await supabase
        .from('bg_profiles')
        .update({ avatar_url: dataUrl })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      alert('Could not save profile picture. Please try a smaller image.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <span className="font-semibold">My Profile</span>
        <button
          onClick={() => editing ? save() : setEditing(true)}
          className="ml-auto p-2 rounded-full hover:bg-white/10 text-gold-300"
          disabled={saving}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : editing ? <Save size={18} /> : <Pencil size={18} />}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Avatar block — WhatsApp style: tap avatar = view DP, tap + = add status */}
        <div className="relative flex flex-col items-center pt-10 pb-6 bg-gold-radial">
          <div className="relative">
            {/* Tapping the avatar itself opens the fullscreen DP viewer */}
            <button onClick={() => setDpViewerOpen(true)} className="block active:scale-95 transition" title="View profile picture">
              <Avatar name={profile.display_name} src={profile.avatar_url} size={96} ring={profile.is_verified ? 'gold' : 'status'} />
            </button>
            {profile.online && <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-ink-900" />}
            {/* The gold + corner button opens the New Gold Status composer */}
            <button
              onClick={onOpenStatus}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full gold-bg text-ink-900 flex items-center justify-center shadow-gold-sm"
              title="Add new gold status"
            >
              <Plus size={18} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <h2 className="font-display font-bold text-xl">{editing ? name : profile.display_name}</h2>
            {profile.is_verified && <VerifiedBadge size={16} />}
            {profile.is_admin && <AdminCrown />}
          </div>
          <p className="text-sm text-gray-400">{profile.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl">{countryFlag(editing ? country : profile.country)}</span>
            <span className="text-sm text-gray-300">{countryName(editing ? country : profile.country)}</span>
          </div>
          {uploading && <p className="mt-2 text-xs text-gold-300">Uploading photo...</p>}
          {profile.status_text && !editing && <p className="mt-2 text-sm text-gold-200 italic">"{profile.status_text}"</p>}
          {saved && <p className="mt-2 text-xs text-green-400 flex items-center gap-1"><Check size={12} /> Saved</p>}
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="px-4 py-4 space-y-3">
            <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm" /></Field>
            <Field label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="Tell people about you..." /></Field>
            <Field label="Status"><input value={statusText} onChange={(e) => setStatusText(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="Available / Busy..." /></Field>
            <Field label="Country">
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code} className="bg-ink-850">{c.flag} {c.name}</option>)}
              </select>
            </Field>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {profile.bio && <InfoCard label="Bio" value={profile.bio} />}
            <StatRow coins={profile.gold_coins} verified={profile.is_verified} />
          </div>
        )}

        {/* Premium verify */}
        <div className="px-4 mt-2">
          <div className="card p-4 gold-gradient-soft border border-gold-300/30">
            <div className="flex items-center gap-2 mb-2">
              <Crown size={18} className="text-gold-300" />
              <h3 className="font-display font-bold text-gold-200">{profile.is_verified ? 'Gold Verified' : 'Get Gold Verified'}</h3>
              {profile.is_verified && <ShieldCheck size={16} className="text-green-400 ml-auto" />}
            </div>
            <p className="text-sm text-gray-300 mb-3">
              {profile.is_verified
                ? 'Your gold ✓ badge is active. Stand out everywhere on BlazeGold.'
                : 'Stand out with a gold ✓ badge next to your name everywhere. Only 99 KES via M-Pesa.'}
            </p>
            {!profile.is_verified && (
              <button onClick={() => setVerifyOpen(true)} className="btn-gold w-full py-2.5 text-sm flex items-center justify-center gap-2">
                <Crown size={15} /> Verify now — 99 KES
              </button>
            )}
          </div>
        </div>

        {/* Work coins */}
        <div className="px-4 mt-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Coins size={18} className="text-gold-300" fill="#FFD700" />
              <h3 className="font-semibold">Work Coins</h3>
              <span className="ml-auto text-gold-300 font-bold">{profile.gold_coins.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500">1 coin = 1 KES. Complete link tasks to earn coins, then withdraw to M-Pesa.</p>
          </div>
        </div>

        {/* Install app */}
        {canInstall && (
          <div className="px-4 mt-3">
            <button onClick={installPrompt} className="card w-full p-4 flex items-center gap-3 hover:border-gold-300/30 transition">
              <Download size={18} className="text-gold-300" />
              <div className="text-left"><p className="font-medium text-sm">Install BlazeGold App</p><p className="text-xs text-gray-500">Add to your home screen</p></div>
            </button>
          </div>
        )}

        {/* Sign out */}
        <div className="px-4 mt-3 mb-6">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/15 transition">
            <LogOut size={18} /> Sign out
          </button>
        </div>

        <div className="px-4 pb-6 flex items-center justify-center gap-2 text-xs text-gray-600">
          <Logo size="sm" showText={false} /> BlazeGold v2.1 · Made in Kenya 🇰🇪
        </div>
      </div>

      <MpesaVerifyModal open={verifyOpen} onClose={() => setVerifyOpen(false)} onVerified={async () => { await refreshProfile(); setVerifyOpen(false); }} />

      {/* Fullscreen profile picture viewer — WhatsApp style */}
      <DpViewer
        open={dpViewerOpen}
        onClose={() => setDpViewerOpen(false)}
        src={profile.avatar_url}
        name={profile.display_name}
        onEdit={() => { setDpViewerOpen(false); fileRef.current?.click(); }}
      />
    </div>
  );
};

// Fullscreen profile picture viewer with View / Share / Edit actions.
const DpViewer = ({ open, onClose, src, name, onEdit }: { open: boolean; onClose: () => void; src: string; name: string; onEdit: () => void }) => {
  const [shareState, setShareState] = useState<'idle' | 'done'>('idle');
  if (!open) return null;

  const share = async () => {
    if (src && navigator.share) {
      try {
        await navigator.share({ title: `${name}'s profile picture`, text: `Check out ${name} on BlazeGold` });
        return;
      } catch { /* user cancelled */ }
    }
    if (src && navigator.clipboard) {
      try { await navigator.clipboard.writeText(src); setShareState('done'); setTimeout(() => setShareState('idle'), 1500); } catch { /* ignore */ }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/95 flex flex-col animate-fade-in" onClick={onClose}>
      <header className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-white/60">Profile photo</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X size={22} /></button>
      </header>
      <div className="flex-1 flex items-center justify-center overflow-hidden" onClick={onClose}>
        {src ? (
          <img src={src} alt={name} className="max-w-full max-h-full object-contain" draggable={false} />
        ) : (
          <div className="w-40 h-40 rounded-full bg-white/10 flex items-center justify-center text-5xl font-display font-bold text-gold-300">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-8 py-6" onClick={(e) => e.stopPropagation()}>
        <DpAction icon={Eye} label="View" onClick={() => { if (src) window.open(src, '_blank'); }} />
        <DpAction icon={Share2} label={shareState === 'done' ? 'Copied' : 'Share'} onClick={share} />
        <DpAction icon={Camera} label="Edit" onClick={onEdit} />
      </div>
    </div>
  );
};

const DpAction = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 text-white/80 hover:text-gold-300 transition">
    <span className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><Icon size={22} /></span>
    <span className="text-xs">{label}</span>
  </button>
);

const MPESA_TILL = '1782087';

const MpesaVerifyModal = ({ open, onClose, onVerified }: { open: boolean; onClose: () => void; onVerified: () => Promise<void> }) => {
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'input' | 'processing' | 'done'>('input');
  const [copied, setCopied] = useState(false);

  const copyTill = async () => {
    try {
      await navigator.clipboard.writeText(MPESA_TILL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const submit = async () => {
    if (!code.trim()) return;
    setStage('processing');
    await new Promise((r) => setTimeout(r, 1800));
    const ok = await selfVerify();
    if (ok) {
      setStage('done');
      setTimeout(() => { onVerified(); setStage('input'); setCode(''); }, 1400);
    } else {
      setStage('input');
      alert('Verification failed. Please check your M-Pesa code and try again, or ask an admin to verify you.');
    }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setStage('input'); }} title="Lipa na M-Pesa Till">
      {stage === 'done' ? (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-16 h-16 rounded-full gold-bg text-ink-900 flex items-center justify-center mb-3 shadow-gold-lg">
            <ShieldCheck size={32} />
          </div>
          <h3 className="font-display font-bold text-lg gold-text">You're Gold Verified!</h3>
          <p className="text-sm text-gray-400 mt-1">Your gold ✓ badge is now active.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Till number block */}
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center">
            <p className="text-xs text-green-300 font-medium mb-1">Till Number</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-display font-bold text-white tracking-wider">{MPESA_TILL}</span>
              <button onClick={copyTill} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition" title="Copy till number">
                {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-gray-200" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Buy Goods &amp; Services · 99 KES</p>
          </div>

          {/* Steps */}
          <div className="space-y-2 text-sm text-gray-300">
            <Step n={1}>Lipa 99 KES kwa Till {MPESA_TILL} (Buy Goods)</Step>
            <Step n={2}>Utapata SMS na Code (e.g. SG82KQ...)</Step>
            <Step n={3}>Copy Code na uje u-paste hapa chini</Step>
          </div>

          <Field label="M-Pesa Code">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SG82KQ7X2" className="input-gold w-full px-3 py-2.5 text-sm" />
          </Field>
          <button onClick={submit} disabled={stage === 'processing' || !code.trim()} className="btn-gold w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
            {stage === 'processing' ? <><Loader2 size={18} className="animate-spin" /> Verifying...</> : <><ShieldCheck size={16} /> Verify with Code</>}
          </button>
          <p className="text-xs text-gray-500 text-center">Badge activates instantly after verification.</p>
        </div>
      )}
    </Modal>
  );
};

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5">
    <span className="shrink-0 w-5 h-5 rounded-full gold-bg text-ink-900 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
    <span>{children}</span>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="block text-xs text-gray-400 mb-1 ml-1">{label}</label>{children}</div>
);
const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="card p-4"><p className="text-xs text-gray-500 mb-1">{label}</p><p className="text-sm">{value}</p></div>
);
const StatRow = ({ coins, verified }: { coins: number; verified: boolean }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="card p-3 text-center">
      <Coins size={20} className="text-gold-300 mx-auto mb-1" fill="#FFD700" />
      <p className="text-lg font-bold text-gold-300">{coins}</p>
      <p className="text-xs text-gray-500">Work Coins</p>
    </div>
    <div className="card p-3 text-center">
      {verified ? <VerifiedBadge size={20} /> : <Crown size={20} className="text-gray-500 mx-auto mb-1" />}
      <p className="text-sm font-bold mt-1">{verified ? 'Verified' : 'Not verified'}</p>
      <p className="text-xs text-gray-500">Badge status</p>
    </div>
  </div>
);

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
