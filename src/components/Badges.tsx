import { useAuth } from '@/lib/auth';
import { Coins, Crown } from 'lucide-react';

export const VerifiedBadge = ({ size = 14 }: { size?: number }) => (
  <span className="inline-flex items-center justify-center rounded-full gold-bg text-ink-900 shadow-gold-sm" style={{ width: size + 2, height: size + 2 }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  </span>
);

export const AdminCrown = () => (
  <span className="inline-flex items-center justify-center rounded-full gold-bg text-ink-900" style={{ width: 18, height: 18 }}>
    <Crown size={12} strokeWidth={2.5} />
  </span>
);

export const CoinPill = () => {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold-300/10 border border-gold-300/25 text-gold-300 text-sm font-semibold" title="Work Coins · 1 coin = 1 KES">
      <Coins size={14} className="text-gold-300" fill="#FFD700" />
      {profile.gold_coins.toLocaleString()}
    </span>
  );
};
