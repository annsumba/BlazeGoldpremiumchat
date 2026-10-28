import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Payment, Withdrawal } from '@/lib/types';
import { ArrowLeft, Receipt, Loader2, ArrowDownToLine, Coins } from 'lucide-react';

export const PaymentHistoryScreen = ({ onBack }: { onBack: () => void }) => {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile) return;
    const { data: pays } = await supabase.from('bg_payments').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    setPayments((pays ?? []) as Payment[]);
    const { data: wds } = await supabase.from('bg_withdrawals').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    setWithdrawals((wds ?? []) as Withdrawal[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full bg-ink-900">
      <header className="sticky top-0 z-20 glass border-b border-gold-300/10 px-3 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10"><ArrowLeft size={20} className="text-gray-200" /></button>
        <span className="font-semibold">Payment History</span>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gold-300" /></div>
        ) : (
          <>
            {/* Withdrawals */}
            <div className="card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><ArrowDownToLine size={16} className="text-gold-300" /> Withdrawals</h3>
              {withdrawals.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No withdrawals yet.</p>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{w.coins} coins → {w.kes_to_user} KES</p>
                        <p className="text-xs text-gray-500">{w.phone} · {new Date(w.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${w.status === 'paid' ? 'text-green-400 bg-green-500/10' : w.status === 'rejected' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'}`}>{w.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ad payments */}
            <div className="card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Coins size={16} className="text-gold-300" /> Ad Payments</h3>
              {payments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No ad payments yet.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{p.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500">{p.amount_kes} KES {p.coins > 0 && `· ${p.coins} coins`} · {new Date(p.created_at).toLocaleDateString()}</p>
                        {p.mpesa_code && <p className="text-xs text-gray-600">Code: {p.mpesa_code}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'approved' ? 'text-green-400 bg-green-500/10' : p.status === 'rejected' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {payments.length === 0 && withdrawals.length === 0 && (
              <div className="card p-6 text-center">
                <Receipt size={32} className="text-gold-300/60 mx-auto" />
                <p className="mt-2 text-sm text-gray-400">No payment history yet. Your withdrawals and ad payments will appear here.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
