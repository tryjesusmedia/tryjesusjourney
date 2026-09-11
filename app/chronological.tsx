import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import {
  chronologicalBiblePlan,
  chronologicalPlanMeta,
  chronologicalReadings,
  type ChronologicalReading,
  type ChronologicalSection,
} from '@/data/chronologicalBiblePlan';
import { getKjvChapter } from '@/data/kjv';
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
import {
  createChronologicalNote,
  deleteChronologicalNote,
  loadChronologicalNotes,
  loadLocalChronologicalNotes,
  type ChronologicalNote,
} from '@/lib/chronologicalNotes';

type ViewMode = 'readings' | 'notes';

type ChronologicalListItem =
  | { kind: 'section'; section: ChronologicalSection }
  | { kind: 'reading'; reading: ChronologicalReading; searchResult?: boolean }
  | { kind: 'note'; note: ChronologicalNote; searchResult?: boolean }
  | { kind: 'result-heading'; id: 'bible-results' | 'note-results'; title: string; count: number };

const emptyProgress: ChronologicalProgress = { completed: [], lastIndex: 0, updatedAt: '' };

export default function ChronologicalBibleScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChronologicalListItem>>(null);
  const loadGenerationRef = useRef(0);
  const { session, loading: authLoading, signInGoogle, signOut } = useAuth();
  const sessionUserId = session?.user.id;
  const authIdentity = chronologicalLoadIdentity(sessionUserId);
  const [progress, setProgress] = useState<ChronologicalProgress>(emptyProgress);
  const [notes, setNotes] = useState<ChronologicalNote[]>([]);
  const [ready, setReady] = useState(false);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [taskBusy, setTaskBusy] = useState<number | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [view, setView] = useState<ViewMode>('readings');
  const [query, setQuery] = useState('');
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(chronologicalBiblePlan[0]?.id ?? null);
  const [expandedReadingId, setExpandedReadingId] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');

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
    const isCurrent = () => isChronologicalLoadCurrent(
      token,
      loadGenerationRef.current,
      sessionUserId,
      authLoading,
    );

    void (async () => {
      try {
        const [savedProgress, savedNotes] = await Promise.all([
          loadChronologicalProgress(sessionUserId),
          loadChronologicalNotes(sessionUserId),
        ]);
        if (!isCurrent()) return;
        setProgress(savedProgress);
        setNotes(savedNotes);
        setLoadedIdentity(token.identity);
      } catch (caught) {
        if (!isCurrent()) return;
        Alert.alert(
          'Could not finish syncing',
          caught instanceof Error ? caught.message : 'Your on-phone copy is still available. Please try again.',
        );
        const [localProgress, localNotes] = await Promise.all([
          loadLocalChronologicalProgress(sessionUserId),
          loadLocalChronologicalNotes(sessionUserId),
        ]);
        if (!isCurrent()) return;
        setProgress(localProgress);
        setNotes(localNotes);
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
  const percent = Math.round((progress.completed.length / chronologicalPlanMeta.chapterCount) * 100);
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return { readings: [], notes: [] };
    const readings = chronologicalReadings.filter((reading) =>
      `${reading.number} ${reading.section} ${reading.title} ${reading.reference} ${reading.bibleTasks.map((task) => task.label).join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
    const matchingNotes = notes.filter((note) => {
      const reading = chronologicalReadings.find((candidate) => candidate.id === note.readingId);
      return `${note.body} ${reading?.number ?? ''} ${reading?.section ?? ''} ${reading?.title ?? ''} ${reading?.reference ?? ''} ${reading?.bibleTasks.map((task) => task.label).join(' ') ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
    return { readings, notes: matchingNotes };
  }, [normalizedQuery, notes]);

  const listItems = useMemo<ChronologicalListItem[]>(() => {
    if (normalizedQuery) {
      const items: ChronologicalListItem[] = [];
      if (searchResults.readings.length) {
        items.push({ kind: 'result-heading', id: 'bible-results', title: 'Bible readings', count: searchResults.readings.length });
        items.push(...searchResults.readings.map((reading) => ({ kind: 'reading' as const, reading, searchResult: true })));
      }
      if (searchResults.notes.length) {
        items.push({ kind: 'result-heading', id: 'note-results', title: 'Your notes', count: searchResults.notes.length });
        items.push(...searchResults.notes.map((note) => ({ kind: 'note' as const, note, searchResult: true })));
      }
      return items;
    }

    if (view === 'notes') return notes.map((note) => ({ kind: 'note' as const, note }));

    return chronologicalBiblePlan.flatMap<ChronologicalListItem>((section) => [
      { kind: 'section', section },
      ...(expandedSectionId === section.id
        ? section.readings.map((reading) => ({ kind: 'reading' as const, reading }))
        : []),
    ]);
  }, [expandedSectionId, normalizedQuery, notes, searchResults, view]);

  async function connectGoogle() {
    if (syncBusy) return;
    setSyncBusy(true);
    try {
      const completed = await signInGoogle();
      if (!completed) return;
      Alert.alert('Google connected', 'Your Chron Bible progress and notes will now stay in sync with the website.');
    } catch (caught) {
      Alert.alert('Google sign-in did not finish', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setSyncBusy(false);
    }
  }

  async function disconnectGoogle() {
    if (!sessionUserId || syncBusy) return;
    setSyncBusy(true);
    try {
      await prepareChronologicalDetach(sessionUserId);
      await signOut();
      Alert.alert(
        'Google disconnected',
        'Your Chron Bible progress and notes are available on this phone. Changes made while disconnected will sync when you reconnect this same Google account.',
      );
    } catch (caught) {
      Alert.alert(
        'Could not disconnect safely',
        caught instanceof Error ? caught.message : 'Your on-phone Chron Bible copy could not be prepared. Please try again.',
      );
    } finally {
      setSyncBusy(false);
    }
  }

  async function toggleTask(progressIndex: number, readingIndex: number) {
    if (taskBusy !== null) return;
    const wasCompleted = completedSet.has(progressIndex);
    const completed = wasCompleted
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
      setProgress(await saveChronologicalProgress(optimistic, session?.user.id));
    } catch {
      setProgress(optimistic);
      Alert.alert('Saved on this phone', 'The sync service could not be reached. This change will sync the next time you open Chron Bible while online.');
    } finally {
      setTaskBusy(null);
    }
  }

  async function addNote(reading: ChronologicalReading) {
    const body = noteBody.trim();
    if (!body || noteBusy) return;
    setNoteBusy(true);
    try {
      const created = await createChronologicalNote(reading.id, body, session?.user.id);
      setNotes((current) => [created, ...current]);
      setNoteBody('');
    } catch (caught) {
      Alert.alert('Could not save this note', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setNoteBusy(false);
    }
  }

  function confirmDelete(note: ChronologicalNote) {
    Alert.alert('Delete this note?', 'This cannot be undone.', [
      { text: 'Keep note', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChronologicalNote(note, session?.user.id);
            setNotes((current) => current.filter((item) => item.id !== note.id));
          } catch (caught) {
            Alert.alert('Could not delete this note', caught instanceof Error ? caught.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  function continueReading() {
    const start = Math.max(0, Math.min(progress.lastIndex, chronologicalReadings.length - 1));
    const next = chronologicalReadings.slice(start).find((reading) =>
      reading.bibleTasks.some((task) => !completedSet.has(task.progressIndex)),
    ) ?? chronologicalReadings.find((reading) =>
      reading.bibleTasks.some((task) => !completedSet.has(task.progressIndex)),
    ) ?? chronologicalReadings[0];
    const section = chronologicalBiblePlan.find((candidate) => candidate.title === next.section);
    setView('readings');
    setQuery(next.title);
    setExpandedSectionId(section?.id ?? null);
    setExpandedReadingId(next.id);
    setExpandedChapter(null);
  }

  function openNoteReading(note: ChronologicalNote) {
    const reading = chronologicalReadings.find((item) => item.id === note.readingId);
    if (!reading) return;
    const section = chronologicalBiblePlan.find((candidate) => candidate.title === reading.section);
    setView('readings');
    setQuery(reading.title);
    setExpandedSectionId(section?.id ?? null);
    setExpandedReadingId(reading.id);
    setExpandedChapter(null);
  }

  const fixedHeader = (
    <View style={styles.fixedHeader}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.translation}>KJV · NATIVE</Text>
      </View>
      <View style={styles.fixedTitleRow}>
        <View style={styles.fixedTitleCopy}>
          <Eyebrow>READ IN HISTORICAL SEQUENCE</Eyebrow>
          <Text style={styles.title}>Chronological Bible</Text>
        </View>
      </View>
      <View style={styles.searchShell}>
        <Text style={styles.searchLabel}>SEARCH BIBLE + MY NOTES</Text>
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon} accessibilityElementsHidden>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search readings and your notes"
            placeholderTextColor="#665A63"
            style={styles.search}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search Bible readings and my notes"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} style={styles.clearSearch} accessibilityRole="button" accessibilityLabel="Clear search">
              <Text style={styles.clearSearchText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  const listHeader = (
    <View style={styles.headerStack}>
      {normalizedQuery ? (
        <View style={styles.resultSummary}>
          <Text style={styles.resultSummaryTitle}>
            {searchResults.readings.length + searchResults.notes.length} search result{searchResults.readings.length + searchResults.notes.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.resultSummaryBody}>
            {searchResults.readings.length} Bible reading{searchResults.readings.length === 1 ? '' : 's'} · {searchResults.notes.length} personal note{searchResults.notes.length === 1 ? '' : 's'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>Read all {chronologicalPlanMeta.readingCount} assignments and every KJV chapter inside the app—even without signing in.</Text>

          <Card style={styles.progressCard}>
            <View style={styles.progressHeading}>
              <View>
                <Eyebrow>YOUR OPTIONAL PROGRESS</Eyebrow>
                <Text style={styles.progressNumber}>{percent}% complete</Text>
              </View>
              <Text style={styles.progressCount}>{progress.completed.length}/{chronologicalPlanMeta.chapterCount}</Text>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
            <Text style={styles.helper}>Read freely, or mark chapters and write notes when you want to remember your place.</Text>
            <GoldButton title="Continue Reading" onPress={continueReading} />
          </Card>

          <Card style={session ? styles.syncedCard : styles.localCard}>
            <Eyebrow>{session ? 'SYNC IS ON' : 'SAVED ON THIS PHONE'}</Eyebrow>
            <Text style={styles.cardTitle}>{session ? 'Chron Bible is synced.' : 'Google sign-in is optional.'}</Text>
            <Text style={styles.body}>
              {session
                ? `Progress and notes are syncing with tryjesusmedia.com as ${session.user.email ?? 'your Google account'}.`
                : 'Everything works locally now. Connect Google only if you want Chron Bible progress and notes on the website and your other devices.'}
            </Text>
            {session
              ? <OutlineButton title={syncBusy ? 'Preparing on-phone copy…' : 'Disconnect Google from Chron Bible'} disabled={syncBusy} onPress={disconnectGoogle} />
              : <GoldButton title="Connect Google for Chron Bible Sync" loading={syncBusy || authLoading} onPress={connectGoogle} />}
          </Card>

          <View style={styles.tabs}>
            <Pressable onPress={() => setView('readings')} style={[styles.tab, view === 'readings' && styles.activeTab]}>
              <Text style={[styles.tabText, view === 'readings' && styles.activeTabText]}>Readings</Text>
            </Pressable>
            <Pressable onPress={() => setView('notes')} style={[styles.tab, view === 'notes' && styles.activeTab]}>
              <Text style={[styles.tabText, view === 'notes' && styles.activeTabText]}>My Notes ({notes.length})</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  if (authLoading || !ready || loadedIdentity !== authIdentity) {
    return <View style={[styles.loadingPage, { paddingTop: insets.top }]}><ActivityIndicator color={colors.gold} size="large" /><Text style={styles.loadingText}>Preparing your Bible…</Text></View>;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: Math.max(insets.top, 12) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {fixedHeader}
      <FlatList<ChronologicalListItem>
        ref={listRef}
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
        data={listItems}
        key={normalizedQuery ? 'search' : view}
        keyExtractor={(item) => {
          if (item.kind === 'section') return `section-${item.section.id}`;
          if (item.kind === 'reading') return `reading-${item.reading.id}`;
          if (item.kind === 'note') return `note-${item.note.id}`;
          return item.id;
        }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={(
          <Card>
            <Text style={styles.emptyTitle}>{normalizedQuery ? 'No matching readings or notes' : 'No notes yet'}</Text>
            <Text style={styles.body}>{normalizedQuery ? 'Try a different word, book, chapter, section, or phrase from one of your notes.' : 'Open any reading to save a private note.'}</Text>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        renderItem={({ item }) => {
          if (item.kind === 'result-heading') {
            return (
              <View style={styles.resultHeading}>
                <Text style={styles.resultHeadingText}>{item.title}</Text>
                <Text style={styles.resultHeadingCount}>{item.count}</Text>
              </View>
            );
          }

          if (item.kind === 'section') {
            const section = item.section;
            const expanded = section.id === expandedSectionId;
            const completeCount = section.readings.filter((reading) =>
              reading.bibleTasks.every((task) => completedSet.has(task.progressIndex)),
            ).length;
            return (
              <Card style={[styles.sectionCard, expanded ? styles.sectionCardOpen : undefined]}>
                <Pressable
                  onPress={() => {
                    setExpandedSectionId(expanded ? null : section.id);
                    setExpandedReadingId(null);
                    setExpandedChapter(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <View style={styles.sectionTopline}>
                    <Text style={styles.sectionNumber}>SECTION {String(section.number).padStart(2, '0')}</Text>
                    <Text style={styles.sectionChevron}>{expanded ? '−' : '+'}</Text>
                  </View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionMeta}>{section.readings.length} readings · {completeCount} complete</Text>
                  <Text style={styles.sectionAction}>{expanded ? 'Hide readings' : 'Show readings'}</Text>
                </Pressable>
              </Card>
            );
          }

          if (item.kind === 'note') {
            const { note } = item;
            const reading = chronologicalReadings.find((candidate) => candidate.id === note.readingId);
            return (
              <Card style={item.searchResult ? styles.noteResultCard : undefined}>
                {item.searchResult ? <Text style={styles.noteResultBadge}>YOUR NOTE</Text> : null}
                <View style={styles.noteMetaRow}>
                  <Text style={styles.noteReading}>{reading ? `Reading ${reading.number} · ${reading.reference}` : 'Chron Bible note'}</Text>
                  <Text style={styles.noteSync}>{note.synced ? 'Synced' : 'On phone'}</Text>
                </View>
                <Text style={styles.noteBody}>{note.body}</Text>
                <View style={styles.noteActions}>
                  <Pressable onPress={() => openNoteReading(note)}><Text style={styles.textAction}>Open reading</Text></Pressable>
                  <Pressable onPress={() => confirmDelete(note)}><Text style={styles.deleteAction}>Delete</Text></Pressable>
                </View>
              </Card>
            );
          }

          const { reading } = item;
          const isExpanded = expandedReadingId === reading.id;
          const readingCompleted = reading.bibleTasks.filter((task) => completedSet.has(task.progressIndex)).length;
          return (
            <Card style={[item.searchResult ? styles.readingResultCard : undefined, isExpanded ? styles.expandedCard : undefined]}>
              {item.searchResult ? <Text style={styles.readingResultBadge}>BIBLE READING</Text> : null}
            <Pressable onPress={() => {
              setExpandedReadingId(isExpanded ? null : reading.id);
              setExpandedChapter(null);
              setNoteBody('');
            }}>
              <View style={styles.readingTopline}>
                <Text style={styles.readingNumber}>READING {reading.number}</Text>
                <Text style={styles.readingCount}>{readingCompleted}/{reading.bibleTasks.length} chapters</Text>
              </View>
              <Text style={styles.readingTitle}>{reading.title}</Text>
              <Text style={styles.sectionLabel}>{reading.section}</Text>
              <Text style={styles.expandLabel}>{isExpanded ? 'Hide reading ↑' : 'Open reading ↓'}</Text>
            </Pressable>

            {isExpanded ? (
              <View style={styles.expandedContent}>
                {reading.bibleTasks.map((task) => {
                  const isComplete = completedSet.has(task.progressIndex);
                  const isChapterOpen = expandedChapter === task.label;
                  const verses = isChapterOpen ? getKjvChapter(task.label) : [];
                  return (
                    <View key={task.progressIndex} style={styles.chapterBlock}>
                      <View style={styles.chapterRow}>
                        <Pressable
                          onPress={() => toggleTask(task.progressIndex, reading.index)}
                          disabled={taskBusy !== null}
                          style={[styles.checkbox, isComplete && styles.checkboxComplete]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isComplete }}
                        >
                          <Text style={styles.checkmark}>{taskBusy === task.progressIndex ? '…' : isComplete ? '✓' : ''}</Text>
                        </Pressable>
                        <Pressable onPress={() => setExpandedChapter(isChapterOpen ? null : task.label)} style={styles.chapterButton}>
                          <Text style={[styles.chapterLabel, isComplete && styles.chapterComplete]}>{task.label}</Text>
                          <Text style={styles.readLabel}>{isChapterOpen ? 'Close' : 'Read KJV'}</Text>
                        </Pressable>
                      </View>
                      {isChapterOpen ? (
                        <View style={styles.scripture}>
                          <Text style={styles.scriptureTitle}>{task.label} · King James Version</Text>
                          {verses.length ? verses.map((verse) => (
                            <Text key={verse.verse} style={styles.verse}><Text style={styles.verseNumber}>{verse.verse} </Text>{verse.text}</Text>
                          )) : <Text style={styles.body}>This chapter could not be loaded.</Text>}
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                <View style={styles.noteComposer}>
                  <Text style={styles.noteComposerTitle}>Add a private note</Text>
                  <Text style={styles.helper}>{session ? 'This note will sync with the Chron Bible website.' : 'This note will stay on this phone unless you connect Google above.'}</Text>
                  <TextInput
                    value={noteBody}
                    onChangeText={setNoteBody}
                    placeholder="What stood out to you?"
                    placeholderTextColor={colors.muted}
                    maxLength={2000}
                    multiline
                    style={styles.noteInput}
                  />
                  <GoldButton title="Save Note" disabled={!noteBody.trim()} loading={noteBusy} onPress={() => addNote(reading)} />
                </View>
              </View>
            ) : null}
            </Card>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  list: { flex: 1 },
  loadingPage: { flex: 1, backgroundColor: colors.charcoal, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14 },
  content: { paddingHorizontal: 18, paddingTop: 12 },
  fixedHeader: { backgroundColor: colors.charcoal, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerStack: { gap: 14, marginBottom: 16 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { paddingVertical: 8, paddingRight: 14 },
  backText: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  translation: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  fixedTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fixedTitleCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', lineHeight: 34 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  progressCard: { backgroundColor: colors.plum },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressNumber: { color: colors.text, fontSize: 24, fontWeight: '900' },
  progressCount: { color: colors.gold, fontSize: 15, fontWeight: '900' },
  progressTrack: { height: 9, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.13)', overflow: 'hidden', marginVertical: 14 },
  progressFill: { height: '100%', borderRadius: 20, backgroundColor: colors.gold },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 13 },
  localCard: { backgroundColor: colors.panel2 },
  syncedCard: { backgroundColor: '#193126', borderColor: 'rgba(79,193,139,.45)' },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 7 },
  body: { color: colors.ivory, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  tabs: { flexDirection: 'row', backgroundColor: colors.panel, padding: 4, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: colors.gold },
  tabText: { color: colors.muted, fontWeight: '900', fontSize: 13 },
  activeTabText: { color: colors.charcoal },
  searchShell: { backgroundColor: colors.gold, borderRadius: 18, padding: 3, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  searchLabel: { color: colors.charcoal, fontSize: 10, lineHeight: 16, fontWeight: '900', letterSpacing: 1.5, paddingHorizontal: 11, paddingTop: 3, paddingBottom: 1 },
  searchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 15, backgroundColor: '#FFF7E6', paddingHorizontal: 12 },
  searchIcon: { color: '#3A2C34', fontSize: 25, fontWeight: '900', marginRight: 7, marginTop: -2 },
  search: { flex: 1, minHeight: 50, paddingVertical: 10, color: '#241C22', fontSize: 16, fontWeight: '700' },
  clearSearch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D9BF' },
  clearSearchText: { color: '#3A2C34', fontSize: 24, lineHeight: 27, fontWeight: '800' },
  resultSummary: { backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.gold, borderRadius: 18, padding: 15 },
  resultSummaryTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  resultSummaryBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  resultHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingHorizontal: 3 },
  resultHeadingText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  resultHeadingCount: { minWidth: 28, height: 28, borderRadius: 14, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.gold, color: colors.charcoal, fontSize: 12, fontWeight: '900' },
  separator: { height: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 5 },
  sectionCard: { backgroundColor: colors.plum, borderColor: 'rgba(238,189,74,.38)' },
  sectionCardOpen: { backgroundColor: colors.plum2, borderColor: colors.gold },
  sectionTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionNumber: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  sectionChevron: { color: colors.gold, fontSize: 26, lineHeight: 27, fontWeight: '500' },
  sectionTitle: { color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900', marginTop: 7 },
  sectionMeta: { color: colors.ivory, fontSize: 12, lineHeight: 18, marginTop: 6 },
  sectionAction: { color: colors.gold, fontSize: 12, fontWeight: '900', marginTop: 12 },
  readingResultCard: { borderColor: colors.gold },
  readingResultBadge: { alignSelf: 'flex-start', color: colors.charcoal, backgroundColor: colors.gold, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 11 },
  noteResultCard: { borderColor: colors.green, backgroundColor: '#193126' },
  noteResultBadge: { alignSelf: 'flex-start', color: '#10231B', backgroundColor: colors.green, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 11 },
  expandedCard: { borderColor: colors.gold, backgroundColor: colors.panel2 },
  readingTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  readingNumber: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  readingCount: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  readingTitle: { color: colors.text, fontSize: 19, fontWeight: '900', lineHeight: 25, marginTop: 8 },
  sectionLabel: { color: colors.muted, fontSize: 12, marginTop: 5 },
  expandLabel: { color: colors.gold, fontSize: 12, fontWeight: '900', marginTop: 12 },
  expandedContent: { marginTop: 18, gap: 10 },
  chapterBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkbox: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  checkboxComplete: { backgroundColor: colors.green, borderColor: colors.green },
  checkmark: { color: colors.charcoal, fontWeight: '900', fontSize: 18 },
  chapterButton: { flex: 1, minHeight: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chapterLabel: { color: colors.text, fontSize: 16, fontWeight: '900' },
  chapterComplete: { color: colors.muted, textDecorationLine: 'line-through' },
  readLabel: { color: colors.gold, fontSize: 12, fontWeight: '900' },
  scripture: { marginTop: 10, backgroundColor: '#F7F0E2', borderRadius: 16, padding: 17 },
  scriptureTitle: { color: '#3A2831', fontSize: 18, fontWeight: '900', marginBottom: 14 },
  verse: { color: '#292126', fontFamily: 'serif', fontSize: 17, lineHeight: 28, marginBottom: 8 },
  verseNumber: { color: '#8A5B16', fontSize: 11, fontWeight: '900' },
  noteComposer: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  noteComposerTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  noteInput: { minHeight: 100, maxHeight: 220, textAlignVertical: 'top', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14, color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  noteMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  noteReading: { flex: 1, color: colors.gold, fontSize: 11, fontWeight: '900' },
  noteSync: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  noteBody: { color: colors.text, fontSize: 16, lineHeight: 24, marginTop: 12 },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  textAction: { color: colors.gold, fontSize: 12, fontWeight: '900' },
  deleteAction: { color: colors.red, fontSize: 12, fontWeight: '900' },
});
