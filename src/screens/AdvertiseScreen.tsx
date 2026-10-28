import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Payment } from '@/lib/types';
import { recordAdPayment } from '@/lib/coins';
import { ArrowLeft, Megaphone, Coins, Loader2, Check, X, Crown, Upload, Copy, ShieldCheck } from 'lucide-react';

const MPESA_TILL = '1782087';
const AD_SUB_KES = 199;
const AD_COINS_KES = 100;
const AD_COINS_AMOUNT = 100;

export const AdvertiseScreen = ({ onBack }: { onBack: () => void }) => {
  const { profile, refreshProfile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState<'ad_sub' | 'ad_coins' | null>(null);
  const [mpesaCode, setMpesaCode] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('bg_payments').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    setPayments((data ?? []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const copyTill = async () => {
    try { await navigator.clipboard.writeText(MPESA_TILL); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const onUploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    const path = `payments/${Date.now()}-${file.name}`;
    await supabase.storage.from('blazegold').upload(path, file);
    const { data: pub } = supabase.storage.from('blazegold').getPublicUrl(path);
    setScreenshotUrl(pub.publicUrl);
    setUploading(false);
  };

  const submit = async () => {
    if (!profile) return;
    setError('');
    if (!mpesaCode.trim()) { setError('Enter your M-Pesa code.'); return; }
    if (!screenshotUrl) { setError('Upload your payment screenshot.'); return; }
    setSubmitting(true);
    const isSub = modalOpen === 'ad_sub';
    const ok = await recordAdPayment(
      isSub ? 'ad_sub' : 'ad_coins',
      isSub ? AD_SUB_KES : AD_COINS_KES,
      isSub ? 0 : AD_COINS_AMOUNT,
      mpesaCode.trim(),
      screenshotUrl,
    );
    setSubmitting(false);
    if (ok) {
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setModalOpen(null); setMpesaCode(''); setScreenshotUrl(''); load(); }, 1500);
    } else {
      setError('Could not submit payment. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <span className="font-semibold">Advertise</span>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* Subscription card */}
        <div className="card p-5 gold-gradient-soft border border-gold-300/30">
          <div className="flex items-center gap-2 mb-2">
            <Crown size={20} className="text-gold-300" />
            <h3 className="font-display font-bold text-lg gold-text">Advertiser Subscription</h3>
          </div>
          <p className="text-sm text-gray-300 mb-3">Subscribe to post link tasks and reach thousands of BlazeGold users. Post your links, set tasks, and get real followers.</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-display font-bold text-white">{AD_SUB_KES}</span>
            <span className="text-sm text-gray-400">KES / month</span>
          </div>
          <button onClick={() => { setModalOpen('ad_sub'); setSuccess(false); setError(''); }} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 text-sm">
            <Crown size={16} /> Subscribe — {AD_SUB_KES} KES
          </button>
        </div>

        {/* Ad coins card */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={20} className="text-gold-300" fill="#FFD700" />
            <h3 className="font-display font-bold text-lg">Buy Ad Coins</h3>
          </div>
          <p className="text-sm text-gray-400 mb-3">Purchase coins to fund your link task rewards. 1 coin = 1 KES. Each completed task pays 2 coins to the user.</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-display font-bold text-gold-300">{AD_COINS_AMOUNT}</span>
            <span className="text-sm text-gray-400">coins = {AD_COINS_KES} KES</span>
          </div>
          <button onClick={() => { setModalOpen('ad_coins'); setSuccess(false); setError(''); }} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 text-sm">
            <Coins size={16} /> Buy {AD_COINS_AMOUNT} coins — {AD_COINS_KES} KES
          </button>
        </div>

        {/* International pricing */}
        <div className="card p-4 border border-blue-400/20 bg-blue-500/5">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={16} className="text-blue-400" />
            <h4 className="font-semibold text-sm">International Advertisers</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-display font-bold text-white">$4.99</span>
            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">7 days free trial</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Pay via card. Cancel anytime.</p>
        </div>

        {/* Payment history */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Payment History</h3>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gold-300" /></div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No payments yet.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{p.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{p.amount_kes} KES {p.coins > 0 && `· ${p.coins} coins`} · {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'approved' ? 'text-green-400 bg-green-500/10' : p.status === 'rejected' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setModalOpen(null)}>
          <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">{modalOpen === 'ad_sub' ? 'Advertiser Subscription' : 'Buy Ad Coins'}</h3>
              <button onClick={() => setModalOpen(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            {success ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Check size={32} className="text-green-400" />
                <p className="mt-2 text-sm text-gray-300">Payment submitted! Admin will verify and activate shortly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center">
                  <p className="text-xs text-green-300 font-medium mb-1">Pay to Till Number</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-display font-bold text-white tracking-wider">{MPESA_TILL}</span>
                    <button onClick={copyTill} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
                      {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-gray-200" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {modalOpen === 'ad_sub' ? `${AD_SUB_KES} KES · Buy Goods & Services` : `${AD_COINS_KES} KES · Buy Goods & Services`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">M-Pesa Code</label>
                  <input value={mpesaCode} onChange={(e) => setMpesaCode(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="e.g. SG82KQ7X2" />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Upload Payment Screenshot</label>
                  <label className="btn-ghost w-full py-2.5 flex items-center justify-center gap-2 cursor-pointer text-sm">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {screenshotUrl ? 'Screenshot uploaded' : 'Choose screenshot'}
                    <input type="file" accept="image/*" className="hidden" onChange={onUploadScreenshot} />
                  </label>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button onClick={submit} disabled={submitting} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Submit for approval
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
