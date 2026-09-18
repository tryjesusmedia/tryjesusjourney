import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useURL } from 'expo-linking';
import { completeAuthCallback, oauthRedirectUri } from '@/lib/auth';
import { GoldButton } from '@/components/ui';
import { colors } from '@/constants/theme';

export default function AuthCallback() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const incomingUrl = useURL();
  const [error, setError] = useState('');
  const query = new URLSearchParams();
  for (const key of ['code', 'sb_flow_id', 'error', 'error_description', 'access_token', 'refresh_token']) {
    const value = params[key];
    if (typeof value === 'string') query.set(key, value);
  }
  // Router parameters cover PKCE and query tokens, including cold launches.
  // Preserve the incoming fragment for providers returning implicit tokens.
  const callbackQuery = query.toString();
  const callbackUrl = callbackQuery ? `${oauthRedirectUri}?${callbackQuery}` : incomingUrl;

  useEffect(() => {
    let mounted = true;
    void completeAuthCallback(callbackUrl ?? oauthRedirectUri).then(() => {
      if (!mounted) return;
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/home');
    }).catch(() => {
      if (mounted) setError('We could not finish signing you in. Please return to the app and try again.');
    });
    return () => { mounted = false; };
  }, [callbackUrl]);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{error ? 'Sign-in not completed' : 'Finishing sign-in…'}</Text>
      {error ? <>
        <Text style={styles.message}>{error}</Text>
        <GoldButton title="Return to the app" onPress={() => router.replace('/(tabs)/home')} />
      </> : <ActivityIndicator accessibilityLabel="Finishing sign-in" color={colors.gold} size="large" />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24, gap: 20, backgroundColor: colors.charcoal },
  title: { color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: '900', textAlign: 'center' },
  message: { color: colors.ivory, fontSize: 18, lineHeight: 27, textAlign: 'center' },
});
