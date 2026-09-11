import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bibleReaderHtml } from '@/components/bibleReaderHtml';
import { colors } from '@/constants/theme';
import {
  BIBLE_TRANSLATIONS,
  getBiblePassage,
  type BibleTranslation,
} from '@/data/bible';

function firstParam(value: string | string[] | undefined, fallback = '') {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default function BibleReaderScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    reference?: string | string[];
    translation?: string | string[];
  }>();
  const reference = firstParam(params.reference, 'Genesis 1');
  const initialTranslation = firstParam(params.translation).toUpperCase() === 'WEB' ? 'WEB' : 'KJV';
  const [translation, setTranslation] = useState<BibleTranslation>(initialTranslation);
  const sections = useMemo(() => getBiblePassage(reference, translation), [reference, translation]);
  const html = useMemo(() => bibleReaderHtml(sections), [sections]);

  return (
    <View style={[styles.page, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.title}>{reference}</Text>
          <Text style={styles.subtitle}>Bible Reader</Text>
        </View>
        <View style={styles.translationPicker}>
          {BIBLE_TRANSLATIONS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: translation === option.id }}
              onPress={() => setTranslation(option.id)}
              style={[styles.translationButton, translation === option.id && styles.translationButtonActive]}
            >
              <Text style={[styles.translationText, translation === option.id && styles.translationTextActive]}>{option.shortLabel}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        textInteractionEnabled
        showsHorizontalScrollIndicator={false}
        onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  header: { minHeight: 72, paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { minHeight: 42, justifyContent: 'center', paddingRight: 5 },
  backText: { color: colors.gold, fontSize: 15, fontWeight: '900' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 19, lineHeight: 23, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  translationPicker: { flexDirection: 'row', padding: 3, borderRadius: 13, backgroundColor: colors.panel2 },
  translationButton: { minWidth: 47, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  translationButtonActive: { backgroundColor: colors.gold },
  translationText: { color: colors.ivory, fontSize: 11, fontWeight: '900' },
  translationTextActive: { color: colors.charcoal },
  web: { flex: 1, backgroundColor: '#F7F0E2' },
});
