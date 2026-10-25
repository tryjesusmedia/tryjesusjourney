import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { savePassword } from '@/lib/auth';
import { colors } from '@/constants/theme';
import { GoldButton, OutlineButton } from '@/components/ui';

export default function PasswordScreen() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function submit() {
    if (!session || busy || saved) return;
    if (password.length < 12) { setError('Use at least 12 characters.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await savePassword(password); setPassword(''); setConfirm(''); setSaved(true); }
    catch { setError('We could not update your password. You may need a fresh reset link or to sign in again.'); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}>
    <Text style={styles.title}>{saved ? 'Password saved' : 'Choose your password'}</Text>
    {session && !saved ? <>
      <Text style={styles.body}>Set a password for {session.user.email}. Use at least 12 characters.</Text>
      <Text style={styles.body}>New password</Text><TextInput style={styles.input} accessibilityLabel="New password" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" value={password} onChangeText={setPassword} editable={!busy} />
      <Text style={styles.body}>Confirm password</Text><TextInput style={styles.input} accessibilityLabel="Confirm password" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" value={confirm} onChangeText={setConfirm} editable={!busy} />
      <GoldButton title="Save password" loading={busy} onPress={() => { void submit(); }} />
    </> : <Text style={styles.body}>{saved ? 'You can now sign in with your account email and this password. Your reading progress stays in the same account.' : loading ? 'Preparing your account…' : 'Open your password reset link on this phone, or sign in before setting a password.'}</Text>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <OutlineButton title={session ? 'Back to reading' : 'Go to sign-in'} disabled={busy} onPress={() => router.replace(session ? '/(tabs)/bible' : '/login')} />
  </ScrollView></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.charcoal }, content: { padding: 24, gap: 18, maxWidth: 600, width: '100%', alignSelf: 'center' }, title: { color: colors.text, fontWeight: '800', fontSize: 30, lineHeight: 38 }, body: { color: colors.ivory, fontSize: 18, lineHeight: 27 }, input: { color: colors.text, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 56, padding: 14, fontSize: 18 }, error: { color: colors.red, fontSize: 18 } });
