import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { createAuthCallbackHandler } from '@/lib/authCallback';

WebBrowser.maybeCompleteAuthSession();

export const oauthRedirectUri = AuthSession.makeRedirectUri({
  scheme: 'tryjesusjourney',
  path: 'auth/callback',
});

export const completeAuthCallback = createAuthCallbackHandler(supabase.auth);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: oauthRedirectUri, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('The authentication URL was not returned.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectUri);
  if (result.type !== 'success') return false;
  return completeAuthCallback(result.url);
}
