import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleHighlightsWindow, BibleNotesButton } from '@/components/BibleHighlights';
import { bibleReaderHtml } from '@/components/bibleReaderHtml';
import { colors } from '@/constants/theme';
import {
  BIBLE_TRANSLATIONS,
  getBiblePassage,
  referenceForOffsets,
  type BibleTranslation,
} from '@/data/bible';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_HEX, type HighlightColor } from '@/lib/bibleHighlightsCore';
import { useBibleHighlights } from '@/lib/useBibleHighlights';

type PendingSelection = {
  chapterLabel: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
};

type ReaderMessage = Partial<PendingSelection> & {
  type?: 'ready' | 'scroll' | 'selection' | 'dismiss-selection' | 'open-highlight';
  id?: string;
  scrollY?: number;
};

function firstParam(value: string | string[] | undefined, fallback = '') {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default function BibleReaderScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    reference?: string | string[];
    readingId?: string | string[];
    planId?: string | string[];
    translation?: string | string[];
  }>();
  const reference = firstParam(params.reference, 'Genesis 1');
  const readingId = firstParam(params.readingId, `bible:${reference}`);
  const planId = firstParam(params.planId, 'bible-library');
  const initialTranslation = firstParam(params.translation).toUpperCase() === 'WEB' ? 'WEB' : 'KJV';
  const [translation, setTranslation] = useState<BibleTranslation>(initialTranslation);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [notesVisible, setNotesVisible] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const lastScrollY = useRef(0);
  const webRef = useRef<WebView>(null);
  const { highlights, ready, create, update, remove } = useBibleHighlights();
  const sections = useMemo(() => getBiblePassage(reference, translation), [reference, translation]);
  const visibleChapterLabels = useMemo(() => new Set(sections.map((section) => section.chapterLabel)), [sections]);
  const visibleHighlights = useMemo(() => highlights.filter((highlight) => (
    highlight.translation === translation && visibleChapterLabels.has(highlight.chapterLabel)
  )), [highlights, translation, visibleChapterLabels]);
  const html = useMemo(() => bibleReaderHtml(sections, visibleHighlights), [sections, visibleHighlights]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as ReaderMessage;
      if (typeof message.scrollY === 'number') lastScrollY.current = Math.max(0, message.scrollY);
      if (message.type === 'dismiss-selection') setPendingSelection(null);
      if (message.type === 'open-highlight' && message.id) {
        setPendingSelection(null);
        setNotesVisible(false);
        setSelectedHighlightId(message.id);
      }
      if (
        message.type === 'selection'
        && ready
        && typeof message.chapterLabel === 'string'
        && typeof message.startOffset === 'number'
        && typeof message.endOffset === 'number'
      ) {
        const section = sections.find((candidate) => candidate.chapterLabel === message.chapterLabel);
        if (!section) return;
        const unclampedStart = Math.max(0, Math.min(section.fullText.length, message.startOffset));
        const unclampedEnd = Math.max(unclampedStart, Math.min(section.fullText.length, message.endOffset));
        const canonicalSelection = section.fullText.slice(unclampedStart, unclampedEnd);
        const leading = canonicalSelection.match(/^\s*/u)?.[0].length ?? 0;
        const trailing = canonicalSelection.match(/\s*$/u)?.[0].length ?? 0;
        const startOffset = unclampedStart + leading;
        const endOffset = unclampedEnd - trailing;
        const selectedText = section.fullText.slice(startOffset, endOffset);
        if (selectedText && endOffset > startOffset) {
          setPendingSelection({ chapterLabel: message.chapterLabel, startOffset, endOffset, selectedText });
        }
      }
    } catch {
      // Ignore messages that were not produced by the local Bible reader.
    }
  }

  async function chooseColor(color: HighlightColor) {
    if (!ready || !pendingSelection || selectionBusy) return;
    const overlap = visibleHighlights.find((highlight) => (
      highlight.chapterLabel === pendingSelection.chapterLabel
      && highlight.startOffset < pendingSelection.endOffset
      && highlight.endOffset > pendingSelection.startOffset
    ));
    if (overlap) {
      setPendingSelection(null);
      setNotesVisible(false);
      setSelectedHighlightId(overlap.id);
      Alert.alert('Already highlighted', 'Part of this selection is already highlighted. Use Edit to change its color or note.');
      return;
    }
    setSelectionBusy(true);
    try {
      await create({
        planId,
        readingId,
        chapterLabel: pendingSelection.chapterLabel,
        reference: referenceForOffsets(
          pendingSelection.chapterLabel,
          translation,
          pendingSelection.startOffset,
          pendingSelection.endOffset,
        ),
        translation,
        startOffset: pendingSelection.startOffset,
        endOffset: pendingSelection.endOffset,
        selectedText: pendingSelection.selectedText,
        color,
      });
      setPendingSelection(null);
    } catch (caught) {
      Alert.alert('Could not save highlight', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setSelectionBusy(false);
    }
  }

  function chooseTranslation(next: BibleTranslation) {
    if (next === translation) return;
    lastScrollY.current = 0;
    setPendingSelection(null);
    setTranslation(next);
  }

  return (
    <View style={[styles.page, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.header} onTouchStart={() => setPendingSelection(null)}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Back</Text></Pressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.title}>{reference}</Text>
          <Text style={styles.subtitle}>Bible Reader</Text>
        </View>
        <View style={styles.translationPicker}>
          {BIBLE_TRANSLATIONS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: translation === option.id }}
              onPress={() => chooseTranslation(option.id)}
              style={[styles.translationButton, translation === option.id && styles.translationButtonActive]}
            >
              <Text style={[styles.translationText, translation === option.id && styles.translationTextActive]}>{option.shortLabel}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled={false}
        textInteractionEnabled
        showsHorizontalScrollIndicator={false}
        onLoadEnd={() => {
          const y = Math.max(0, Math.round(lastScrollY.current));
          webRef.current?.injectJavaScript(`window.scrollTo(0, ${y}); true;`);
        }}
        onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
      />

      {!ready ? (
        <View style={styles.highlightsLoading}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.highlightsLoadingText}>Loading your highlights…</Text>
        </View>
      ) : null}

      {pendingSelection && ready ? (
        <View style={[styles.palette, { bottom: Math.max(insets.bottom, 12) + 70 }]}>
          <Text style={styles.paletteLabel}>{selectionBusy ? 'SAVING…' : 'CHOOSE A HIGHLIGHT COLOR'}</Text>
          <View style={styles.paletteColors}>
            {HIGHLIGHT_COLORS.map((color) => (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={`Highlight ${color}`}
                disabled={selectionBusy}
                onPress={() => chooseColor(color)}
                style={[styles.paletteColor, { backgroundColor: HIGHLIGHT_COLOR_HEX[color] }]}
              />
            ))}
          </View>
          {selectionBusy ? <ActivityIndicator color={colors.gold} style={styles.paletteBusy} /> : null}
        </View>
      ) : null}

      <BibleNotesButton
        count={highlights.length}
        bottom={Math.max(insets.bottom, 12)}
        onPress={() => { setPendingSelection(null); setSelectedHighlightId(null); setNotesVisible(true); }}
      />
      <BibleHighlightsWindow
        highlights={highlights}
        ready={ready}
        notesVisible={notesVisible}
        selectedHighlightId={selectedHighlightId}
        onCloseNotes={() => { setNotesVisible(false); setSelectedHighlightId(null); }}
        onSelectHighlight={setSelectedHighlightId}
        onUpdate={update}
        onDelete={remove}
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
  highlightsLoading: { position: 'absolute', zIndex: 45, elevation: 16, left: 16, right: 16, top: 84, minHeight: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  highlightsLoadingText: { color: colors.ivory, fontSize: 12, fontWeight: '800' },
  palette: { position: 'absolute', zIndex: 60, elevation: 24, left: 16, right: 16, minHeight: 67, borderRadius: 17, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.gold, shadowColor: '#000', shadowOpacity: .35, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  paletteLabel: { color: colors.ivory, fontSize: 9, lineHeight: 13, fontWeight: '900', letterSpacing: 1 },
  paletteColors: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 7 },
  paletteColor: { width: 31, height: 31, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,.72)' },
  paletteBusy: { position: 'absolute', right: 8, top: 8 },
});
