import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';
import { GoldButton, OutlineButton } from '@/components/ui';
import { registerWithEmail, requestPasswordReset, signInWithApple, signInWithEmail, signInWithProvider } from '@/lib/auth';

type Mode = 'signin' | 'signup' | 'reset';
export default function LoginScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);
  const managing = Boolean(session);
  const finish = () => { setPassword(''); router.replace('/(tabs)/bible'); };
  function changeMode(next: Mode) { setMode(next); setPassword(''); setMessage(''); setError(''); }
  async function social(provider: 'google' | 'apple') {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const completed = provider === 'apple' ? await signInWithApple(managing) : await signInWithProvider('google', managing);
      if (completed) {
        if (managing) setMessage('Sign-in method connected. Your reading progress stays in this account.');
        else finish();
      }
    } catch { setError('We could not complete sign-in. Please try again or use another method.'); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (busy) return;
    setError(''); setMessage('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter your email address.'); return; }
    if (mode !== 'reset' && password.length < (mode === 'signup' ? 6 : 1)) {
      setError(mode === 'signup' ? 'Choose a password with at least 6 characters.' : 'Please enter your password.'); return;
    }
    setBusy(true);
    try {
      if (mode === 'reset') {
        await requestPasswordReset(email);
        setMessage('If this email has an account, a password reset link will arrive shortly. Check your inbox and spam folder. Open it on this phone.');
      } else if (mode === 'signup') {
        if (await registerWithEmail(email, password)) finish();
        else { setPassword(''); setMessage('Check your email to confirm your account. Open the link on this phone, then return here to sign in. If you already have an account, use Sign in or Forgot password.'); }
      } else { await signInWithEmail(email, password); finish(); }
    } catch {
      setError(mode === 'signin' ? 'Sign-in failed. Check your email and password, confirm your email, or choose Forgot password.' : 'We could not complete this request. Please try again shortly.');
    } finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}>
      <Text style={styles.title}>{managing ? 'Your sign-in methods' : 'Keep your place everywhere.'}</Text>
      <Text style={styles.body}>{managing ? `Signed in as ${session?.user.email ?? 'Try Jesus member'}. Connect another method here to keep the same account, including when Apple hides your email.` : 'Sign in to save your reading progress across devices. You can also continue as a guest.'}</Text>
      {Platform.OS === 'ios' ? appleAvailable ? <View pointerEvents={busy ? 'none' : 'auto'} accessibilityState={{ disabled: busy }}>
        <AppleAuthentication.AppleAuthenticationButton buttonType={managing ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE} cornerRadius={12} style={styles.apple} onPress={() => { void social('apple'); }} />
      </View> : null : <OutlineButton title={managing ? 'Connect Apple' : 'Continue with Apple'} disabled={busy} onPress={() => { void social('apple'); }} />}
      <OutlineButton title={managing ? 'Connect Google' : 'Continue with Google'} disabled={busy} onPress={() => { void social('google'); }} />
      {managing ? <>
        <OutlineButton title="Set or change email password" disabled={busy} onPress={() => router.push('/auth/password')} />
        <Text style={styles.body}>Your account email is shown above. Use it for email sign-in after setting a password. Apple relay addresses also work as account emails.</Text>
      </> : <>
        <Text style={styles.heading}>{mode === 'signup' ? 'Create an email account' : mode === 'reset' ? 'Reset your password' : 'Sign in with email'}</Text>
        <Text style={styles.label}>Email address</Text>
        <TextInput style={styles.input} accessibilityLabel="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!busy} />
        {mode !== 'reset' ? <><Text style={styles.label}>Password</Text><TextInput style={styles.input} accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'} editable={!busy} />{mode === 'signup' ? <Text style={styles.body}>Use at least 6 characters.</Text> : null}</> : null}
        <GoldButton title={mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'} loading={busy} onPress={() => { void submit(); }} />
        <OutlineButton title={mode === 'signin' ? 'Create an email account' : 'Back to email sign-in'} disabled={busy} onPress={() => changeMode(mode === 'signin' ? 'signup' : 'signin')} />
        {mode === 'signin' ? <OutlineButton title="Forgot password?" disabled={busy} onPress={() => changeMode('reset')} /> : null}
        <Text style={styles.body}>Already use Google or Apple? Sign in that way first, then add a password or connect another method from Account &amp; help.</Text>
      </>}
      {busy ? <ActivityIndicator accessibilityLabel="Connecting" color={colors.gold} /> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <OutlineButton title={managing ? 'Back to reading' : 'Continue as guest'} disabled={busy} onPress={finish} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  content: { padding: 24, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center' },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800', color: colors.text },
  heading: { fontSize: 23, fontWeight: '700', color: colors.text, marginTop: 8 },
  body: { fontSize: 17, lineHeight: 25, color: colors.muted },
  label: { fontSize: 18, color: colors.ivory },
  input: { minHeight: 56, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, backgroundColor: colors.panel, fontSize: 18 },
  apple: { width: '100%', height: 56 },
  error: { fontSize: 17, lineHeight: 25, color: colors.red },
  success: { fontSize: 17, lineHeight: 25, color: colors.green },
});
