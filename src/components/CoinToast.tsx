import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';

type Toast = { id: number; amount: number };

let listeners: ((t: Toast) => void)[] = [];
let counter = 0;

export const showCoinToast = (amount: number) => {
  const t = { id: ++counter, amount };
  listeners.forEach((l) => l(t));
};

export const CoinToastHost = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 2200);
    };
    listeners.push(listener);
    return () => { listeners = listeners.filter((l) => l !== listener); };
  }, []);

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 px-4 py-2 rounded-full gold-bg text-ink-900 font-bold shadow-gold-lg animate-slide-up"
          style={{ animation: 'slide-up 0.3s ease-out, fade-in 0.3s ease-out' }}
        >
          <Coins size={18} fill="#0A0A0A" />
          +{t.amount} Gold Coins
        </div>
      ))}
    </div>
  );
};
