import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JourneyLeaderboardModal } from '@/components/JourneyLeaderboardModal';
import { JourneyProgressRewards } from '@/components/JourneyStatusCard';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import {
  chronologicalBiblePlan,
  chronologicalPlanMeta,
  chronologicalReadings,
  type ChronologicalReading,
  type ChronologicalSection,
} from '@/data/chronologicalBiblePlan';
import { useAuth } from '@/contexts/AuthContext';
import { prepareChronologicalDetach } from '@/lib/chronologicalDetach';
import {
  chronologicalLoadIdentity,
  isChronologicalLoadCurrent,
  type ChronologicalLoadToken,
} from '@/lib/chronologicalLoadCore';
import {
  loadChronologicalProgress,
  loadLocalChronologicalProgress,
  saveChronologicalProgress,
  type ChronologicalProgress,
} from '@/lib/chronologicalProgress';
import { summarizeJourneyRewards } from '@/lib/journeyRewardsCore';
import { useJourneyProfile } from '@/lib/useJourneyProfile';
type ChronologicalListItem =
  | { kind: 'section'; section: ChronologicalSection }
  | { kind: 'reading'; reading: ChronologicalReading; searchResult?: boolean }
  | { kind: 'result-heading'; id: 'bible-results'; title: string; count: number };

const emptyProgress: ChronologicalProgress = { completed: [], lastIndex: 0, updatedAt: '' };

