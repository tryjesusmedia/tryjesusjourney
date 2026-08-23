import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

export default function Index() {
  const { session, guest, loading } = useAuth();
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>;
  return <Redirect href={session || guest ? '/(tabs)/journey' : '/login'} />;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.charcoal } });
