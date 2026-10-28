import { initials as getInitials, avatarColor } from '@/lib/utils';

type Props = {
  name: string;
  src?: string;
  size?: number;
  ring?: 'gold' | 'none' | 'status';
  online?: boolean;
  showOnlineDot?: boolean;
  seed?: string;
};

export const Avatar = ({ name, src, size = 48, ring = 'none', online, showOnlineDot, seed }: Props) => {
  const px = `${size}px`;
  const ringClass =
    ring === 'gold'
      ? 'ring-2 ring-gold-300 shadow-gold-sm'
      : ring === 'status'
      ? 'p-0.5 gold-bg'
      : '';
  const inner = src ? (
    <img src={src} alt={name} className="w-full h-full object-cover rounded-full" />
  ) : (
    <div
      className="w-full h-full rounded-full flex items-center justify-center font-semibold text-white"
      style={{ background: avatarColor(seed ?? name), fontSize: size * 0.38 }}
    >
      {getInitials(name)}
    </div>
  );
  return (
    <div className={`relative rounded-full ${ringClass}`} style={{ width: px, height: px }}>
      <div className={`w-full h-full rounded-full overflow-hidden ${ring === 'status' ? 'bg-ink-900' : ''}`}>
        {ring === 'status' ? <div className="w-full h-full p-0.5">{inner}</div> : inner}
      </div>
      {showOnlineDot && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full border-2 border-ink-900 ${
            online ? 'bg-green-500' : 'bg-gray-500'
          }`}
          style={{ width: size * 0.22, height: size * 0.22 }}
        />
      )}
    </div>
  );
};
