import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/auth';
import { preserveLegacyCloudData } from '@/lib/legacyCloudData';

type AuthValue = {
  session: Session | null;
  loading: boolean;
  signInGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => { listener.subscription.unsubscribe(); appState.remove(); };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    preserveLegacyCloudData(userId).catch((error) => {
      console.warn('Could not check for legacy account data yet.', error);
    });
  }, [session?.access_token, session?.user.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    session, loading,
    signInGoogle: signInWithGoogle,
    signOut,
  }), [session, loading, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
