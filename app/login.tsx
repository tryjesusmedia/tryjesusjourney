import React, { useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/constants/theme';
import { GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const auth = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  async function social(provider: 'google' | 'facebook' | 'apple') {
    try {
      setBusy(provider);
      const fn = provider === 'google' ? auth.signInGoogle : provider === 'facebook' ? auth.signInFacebook : auth.signInApple;
      const ok = await fn();
      if (ok) router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert('Sign in did not finish', e instanceof Error ? e.message : 'Please try again.');
    } finally { setBusy(null); }
  }

  async function guest() { await auth.continueAsGuest(); router.replace('/(tabs)/home'); }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Image source={require('@/assets/logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.kicker}>TRY JESUS: THE JOURNEY</Text>
      <Text style={styles.title}>Continue your journey.</Text>
      <Text style={styles.lead}>Your Bible guides, progress, journal, live discussion and carefully selected resources—together in one private experience.</Text>
      <View style={styles.stack}>
        <GoldButton title="Continue with Google" loading={busy === 'google'} onPress={() => social('google')} />
        <OutlineButton title="Continue with Facebook" onPress={() => social('facebook')} />
        {Platform.OS === 'ios' ? <OutlineButton title="Continue with Apple" onPress={() => social('apple')} /> : null}
        <OutlineButton title="Explore as Guest" onPress={guest} />
      </View>
      <Text style={styles.note}>Google is configured now. Facebook and Apple buttons become active after those providers are enabled in Supabase.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: colors.charcoal, paddingHorizontal: 26, paddingTop: 66, paddingBottom: 40, alignItems: 'center' },
  logo: { width: 170, height: 170, marginBottom: 22 },
  kicker: { color: colors.gold, letterSpacing: 2.4, fontWeight: '900', fontSize: 12, textAlign: 'center' },
  title: { color: colors.text, fontSize: 36, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 460, marginTop: 12 },
  stack: { width: '100%', maxWidth: 440, gap: 12, marginTop: 34 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 22, maxWidth: 440 },
});
