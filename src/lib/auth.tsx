import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string, email?: string) => {
    const fetchOnce = async () => {
      const { data, error } = await supabase
        .from('bg_profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      if (error) {
        console.warn('profile load error', error.message);
        return null;
      }
      return data as Profile | null;
    };

    let profile = await fetchOnce();
    if (!profile) {
      // trigger may still be committing; retry once
      await new Promise((r) => setTimeout(r, 500));
      profile = await fetchOnce();
    }
    if (!profile && email) {
      // trigger did not run; create manually (is_admin not settable here)
      const { data: created } = await supabase
        .from('bg_profiles')
        .insert({ id: uid, email })
        .select('*')
        .maybeSingle();
      if (created) setProfile(created as Profile);
      return;
    }
    if (profile) setProfile(profile);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id, user.email ?? undefined);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id, data.session.user.email ?? undefined).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await loadProfile(sess.user.id, sess.user.email ?? undefined);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // presence: mark online/offline
  useEffect(() => {
    if (!user) return;
    const setOnline = async () => {
      await supabase
        .from('bg_profiles')
        .update({ online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };
    const setOffline = async () => {
      await supabase
        .from('bg_profiles')
        .update({ online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };
    setOnline();
    const onVis = () => (document.hidden ? setOffline() : setOnline());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', setOffline);
    const interval = setInterval(() => {
      if (!document.hidden) setOnline();
    }, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', setOffline);
      clearInterval(interval);
      setOffline();
    };
  }, [user]);

  const signOut = async () => {
    if (user) {
      await supabase
        .from('bg_profiles')
        .update({ online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    }
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <Ctx.Provider value={{ session, user, profile, loading, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
};
