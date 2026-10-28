import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { COUNTRIES } from '@/lib/countries';
import { Mail, Lock, User as UserIcon, Globe, Eye, EyeOff, Loader2, Crown, Zap, ShieldCheck, Coins, Globe2, ArrowRight } from 'lucide-react';
import type { IconType } from '@/lib/icons';

type Mode = 'login' | 'register' | 'forgot';

export const AuthScreen = ({ initial = 'login' }: { initial?: Mode }) => {
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('KE');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      } else if (mode === 'register') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || 'Gold User', country },
          },
        });
        if (err) throw err;
        if (data.user) {
          // upsert profile (in case trigger timing)
          await supabase.from('bg_profiles').upsert({
            id: data.user.id,
            email: email.trim(),
            display_name: displayName.trim() || 'Gold User',
            country,
          });
        }
        setInfo('Account created! You are now signed in.');
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (err) throw err;
        setInfo('Password reset link sent to your email.');
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Invalid login')) setError('Wrong email or password.');
      else if (msg.includes('already registered')) setError('That email is already registered. Try logging in.');
      else if (msg.includes('rate limit')) setError('Too many attempts. Please wait a moment.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ink-900">
      {/* Hero panel */}
      <div className="relative lg:w-1/2 overflow-hidden bg-ink-950 px-6 py-10 lg:p-14 flex flex-col justify-center">
        <div className="absolute inset-0 bg-gold-radial" />
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gold-300/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative z-10 max-w-lg">
          <Logo size="lg" />
          <h1 className="mt-8 font-display text-4xl lg:text-5xl font-extrabold leading-tight">
            Chat Like a <span className="gold-text">King</span> <Crown className="inline text-gold-300" size={40} />
          </h1>
          <p className="mt-4 text-lg text-gray-300">
            Kenya's Premium Gold Chat. Connect with anyone worldwide with just an email — no phone number, no limits.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: Globe2, text: 'Global reach — chat with Kenya & beyond, email only' },
              { icon: Crown, text: 'Gold verified badge for premium members' },
              { icon: Coins, text: 'Earn Work Coins by completing tasks — 1 coin = 1 KES' },
              { icon: ShieldCheck, text: 'Encrypted, private, exclusive' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-gray-200">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg gold-bg text-ink-900 shrink-0">
                  <Icon size={18} strokeWidth={2.5} />
                </span>
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-center gap-2 text-xs text-gray-500">
            <Zap size={14} className="text-gold-300" /> blazegold.chat
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="lg:w-1/2 flex items-center justify-center px-6 py-10 lg:p-14">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="md" />
          </div>
          <h2 className="font-display text-2xl font-bold">
            {mode === 'login' && 'Welcome back'}
            {mode === 'register' && 'Join the Gold'}
            {mode === 'forgot' && 'Reset password'}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {mode === 'login' && 'Sign in to your premium account'}
            {mode === 'register' && 'Create your free BlazeGold account'}
            {mode === 'forgot' && 'We will email you a reset link'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field icon={Mail} label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="input-gold w-full px-3 py-3 pl-10 text-sm"
              />
            </Field>

            {mode !== 'forgot' && (
              <Field icon={Lock} label="Password">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-gold w-full px-3 py-3 pl-10 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gold-300"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </Field>
            )}

            {mode === 'register' && (
              <>
                <Field icon={UserIcon} label="Display name">
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="input-gold w-full px-3 py-3 pl-10 text-sm"
                  />
                </Field>
                <Field icon={Globe} label="Country">
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="input-gold w-full px-3 py-3 pl-10 text-sm appearance-none"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-ink-850">
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {mode === 'login' && (
              <label className="flex items-center gap-2 text-sm text-gray-300 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-gold-300 w-4 h-4"
                />
                Remember me
              </label>
            )}

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {info && (
              <div className="text-sm text-gold-200 bg-gold-300/10 border border-gold-300/20 rounded-lg px-3 py-2">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {mode === 'login' && 'Sign in'}
                  {mode === 'register' && 'Create account'}
                  {mode === 'forgot' && 'Send reset link'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-sm text-gray-400">
            {mode === 'login' && (
              <>
                <button onClick={() => { setMode('forgot'); setError(''); setInfo(''); }} className="hover:text-gold-300 text-left">
                  Forgot password?
                </button>
                <p>
                  New here?{' '}
                  <button onClick={() => { setMode('register'); setError(''); setInfo(''); }} className="text-gold-300 font-semibold hover:underline">
                    Create an account
                  </button>
                </p>
              </>
            )}
            {mode === 'register' && (
              <p>
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); setInfo(''); }} className="text-gold-300 font-semibold hover:underline">
                  Sign in
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                <button onClick={() => { setMode('login'); setError(''); setInfo(''); }} className="text-gold-300 font-semibold hover:underline">
                  Back to sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  icon: Icon,
  label,
  children,
}: {
  icon: IconType;
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">{label}</label>
    <div className="relative">
      <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-300/70" />
      {children}
    </div>
  </div>
);
