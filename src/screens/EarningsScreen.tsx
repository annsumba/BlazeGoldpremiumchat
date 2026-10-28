import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Withdrawal, CoinLedger } from '@/lib/types';
import { requestWithdrawal, WITHDRAW_MIN_COINS, calcWithdrawPayout } from '@/lib/coins';
import { ArrowLeft, Coins, Wallet, Loader2, Check, Clock, X, ArrowDownToLine } from 'lucide-react';

export const EarningsScreen = ({ onBack }: { onBack: () => void }) => {
  const { profile, refreshProfile } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [ledger, setLedger] = useState<CoinLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [coins, setCoins] = useState(0);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data: ws } = await supabase.from('bg_withdrawals').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    setWithdrawals((ws ?? []) as Withdrawal[]);
    const { data: lg } = await supabase.from('bg_coins_ledger').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20);
    setLedger((lg ?? []) as CoinLedger[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const balance = profile?.gold_coins ?? 0;
  const { toUser, fee } = calcWithdrawPayout(coins || 0);

  const submitWithdraw = async () => {
    if (!profile) return;
    setError('');
    if (coins < WITHDRAW_MIN_COINS) { setError(`Minimum withdrawal is ${WITHDRAW_MIN_COINS} coins.`); return; }
    if (coins > balance) { setError('You cannot withdraw more than your balance.'); return; }
    if (!phone.trim()) { setError('Enter your M-Pesa phone number.'); return; }
    setSubmitting(true);
    const result = await requestWithdrawal(coins, phone.trim());
    setSubmitting(false);
    if (result) {
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setWithdrawOpen(false); setCoins(0); setPhone(''); load(); }, 1500);
    } else {
      setError('Could not submit withdrawal. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <span className="font-semibold">My Earnings</span>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* Balance card */}
        <div className="card p-5 gold-gradient-soft border border-gold-300/30 text-center">
          <p className="text-xs text-gold-300/70 mb-1">Work Coins Balance</p>
          <div className="flex items-center justify-center gap-2">
            <Coins size={28} className="text-gold-300" fill="#FFD700" />
            <span className="text-4xl font-display font-bold gold-text">{balance}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">1 coin = 1 KES</p>
          <button onClick={() => setWithdrawOpen(true)} className="btn-gold w-full mt-4 py-2.5 flex items-center justify-center gap-2 text-sm">
            <ArrowDownToLine size={16} /> Withdraw to M-Pesa
          </button>
          <p className="text-xs text-gray-500 mt-2">Min {WITHDRAW_MIN_COINS} coins · 80% to you · 40 KES fee</p>
        </div>

        {/* Withdrawals history */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Wallet size={16} className="text-gold-300" /> Withdrawal History</h3>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gold-300" /></div>
          ) : withdrawals.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No withdrawals yet.</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{w.coins} coins → {w.kes_to_user} KES</p>
                    <p className="text-xs text-gray-500">{new Date(w.created_at).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coin history */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Coins size={16} className="text-gold-300" /> Coin History</h3>
          {ledger.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No transactions yet. Complete tasks to earn coins!</p>
          ) : (
            <div className="space-y-2">
              {ledger.map((l) => (
                <div key={l.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className={`text-sm font-medium ${l.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {l.amount > 0 ? '+' : ''}{l.amount}
                  </span>
                  <span className="text-xs text-gray-400 flex-1 capitalize">{l.reason.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-gray-600">{new Date(l.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Withdraw modal */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setWithdrawOpen(false)}>
          <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Withdraw Coins</h3>
              <button onClick={() => setWithdrawOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            {success ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Check size={32} className="text-green-400" />
                <p className="mt-2 text-sm text-gray-300">Withdrawal submitted! Admin will process your M-Pesa payment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Coins to withdraw (min {WITHDRAW_MIN_COINS})</label>
                  <input type="number" value={coins || ''} onChange={(e) => setCoins(Number(e.target.value))} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="200" />
                </div>
                {coins > 0 && (
                  <div className="rounded-lg bg-white/5 p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-gray-400">You receive</span><span className="text-green-400 font-medium">{toUser} KES</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Platform fee</span><span className="text-red-400">{fee} KES</span></div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">M-Pesa phone number</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-gold w-full px-3 py-2.5 text-sm" placeholder="07XXXXXXXX" />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button onClick={submitWithdraw} disabled={submitting} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />} Submit withdrawal
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { color: string; icon: any }> = {
    pending: { color: 'text-amber-400 bg-amber-500/10', icon: Clock },
    approved: { color: 'text-green-400 bg-green-500/10', icon: Check },
    paid: { color: 'text-green-400 bg-green-500/10', icon: Check },
    rejected: { color: 'text-red-400 bg-red-500/10', icon: X },
  };
  const { color, icon: Icon } = map[status] ?? map.pending;
  return <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${color}`}><Icon size={11} /> {status}</span>;
};
