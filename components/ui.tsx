import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function GoldButton({ title, onPress, disabled, loading }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, pressed && styles.pressed, (disabled || loading) && styles.disabled]}>{loading ? <ActivityIndicator color={colors.charcoal} /> : <Text style={styles.buttonText}>{title}</Text>}</Pressable>;
}

export function OutlineButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.outline, pressed && styles.pressed]}><Text style={styles.outlineText}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 20 },
  eyebrow: { color: colors.gold, letterSpacing: 2, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 },
  button: { backgroundColor: colors.gold, borderRadius: radius.md, minHeight: 50, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.charcoal, fontWeight: '900', fontSize: 15 },
  outline: { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: colors.ivory, fontWeight: '800' },
  pressed: { opacity: .78 },
  disabled: { opacity: .45 },
});