export default function ChronologicalBibleScreen() {
  const insets = useSafeAreaInsets();
  const loadGenerationRef = useRef(0);
  const { session, loading: authLoading, signInGoogle, signOut } = useAuth();
  const sessionUserId = session?.user.id;
  const authIdentity = chronologicalLoadIdentity(sessionUserId);
  const [progress, setProgress] = useState<ChronologicalProgress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [taskBusy, setTaskBusy] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(chronologicalBiblePlan[0]?.id ?? null);
  const [expandedReadingId, setExpandedReadingId] = useState<string | null>(null);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const journeyProfile = useJourneyProfile(sessionUserId);

  useFocusEffect(useCallback(() => {
    const generation = ++loadGenerationRef.current;
    setReady(false);
    setLoadedIdentity(null);
    if (authLoading) {
      return () => {
        if (loadGenerationRef.current === generation) loadGenerationRef.current += 1;
      };
    }

    const token: ChronologicalLoadToken = { generation, identity: authIdentity };
    const isCurrent = () => isChronologicalLoadCurrent(token, loadGenerationRef.current, sessionUserId, authLoading);

    void (async () => {
      try {
        const savedProgress = await loadChronologicalProgress(sessionUserId);
        if (!isCurrent()) return;
        setProgress(savedProgress);
        setLoadedIdentity(token.identity);
      } catch (caught) {
        if (!isCurrent()) return;
        Alert.alert('Could not finish syncing', caught instanceof Error ? caught.message : 'Your on-phone copy is still available. Please try again.');
        const localProgress = await loadLocalChronologicalProgress(sessionUserId);
        if (!isCurrent()) return;
        setProgress(localProgress);
        setLoadedIdentity(token.identity);
      } finally {
        if (isCurrent()) setReady(true);
      }
    })();

    return () => {
      if (loadGenerationRef.current === generation) loadGenerationRef.current += 1;
    };
  }, [authIdentity, authLoading, sessionUserId]));

  const completedSet = useMemo(() => new Set(progress.completed), [progress.completed]);
  const journeyRewards = useMemo(() => summarizeJourneyRewards(progress.completed), [progress.completed]);
  const percent = Math.round((progress.completed.length / chronologicalPlanMeta.chapterCount) * 100);
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return chronologicalReadings.filter((reading) =>
      `${reading.number} ${reading.section} ${reading.title} ${reading.reference} ${reading.bibleTasks.map((task) => task.label).join(' ')}`.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const listItems = useMemo<ChronologicalListItem[]>(() => {
    if (normalizedQuery) {
      const items: ChronologicalListItem[] = [];
      if (searchResults.length) {
        items.push({ kind: 'result-heading', id: 'bible-results', title: 'Bible readings', count: searchResults.length });
        items.push(...searchResults.map((reading) => ({ kind: 'reading' as const, reading, searchResult: true })));
      }
      return items;
    }

    return chronologicalBiblePlan.flatMap<ChronologicalListItem>((section) => [
      { kind: 'section', section },
      ...(expandedSectionId === section.id ? section.readings.map((reading) => ({ kind: 'reading' as const, reading })) : []),
    ]);
  }, [expandedSectionId, normalizedQuery, searchResults]);

  async function connectGoogle() {
    if (syncBusy) return;
    setMenuOpen(false);
    setSyncBusy(true);
    try {
      const completed = await signInGoogle();
      if (!completed) return;
      Alert.alert('Google connected', 'Your Chron Bible progress will now stay in sync with the website.');
    } catch (caught) {
      Alert.alert('Google sign-in did not finish', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setSyncBusy(false);
    }
  }

  async function disconnectGoogle() {
    if (!sessionUserId || syncBusy) return;
    setMenuOpen(false);
    setSyncBusy(true);
    try {
      await prepareChronologicalDetach(sessionUserId);
      await signOut();
      Alert.alert('Google disconnected', 'Your Chron Bible progress is available on this phone. Changes will sync if you reconnect this Google account.');
    } catch (caught) {
      Alert.alert('Could not disconnect safely', caught instanceof Error ? caught.message : 'Your on-phone Chron Bible copy could not be prepared. Please try again.');
    } finally {
      setSyncBusy(false);
    }
  }

  async function toggleTask(progressIndex: number, readingIndex: number) {
    if (taskBusy !== null) return;
    const completed = completedSet.has(progressIndex)
      ? progress.completed.filter((index) => index !== progressIndex)
      : [...progress.completed, progressIndex];
    const optimistic: ChronologicalProgress = {
      completed: completed.sort((left, right) => left - right),
      lastIndex: readingIndex,
      updatedAt: new Date().toISOString(),
    };
    setTaskBusy(progressIndex);
    setProgress(optimistic);
    try {
      setProgress(await saveChronologicalProgress(optimistic, sessionUserId));
    } catch {
      setProgress(optimistic);
      Alert.alert('Saved on this phone', 'The sync service could not be reached. This change will sync the next time you open Chron Bible while online.');
    } finally {
      setTaskBusy(null);
    }
  }

  function continueReading() {
    const start = Math.max(0, Math.min(progress.lastIndex, chronologicalReadings.length - 1));
    const next = chronologicalReadings.slice(start).find((reading) => reading.bibleTasks.some((task) => !completedSet.has(task.progressIndex)))
      ?? chronologicalReadings.find((reading) => reading.bibleTasks.some((task) => !completedSet.has(task.progressIndex)))
      ?? chronologicalReadings[0];
    const section = chronologicalBiblePlan.find((candidate) => candidate.title === next.section);
    setQuery(next.title);
    setExpandedSectionId(section?.id ?? null);
    setExpandedReadingId(next.id);
  }

  function openChapter(chapterLabel: string) {
    router.push({ pathname: '/bible-reader' as never, params: { reference: chapterLabel } });
  }

  async function openBibleGateway(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open BibleGateway', 'Please check your connection and try again.');
    }
  }

  const fixedHeader = (
    <View style={styles.fixedHeader}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button"><Text style={styles.backText}>‹ Back</Text></Pressable>
        <View style={styles.topbarActions}>
          <Text style={styles.translation}>KJV + WEB · NATIVE</Text>
          <Pressable onPress={() => setMenuOpen((open) => !open)} style={[styles.menuButton, menuOpen ? styles.menuButtonOpen : undefined]} accessibilityRole="button" accessibilityLabel="Chron Bible menu" accessibilityState={{ expanded: menuOpen }}>
            <View style={styles.menuBar} /><View style={styles.menuBar} /><View style={styles.menuBar} />
          </Pressable>
        </View>
      </View>
      {menuOpen ? (
        <View style={styles.menuCard}>
          <Eyebrow>CHRON BIBLE SYNC</Eyebrow>
          <Text style={styles.menuText}>{session ? `Signed in as ${session.user.email ?? 'your Google account'}.` : 'Sign in only if you want your progress to sync with the website.'}</Text>
          {session
            ? <OutlineButton title={syncBusy ? 'Preparing on-phone copy…' : 'Sign Out of Google Sync'} disabled={syncBusy} onPress={disconnectGoogle} />
            : <GoldButton title="Sign In to Sync" loading={syncBusy || authLoading} onPress={connectGoogle} />}
        </View>
      ) : null}
      <View style={styles.fixedTitleRow}><View style={styles.fixedTitleCopy}><Eyebrow>READ IN HISTORICAL SEQUENCE</Eyebrow><Text style={styles.title}>Chronological Bible</Text></View></View>
      <View style={styles.searchShell}>
        <Text style={styles.searchLabel}>SEARCH BIBLE READINGS</Text>
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon} accessibilityElementsHidden>⌕</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search readings" placeholderTextColor="#665A63" style={styles.search} autoCorrect={false} returnKeyType="search" accessibilityLabel="Search Bible readings" />
          {query ? <Pressable onPress={() => setQuery('')} style={styles.clearSearch} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={styles.clearSearchText}>×</Text></Pressable> : null}
        </View>
      </View>
    </View>
  );

  const listHeader = (
    <View style={styles.headerStack}>
      {normalizedQuery ? (
        <View style={styles.resultSummary}>
          <Text style={styles.resultSummaryTitle}>{searchResults.length} search result{searchResults.length === 1 ? '' : 's'}</Text>
        </View>
      ) : (
        <>
          <Card style={styles.progressCard}>
            <View style={styles.progressHeading}><View><Eyebrow>YOUR PROGRESS</Eyebrow><Text style={styles.progressNumber}>{percent}% complete</Text></View><Text style={styles.progressCount}>{progress.completed.length}/{chronologicalPlanMeta.chapterCount}</Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
            <GoldButton title="Continue Reading" onPress={continueReading} />
            <JourneyProgressRewards summary={journeyRewards} onOpenLeaderboard={() => setLeaderboardVisible(true)} />
          </Card>
        </>
      )}
    </View>
  );

  if (authLoading || !ready || loadedIdentity !== authIdentity) {
    return <View style={[styles.loadingPage, { paddingTop: insets.top }]}><ActivityIndicator color={colors.gold} size="large" /><Text style={styles.loadingText}>Preparing your Bible…</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: Math.max(insets.top, 12) }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {fixedHeader}
      <FlatList<ChronologicalListItem>
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
        data={listItems}
        keyExtractor={(item) => item.kind === 'section' ? `section-${item.section.id}` : item.kind === 'reading' ? `reading-${item.reading.id}` : item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<Card><Text style={styles.emptyTitle}>{normalizedQuery ? 'No matching readings' : 'No readings yet'}</Text><Text style={styles.body}>{normalizedQuery ? 'Try a different word, book, chapter, or reading title.' : 'Choose a section to begin reading.'}</Text></Card>}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        renderItem={({ item }) => {
          if (item.kind === 'result-heading') return <View style={styles.resultHeading}><Text style={styles.resultHeadingText}>{item.title}</Text><Text style={styles.resultHeadingCount}>{item.count}</Text></View>;

          if (item.kind === 'section') {
            const section = item.section;
            const expanded = section.id === expandedSectionId;
            const completeCount = section.readings.filter((reading) => reading.bibleTasks.every((task) => completedSet.has(task.progressIndex))).length;
            return <Card style={[styles.sectionCard, expanded ? styles.sectionCardOpen : undefined]}><Pressable onPress={() => { setExpandedSectionId(expanded ? null : section.id); setExpandedReadingId(null); }} accessibilityRole="button" accessibilityState={{ expanded }}>
              <View style={styles.sectionTopline}><Text style={styles.sectionNumber}>SECTION {String(section.number).padStart(2, '0')}</Text><Text style={styles.sectionChevron}>{expanded ? '−' : '+'}</Text></View>
              <Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.sectionMeta}>{section.readings.length} readings · {completeCount} complete</Text><Text style={styles.sectionAction}>{expanded ? 'Hide readings' : 'Show readings'}</Text>
            </Pressable></Card>;
          }

          const { reading } = item;
          const isExpanded = expandedReadingId === reading.id;
          const readingCompleted = reading.bibleTasks.filter((task) => completedSet.has(task.progressIndex)).length;
          return <Card style={[item.searchResult ? styles.readingResultCard : undefined, isExpanded ? styles.expandedCard : undefined]}>
            {item.searchResult ? <Text style={styles.readingResultBadge}>BIBLE READING</Text> : null}
            <Pressable onPress={() => setExpandedReadingId(isExpanded ? null : reading.id)}>
              <View style={styles.readingTopline}><Text style={styles.readingNumber}>READING {reading.number}</Text><Text style={styles.readingCount}>{readingCompleted}/{reading.bibleTasks.length} chapters</Text></View>
              <Text style={styles.readingTitle}>{reading.title}</Text><Text style={styles.sectionLabel}>{reading.section}</Text><Text style={styles.expandLabel}>{isExpanded ? 'Hide reading ↑' : 'Open reading ↓'}</Text>
            </Pressable>
            {isExpanded ? <View style={styles.expandedContent}>{reading.bibleTasks.map((task) => {
              const isComplete = completedSet.has(task.progressIndex);
              return <View key={task.progressIndex} style={styles.chapterBlock}><View style={styles.chapterRow}>
                <Pressable onPress={() => toggleTask(task.progressIndex, reading.index)} disabled={taskBusy !== null} style={[styles.checkbox, isComplete && styles.checkboxComplete]} accessibilityRole="checkbox" accessibilityState={{ checked: isComplete }}><Text style={styles.checkmark}>{taskBusy === task.progressIndex ? '…' : isComplete ? '✓' : ''}</Text></Pressable>
                <View style={styles.chapterActions}>
                  <Pressable onPress={() => openChapter(task.label)} style={styles.chapterButton} accessibilityRole="button" accessibilityLabel={`Read ${task.label} in the app`}>
                    <Text style={[styles.chapterLabel, isComplete && styles.chapterComplete]}>{task.label}</Text>
                  </Pressable>
                  <View style={styles.chapterDivider} />
                  <Pressable onPress={() => void openBibleGateway(task.url)} style={styles.gatewayButton} accessibilityRole="link" accessibilityLabel={`Read ${task.label} on BibleGateway`}>
                    <Text style={styles.gatewayLabel}>Read on BibleGateway</Text>
                  </Pressable>
                </View>
              </View></View>;
            })}</View> : null}
          </Card>;
        }}
      />
      <JourneyLeaderboardModal
        key={sessionUserId ?? 'guest'}
        visible={leaderboardVisible}
        signedIn={Boolean(sessionUserId)}
        aliasSaving={journeyProfile.saving}
        signInBusy={syncBusy || authLoading}
        onRequestClose={() => setLeaderboardVisible(false)}
        onSignIn={connectGoogle}
        onSaveAlias={journeyProfile.saveAlias}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal }, list: { flex: 1 }, loadingPage: { flex: 1, backgroundColor: colors.charcoal, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: colors.muted, fontSize: 14 },
  content: { paddingHorizontal: 18, paddingTop: 12 }, fixedHeader: { backgroundColor: colors.charcoal, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, headerStack: { gap: 14, marginBottom: 16 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, backButton: { paddingVertical: 8, paddingRight: 14 }, backText: { color: colors.gold, fontSize: 16, fontWeight: '800' }, translation: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  menuButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 4 }, menuButtonOpen: { borderColor: colors.gold, backgroundColor: colors.panel2 }, menuBar: { width: 20, height: 2, borderRadius: 2, backgroundColor: colors.gold }, menuCard: { marginTop: 8, marginBottom: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel2 }, menuText: { color: colors.ivory, fontSize: 13, lineHeight: 20, marginBottom: 13 },
  fixedTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, fixedTitleCopy: { flex: 1 }, title: { color: colors.text, fontSize: 28, fontWeight: '900', lineHeight: 34 }, progressCard: { backgroundColor: colors.plum }, progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressNumber: { color: colors.text, fontSize: 24, fontWeight: '900' }, progressCount: { color: colors.gold, fontSize: 15, fontWeight: '900' }, progressTrack: { height: 9, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.13)', overflow: 'hidden', marginVertical: 14 }, progressFill: { height: '100%', borderRadius: 20, backgroundColor: colors.gold },
  body: { color: colors.ivory, fontSize: 14, lineHeight: 21, marginBottom: 14 }, searchShell: { backgroundColor: colors.gold, borderRadius: 18, padding: 3, shadowColor: '#000', shadowOpacity: .24, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 }, searchLabel: { color: colors.charcoal, fontSize: 10, lineHeight: 16, fontWeight: '900', letterSpacing: 1.5, paddingHorizontal: 11, paddingTop: 3, paddingBottom: 1 }, searchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 15, backgroundColor: '#FFF7E6', paddingHorizontal: 12 }, searchIcon: { color: '#3A2C34', fontSize: 25, fontWeight: '900', marginRight: 7, marginTop: -2 }, search: { flex: 1, minHeight: 50, paddingVertical: 10, color: '#241C22', fontSize: 16, fontWeight: '700' }, clearSearch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D9BF' }, clearSearchText: { color: '#3A2C34', fontSize: 24, lineHeight: 27, fontWeight: '800' },
  resultSummary: { backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.gold, borderRadius: 18, padding: 15 }, resultSummaryTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, resultHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingHorizontal: 3 }, resultHeadingText: { color: colors.text, fontSize: 18, fontWeight: '900' }, resultHeadingCount: { minWidth: 28, height: 28, borderRadius: 14, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.gold, color: colors.charcoal, fontSize: 12, fontWeight: '900' }, separator: { height: 12 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 5 },
  sectionCard: { backgroundColor: colors.plum, borderColor: 'rgba(238,189,74,.38)' }, sectionCardOpen: { backgroundColor: colors.plum2, borderColor: colors.gold }, sectionTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionNumber: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, sectionChevron: { color: colors.gold, fontSize: 26, lineHeight: 27, fontWeight: '500' }, sectionTitle: { color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900', marginTop: 7 }, sectionMeta: { color: colors.ivory, fontSize: 12, lineHeight: 18, marginTop: 6 }, sectionAction: { color: colors.gold, fontSize: 12, fontWeight: '900', marginTop: 12 },
  readingResultCard: { borderColor: colors.gold }, readingResultBadge: { alignSelf: 'flex-start', color: colors.charcoal, backgroundColor: colors.gold, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 11 },
  expandedCard: { borderColor: colors.gold, backgroundColor: colors.panel2 }, readingTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, readingNumber: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, readingCount: { color: colors.muted, fontSize: 11, fontWeight: '800' }, readingTitle: { color: colors.text, fontSize: 19, fontWeight: '900', lineHeight: 25, marginTop: 8 }, sectionLabel: { color: colors.muted, fontSize: 12, marginTop: 5 }, expandLabel: { color: colors.gold, fontSize: 12, fontWeight: '900', marginTop: 12 }, expandedContent: { marginTop: 18, gap: 10 }, chapterBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }, chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 11 }, checkbox: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' }, checkboxComplete: { backgroundColor: colors.green, borderColor: colors.green }, checkmark: { color: colors.charcoal, fontWeight: '900', fontSize: 18 }, chapterActions: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'stretch', borderRadius: 10, backgroundColor: 'rgba(255,255,255,.025)' }, chapterButton: { flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: 8 }, chapterLabel: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' }, chapterComplete: { color: colors.muted, textDecorationLine: 'line-through' }, chapterDivider: { width: 1, marginVertical: 8, backgroundColor: colors.border }, gatewayButton: { flex: 1.25, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 7 }, gatewayLabel: { color: colors.gold, fontSize: 11, lineHeight: 15, fontWeight: '900', textAlign: 'center' },
});
