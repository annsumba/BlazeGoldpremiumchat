import { Check, CheckCheck } from 'lucide-react';

export const Ticks = ({ status, mine }: { status: 'sent' | 'delivered' | 'read'; mine: boolean }) => {
  if (!mine) return null;
  if (status === 'sent') return <Check size={14} className="text-gray-400" />;
  if (status === 'delivered')
    return <CheckCheck size={15} className="text-gold-300/70" strokeWidth={2.5} />;
  return <CheckCheck size={15} className="text-gold-300" strokeWidth={2.5} fill="#FFD700" fillOpacity={0.95} />;
};
