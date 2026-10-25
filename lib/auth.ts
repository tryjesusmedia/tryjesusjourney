import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
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

export async function signInWithProvider(provider: 'google' | 'apple', link = false) {
  const request = {
    provider,
    options: { redirectTo: oauthRedirectUri, skipBrowserRedirect: true },
  };
  const { data, error } = link
    ? await supabase.auth.linkIdentity(request)
    : await supabase.auth.signInWithOAuth(request);
  if (error) throw error;
  if (!data.url) throw new Error('The authentication URL was not returned.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectUri);
  if (result.type !== 'success') return false;
  return completeAuthCallback(result.url);
}


export const signInWithGoogle = () => signInWithProvider('google');

export async function signInWithApple(link = false) {
  if (Platform.OS !== 'ios') return signInWithProvider('apple', link);
  if (!await AppleAuthentication.isAvailableAsync()) throw new Error('Apple sign-in is unavailable on this device. Please use email or Google.');
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('Apple did not return a sign-in token. Please try again.');
    const request = { provider: 'apple' as const, token: credential.identityToken, nonce };
    const { error } = link ? await supabase.auth.linkIdentity(request) : await supabase.auth.signInWithIdToken(request);
    if (error) throw error;
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    // Apple returns the name only on first consent. It is display data, never authorization.
    if (name) await supabase.auth.updateUser({ data: { full_name: name } });
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function registerWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: oauthRedirectUri } });
  if (error) throw error;
  return Boolean(data.session);
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${oauthRedirectUri}?next=recovery` });
  if (error) throw error;
}

export async function savePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
