import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function GoldButton({ title, onPress, disabled, loading }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, pressed && styles.pressed, (disabled || loading) && styles.disabled]}>{loading ? <ActivityIndicator color={colors.charcoal} /> : <Text style={styles.buttonText}>{title}</Text>}</Pressable>;
}

export function OutlineButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.outline, pressed && styles.pressed, disabled && styles.disabled]}><Text style={styles.outlineText}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 20 },
  eyebrow: { color: colors.gold, letterSpacing: 1, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 },
  button: { backgroundColor: colors.gold, borderRadius: radius.md, minHeight: 56, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.charcoal, fontWeight: '800', fontSize: 18, textAlign: 'center' },
  outline: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, minHeight: 52, paddingVertical: 12, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: colors.ivory, fontWeight: '700', fontSize: 17, textAlign: 'center' },
  pressed: { opacity: .78 },
  disabled: { opacity: .45 },
});
