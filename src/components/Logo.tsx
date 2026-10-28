import { Crown, Zap } from 'lucide-react';

export const Logo = ({ size = 'md', showText = true }: { size?: 'sm' | 'md' | 'lg'; showText?: boolean }) => {
  const dim = size === 'sm' ? 22 : size === 'lg' ? 40 : 30;
  const text = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl';
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex items-center justify-center rounded-xl gold-bg shadow-gold"
        style={{ width: dim + 10, height: dim + 10 }}
      >
        <Crown size={dim * 0.62} className="text-ink-900" strokeWidth={2.5} />
        <Zap
          size={dim * 0.42}
          className="absolute -bottom-0.5 -right-0.5 text-gold-300 drop-shadow"
          strokeWidth={2.5}
          fill="#FFA500"
        />
      </div>
      {showText && (
        <span className={`font-display font-extrabold gold-text ${text} tracking-tight`}>
          BLAZE<span className="font-bold">GOLD</span>
        </span>
      )}
    </div>
  );
};
