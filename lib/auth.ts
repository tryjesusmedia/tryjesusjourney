import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const oauthRedirectUri = AuthSession.makeRedirectUri({
  scheme: 'tryjesusjourney',
  path: 'auth/callback',
});

export async function signInWithProvider(provider: 'google' | 'facebook' | 'apple') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: oauthRedirectUri,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('The authentication URL was not returned.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectUri);
  if (result.type !== 'success') return false;

  const parsed = new URL(result.url);
  const code = parsed.searchParams.get('code');
  const flowId = parsed.searchParams.get('sb_flow_id');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (exchangeError) throw exchangeError;
    return true;
  }

  // Fallback for projects/providers that return an implicit token response.
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const accessToken = parsed.searchParams.get('access_token') ?? hash.get('access_token');
  const refreshToken = parsed.searchParams.get('refresh_token') ?? hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return true;
  }
  return false;
}
