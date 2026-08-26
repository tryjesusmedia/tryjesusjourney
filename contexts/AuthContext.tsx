import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { signInWithProvider } from '@/lib/auth';

const GUEST_KEY = 'tryjesus_guest_mode';

type AuthValue = {
  session: Session | null;
  guest: boolean;
  loading: boolean;
  signInGoogle: () => Promise<boolean>;
  signInFacebook: () => Promise<boolean>;
  signInApple: () => Promise<boolean>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(GUEST_KEY)]).then(([auth, guestFlag]) => {
      setSession(auth.data.session);
      setGuest(guestFlag === 'true' && !auth.data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        setGuest(false);
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => { listener.subscription.unsubscribe(); appState.remove(); };
  }, []);

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, 'true');
    setGuest(true);
  }, []);
  const signOut = useCallback(async () => {
    if (session) await supabase.auth.signOut();
    await AsyncStorage.removeItem(GUEST_KEY);
    setSession(null); setGuest(false);
  }, [session]);

  const value = useMemo<AuthValue>(() => ({
    session, guest, loading,
    signInGoogle: () => signInWithProvider('google'),
    signInFacebook: () => signInWithProvider('facebook'),
    signInApple: () => signInWithProvider('apple'),
    continueAsGuest,
    signOut,
  }), [session, guest, loading, continueAsGuest, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
