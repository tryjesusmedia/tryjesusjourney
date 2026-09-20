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
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EarnedReadingBadges, ReadingBadgeButton, ReadingBadgeProvider } from '@/components/ReadingBadges';
import { JourneyLeaderboardModal } from '@/components/JourneyLeaderboardModal';
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
  | { kind: 'reading'; reading: ChronologicalReading };

const emptyProgress: ChronologicalProgress = { completed: [], lastIndex: 0, updatedAt: '' };

type ChronologicalBibleContentProps = {
  showBackButton?: boolean;
};

export function ChronologicalBibleContent({ showBackButton = true }: ChronologicalBibleContentProps) {
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
  const [activeView, setActiveView] = useState<'journey' | 'progress' | 'leaderboard'>('journey');
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(chronologicalBiblePlan[0]?.id ?? null);
  const [expandedReadingId, setExpandedReadingId] = useState<string | null>(null);
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
  const listItems = useMemo<ChronologicalListItem[]>(() => {
    if (activeView !== 'journey') return [];
    return chronologicalBiblePlan.flatMap<ChronologicalListItem>((section) => [
      { kind: 'section', section },
      ...(expandedSectionId === section.id ? section.readings.map((reading) => ({ kind: 'reading' as const, reading })) : []),
    ]);
  }, [activeView, expandedSectionId]);

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
        {showBackButton
          ? <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button"><Text style={styles.backText}>‹ Back</Text></Pressable>
          : <View />}
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
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['journey', 'progress', 'leaderboard'] as const).map((tab) => {
          const selected = activeView === tab;
          return <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected }} style={[styles.tab, selected && styles.tabSelected]} onPress={() => {
            setActiveView(tab);
          }}><Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab === 'journey' ? 'Journey' : tab === 'progress' ? 'Progress' : 'Leaderboard'}</Text></Pressable>;
        })}
      </View>
    </View>
  );

  const listHeader = (
    <View style={styles.headerStack}>
      {activeView === 'journey' ? <View>
        <Eyebrow>THE COMPLETE SEQUENCE</Eyebrow>
        <Text style={styles.viewTitle}>The chronological journey</Text>
        <Text style={styles.viewDescription}>Across {chronologicalBiblePlan.length} major historical sections, the complete journey is organized into {chronologicalReadings.length} manageable, named reading tasks, including all 42 chapters of Job between Genesis 11 and Genesis 12.</Text>
      </View> : null}
      {activeView === 'progress' ? <>
        <View><Eyebrow>YOUR READING PROGRESS</Eyebrow><Text style={styles.viewTitle}>Continue the story</Text><Text style={styles.viewDescription}>{session ? 'Your chapter progress and Journey Points are synced across your signed-in devices.' : 'Sign in with Google whenever you want your progress and Journey Points synced across devices.'}</Text></View>
        {!session ? <OutlineButton title="Sign in to save progress" onPress={connectGoogle} /> : null}
        <EarnedReadingBadges completed={completedSet} />
        <View style={styles.statGrid}>{[
          [String(chronologicalReadings.filter(reading => reading.bibleTasks.every(task => completedSet.has(task.progressIndex))).length), 'Tasks complete'],
          [String(journeyRewards.completedChapters), 'Chapters complete'],
          [`${percent}%`, 'Journey complete'],
          [journeyRewards.journeyPoints.toLocaleString(), 'Journey Points'],
        ].map(([value, label]) => <View key={label} style={styles.statCard}><Text style={styles.progressNumber}>{value}</Text><Text style={styles.viewDescription}>{label}</Text></View>)}</View>
        <Card><Text style={styles.sectionTitle}>Progress by section</Text>{chronologicalBiblePlan.map(section => {
          const completed = section.readings.filter(reading => reading.bibleTasks.every(task => completedSet.has(task.progressIndex))).length;
          return <View key={section.id} style={styles.sectionProgress}><View style={styles.progressRow}><Text style={styles.progressRowTitle}>{section.title}</Text><Text style={styles.progressCount}>{completed} / {section.readings.length}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(completed / section.readings.length * 100)}%` }]} /></View></View>;
        })}</Card>
      </> : null}
    </View>
  );

  if (authLoading || !ready || loadedIdentity !== authIdentity) {
    return <View style={[styles.loadingPage, { paddingTop: insets.top }]}><ActivityIndicator color={colors.gold} size="large" /><Text style={styles.loadingText}>Preparing your Bible…</Text></View>;
  }

  return (
    <ReadingBadgeProvider completed={completedSet} ready={ready && loadedIdentity === authIdentity} accountIdentity={authIdentity}>
    <KeyboardAvoidingView style={[styles.page, { paddingTop: Math.max(insets.top, 12) }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {fixedHeader}
      {activeView !== 'leaderboard' ? <FlatList<ChronologicalListItem>
        key={activeView}
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
        data={listItems}
        keyExtractor={(item) => item.kind === 'section' ? `section-${item.section.id}` : `reading-${item.reading.id}`}
        ListHeaderComponent={listHeader}

        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        renderItem={({ item }) => {
          if (item.kind === 'section') {
            const section = item.section;
            const expanded = section.id === expandedSectionId;
            const completeCount = section.readings.filter((reading) => reading.bibleTasks.every((task) => completedSet.has(task.progressIndex))).length;
            return <Card style={[styles.sectionCard, expanded ? styles.sectionCardOpen : undefined]}><Pressable onPress={() => { setExpandedSectionId(expanded ? null : section.id); setExpandedReadingId(null); }} accessibilityRole="button" accessibilityState={{ expanded }}>
              <View style={styles.sectionTopline}><Text style={styles.sectionNumber}>SECTION {String(section.number).padStart(2, '0')}</Text><Text style={styles.sectionChevron}>{expanded ? '−' : '+'}</Text></View>
              <Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.sectionMeta}>{section.readings.length} readings · {completeCount} complete</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(completeCount / section.readings.length * 100)}%` }]} /></View><Text style={styles.sectionAction}>{expanded ? 'Hide readings' : 'Show readings'}</Text>
            </Pressable></Card>;
          }

          const { reading } = item;
          const isExpanded = expandedReadingId === reading.id;
          const readingCompleted = reading.bibleTasks.filter((task) => completedSet.has(task.progressIndex)).length;
          return <Card style={isExpanded ? styles.expandedCard : undefined}>
            <View style={styles.readingTitleRow}>
            <Pressable style={styles.readingTitleCopy} onPress={() => setExpandedReadingId(isExpanded ? null : reading.id)}>
              <View style={styles.readingTopline}><Text style={styles.readingNumber}>READING {reading.number}</Text><Text style={styles.readingCount}>{readingCompleted}/{reading.bibleTasks.length} chapters</Text></View>
              <Text style={styles.readingTitle}>{reading.title}</Text><Text style={styles.sectionLabel}>{reading.section}</Text><Text style={styles.expandLabel}>{isExpanded ? 'Hide reading ↑' : 'Open reading ↓'}</Text>
            </Pressable>
            {readingCompleted === reading.bibleTasks.length ? <ReadingBadgeButton reading={reading} /> : null}
            </View>
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
      /> : <JourneyLeaderboardModal
        key={sessionUserId ?? 'guest'}
        visible
        inline
        summary={journeyRewards}
        publicName={journeyProfile.alias}
        signedIn={Boolean(sessionUserId)}
        aliasSaving={journeyProfile.saving}
        signInBusy={syncBusy || authLoading}
        onRequestClose={() => setActiveView('journey')}
        onSignIn={connectGoogle}
        onSaveAlias={journeyProfile.saveAlias}
      />}
    </KeyboardAvoidingView>
    </ReadingBadgeProvider>
  );
}

