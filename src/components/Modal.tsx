import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export const Modal = ({ open, onClose, title, children, footer }: Props) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md card shadow-gold-lg animate-slide-up max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gold-300/10">
            <h3 className="font-display font-bold text-lg gold-text">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto scrollbar-thin">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gold-300/10">{footer}</div>}
      </div>
    </div>
  );
};
