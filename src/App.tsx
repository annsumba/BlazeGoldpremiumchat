import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthScreen } from '@/screens/AuthScreen';
import { ChatListScreen } from '@/screens/ChatListScreen';
import { ChatRoom } from '@/screens/ChatRoom';
import { GroupInfo } from '@/screens/GroupInfo';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { StatusScreen } from '@/screens/StatusScreen';
import { AdminPanel } from '@/screens/AdminPanel';
import { CallsScreen } from '@/screens/CallsScreen';
import { NewChatModal } from '@/screens/NewChatModal';
import { EarningsScreen } from '@/screens/EarningsScreen';
import { AdvertiseScreen } from '@/screens/AdvertiseScreen';
import { LinksScreen } from '@/screens/LinksScreen';
import { PaymentHistoryScreen } from '@/screens/PaymentHistoryScreen';
import { Logo } from '@/components/Logo';
import { MessageCircle, CircleDollarSign, Phone, User as UserIcon, Crown, Loader2, Wallet, Megaphone, Link2, Receipt } from 'lucide-react';
import type { IconType } from '@/lib/icons';

type View =
  | { name: 'chats' }
  | { name: 'chat'; chatId: string }
  | { name: 'groupInfo'; chatId: string }
  | { name: 'status' }
  | { name: 'calls' }
  | { name: 'profile' }
  | { name: 'admin' }
  | { name: 'earnings' }
  | { name: 'advertise' }
  | { name: 'links' }
  | { name: 'paymentHistory' };

type BottomTab = 'chats' | 'status' | 'calls' | 'profile';

let deferredPrompt: any = null;

function Shell() {
  const { profile, loading } = useAuth();
  const [view, setView] = useState<View>({ name: 'chats' });
  const [tab, setTab] = useState<BottomTab>('chats');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
      window.dispatchEvent(new Event('appinstallable'));
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const installPrompt = async () => {
    if (!deferredPrompt) {
      alert('Install option appears in your browser menu (Add to Home Screen).');
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ink-900 gap-4">
        <Logo size="lg" />
        <div className="flex items-center gap-2 text-gold-300">
          <Loader2 size={18} className="animate-spin" /> <span className="text-sm">Lighting the gold...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <AuthScreen initial="login" />;
  }

  if (profile.is_banned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ink-900 p-6 text-center gap-3">
        <Crown size={40} className="text-red-400" />
        <h2 className="font-display font-bold text-xl">Account suspended</h2>
        <p className="text-sm text-gray-400">Your BlazeGold account has been banned. Contact support if you believe this is a mistake.</p>
      </div>
    );
  }

  const showBottomNav = view.name === 'chats' || view.name === 'status' || view.name === 'profile' || view.name === 'calls';
  const isAdmin = profile.is_admin;

  return (
    <div className="h-screen w-screen overflow-hidden bg-ink-900 flex flex-col max-w-2xl mx-auto relative">
      <div className="flex-1 overflow-hidden relative">
        {view.name === 'chats' && (
          <ChatListScreen
            onOpenChat={(chatId) => { setView({ name: 'chat', chatId }); }}
            onNewChat={() => setNewChatOpen(true)}
            onOpenProfile={() => { setView({ name: 'profile' }); setTab('profile'); }}
            onOpenStatus={() => { setView({ name: 'status' }); setTab('status'); }}
            onOpenAdmin={() => setView({ name: 'admin' })}
            onOpenEarnings={() => setView({ name: 'earnings' })}
            onOpenAdvertise={() => setView({ name: 'advertise' })}
            onOpenLinks={() => setView({ name: 'links' })}
            onOpenPaymentHistory={() => setView({ name: 'paymentHistory' })}
            installPrompt={installPrompt}
          />
        )}
        {view.name === 'chat' && (
          <ChatRoom
            chatId={view.chatId}
            onBack={() => setView({ name: 'chats' })}
            onOpenGroupInfo={(chatId) => setView({ name: 'groupInfo', chatId })}
          />
        )}
        {view.name === 'groupInfo' && (
          <GroupInfo chatId={view.chatId} onBack={() => setView({ name: 'chat', chatId: view.chatId })} />
        )}
        {view.name === 'status' && <StatusScreen onBack={() => { setView({ name: 'chats' }); setTab('chats'); }} onOpenChat={(chatId) => setView({ name: 'chat', chatId })} />}
        {view.name === 'calls' && <CallsScreen onBack={() => { setView({ name: 'chats' }); setTab('chats'); }} />}
        {view.name === 'profile' && <ProfileScreen onBack={() => { setView({ name: 'chats' }); setTab('chats'); }} installPrompt={installPrompt} onOpenStatus={() => { setView({ name: 'status' }); setTab('status'); }} />}
        {view.name === 'admin' && <AdminPanel onBack={() => setView({ name: 'chats' })} />}
        {view.name === 'earnings' && <EarningsScreen onBack={() => setView({ name: 'chats' })} />}
        {view.name === 'advertise' && <AdvertiseScreen onBack={() => setView({ name: 'chats' })} />}
        {view.name === 'links' && <LinksScreen onBack={() => setView({ name: 'chats' })} />}
        {view.name === 'paymentHistory' && <PaymentHistoryScreen onBack={() => setView({ name: 'chats' })} />}
      </div>

      {/* Bottom nav */}
      {showBottomNav && (
        <nav className="flex items-center justify-around glass border-t border-gold-300/10 px-2 py-1.5 z-30">
          <NavBtn icon={MessageCircle} label="Chats" active={tab === 'chats'} onClick={() => { setTab('chats'); setView({ name: 'chats' }); }} badge={undefined} />
          <NavBtn icon={CircleDollarSign} label="Status" active={tab === 'status'} onClick={() => { setTab('status'); setView({ name: 'status' }); }} />
          <NavBtn icon={Phone} label="Calls" active={tab === 'calls'} onClick={() => { setTab('calls'); setView({ name: 'calls' }); }} />
          {isAdmin ? (
            <NavBtn icon={Crown} label="Admin" active={(view.name as string) === 'admin'} onClick={() => { setView({ name: 'admin' }); }} gold />
          ) : (
            <NavBtn icon={UserIcon} label="Profile" active={tab === 'profile'} onClick={() => { setTab('profile'); setView({ name: 'profile' }); }} />
          )}
        </nav>
      )}

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onChatStarted={(chatId) => { setNewChatOpen(false); setView({ name: 'chat', chatId }); }}
      />

      {canInstall && view.name === 'chats' && (
        <button
          onClick={installPrompt}
          className="absolute bottom-20 left-5 z-30 btn-ghost px-3 py-2 text-xs flex items-center gap-1.5 animate-slide-up"
        >
          <Crown size={13} className="text-gold-300" /> Install App
        </button>
      )}
    </div>
  );
}

const NavBtn = ({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  gold,
}: {
  icon: IconType;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  gold?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition relative ${
      active ? 'text-gold-300' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    <Icon size={22} className={gold && active ? 'text-gold-300' : ''} />
    <span className="text-[10px] font-medium">{label}</span>
    {badge ? (
      <span className="absolute -top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full gold-bg text-ink-900 text-[10px] font-bold flex items-center justify-center">
        {badge}
      </span>
    ) : null}
  </button>
);

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