export default function ChronologicalBibleScreen() {
  return <ChronologicalBibleContent />;
}

const styles = StyleSheet.create({
  viewTitle: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: '900', marginBottom: 10 },
  viewDescription: { color: colors.ivory, fontSize: 16, lineHeight: 24 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flexGrow: 1, flexBasis: '45%', padding: 18, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  sectionProgress: { marginTop: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressRowTitle: { flex: 1, color: colors.ivory, fontSize: 16, lineHeight: 23 },
  page: { flex: 1, backgroundColor: colors.charcoal }, list: { flex: 1 }, loadingPage: { flex: 1, backgroundColor: colors.charcoal, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: colors.muted, fontSize: 14 },
  content: { paddingHorizontal: 18, paddingTop: 12 }, fixedHeader: { backgroundColor: colors.charcoal, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, headerStack: { gap: 14, marginBottom: 16 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, backButton: { paddingVertical: 8, paddingRight: 14 }, backText: { color: colors.gold, fontSize: 16, fontWeight: '800' }, translation: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  menuButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 4 }, menuButtonOpen: { borderColor: colors.gold, backgroundColor: colors.panel2 }, menuBar: { width: 20, height: 2, borderRadius: 2, backgroundColor: colors.gold }, menuCard: { marginTop: 8, marginBottom: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel2 }, menuText: { color: colors.ivory, fontSize: 13, lineHeight: 20, marginBottom: 13 },
  fixedTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, fixedTitleCopy: { flex: 1 }, title: { color: colors.text, fontSize: 28, fontWeight: '900', lineHeight: 34 }, progressCard: { backgroundColor: colors.plum }, progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressNumber: { color: colors.text, fontSize: 24, fontWeight: '900' }, progressCount: { color: colors.gold, fontSize: 15, fontWeight: '900' }, progressTrack: { height: 9, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.13)', overflow: 'hidden', marginVertical: 14 }, progressFill: { height: '100%', borderRadius: 20, backgroundColor: colors.gold },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { flexGrow: 1, minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.gold, borderRadius: 12 },
  tabSelected: { backgroundColor: colors.gold },
  tabText: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  tabTextSelected: { color: colors.charcoal },
  separator: { height: 12 },
  sectionCard: { backgroundColor: colors.plum, borderColor: 'rgba(238,189,74,.38)' }, sectionCardOpen: { backgroundColor: colors.plum2, borderColor: colors.gold }, sectionTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionNumber: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, sectionChevron: { color: colors.gold, fontSize: 26, lineHeight: 27, fontWeight: '500' }, sectionTitle: { color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900', marginTop: 7 }, sectionMeta: { color: colors.ivory, fontSize: 12, lineHeight: 18, marginTop: 6 }, sectionAction: { color: colors.gold, fontSize: 12, fontWeight: '900', marginTop: 12 },
  readingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, readingTitleCopy: { flex: 1, minWidth: 0 },
  expandedCard: { borderColor: colors.gold, backgroundColor: colors.panel2 }, readingTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, readingNumber: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, readingCount: { color: colors.muted, fontSize: 11, fontWeight: '800' }, readingTitle: { color: colors.text, fontSize: 19, fontWeight: '900', lineHeight: 25, marginTop: 8 }, sectionLabel: { color: colors.muted, fontSize: 12, marginTop: 5 }, expandLabel: { color: colors.gold, fontSize: 12, fontWeight: '900', marginTop: 12 }, expandedContent: { marginTop: 18, gap: 10 }, chapterBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }, chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 11 }, checkbox: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' }, checkboxComplete: { backgroundColor: colors.green, borderColor: colors.green }, checkmark: { color: colors.charcoal, fontWeight: '900', fontSize: 18 }, chapterActions: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'stretch', borderRadius: 10, backgroundColor: 'rgba(255,255,255,.025)' }, chapterButton: { flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: 8 }, chapterLabel: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' }, chapterComplete: { color: colors.muted, textDecorationLine: 'line-through' }, chapterDivider: { width: 1, marginVertical: 8, backgroundColor: colors.border }, gatewayButton: { flex: 1.25, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 7 }, gatewayLabel: { color: colors.gold, fontSize: 11, lineHeight: 15, fontWeight: '900', textAlign: 'center' },
});
