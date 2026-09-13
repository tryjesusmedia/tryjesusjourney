import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { getJourneyLeaderboard } from '@/lib/journeyRewards';
import type { JourneyLeaderboardEntry } from '@/lib/journeyRewardsCore';

type JourneyLeaderboardModalProps = {
  visible: boolean;
  signedIn: boolean;
  alias: string | null;
  aliasLoading: boolean;
  aliasError: boolean;
  aliasSaving: boolean;
  signInBusy: boolean;
  onRequestClose: () => void;
  onSignIn: () => Promise<void>;
  onRetryAlias: () => Promise<string | null>;
  onSaveAlias: (alias: string) => Promise<string | null>;
};

export function JourneyLeaderboardModal({
  visible,
  signedIn,
  alias,
  aliasLoading,
  aliasError,
  aliasSaving,
  signInBusy,
  onRequestClose,
  onSignIn,
  onRetryAlias,
  onSaveAlias,
}: JourneyLeaderboardModalProps) {
  const insets = useSafeAreaInsets();
  const loadGenerationRef = useRef(0);
  const [entries, setEntries] = useState<JourneyLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [aliasEditorOpen, setAliasEditorOpen] = useState(false);
  const [aliasDraft, setAliasDraft] = useState('');
  const lastAliasTapRef = useRef(0);
  const aliasLongPressFiredRef = useRef(false);

  const loadLeaderboard = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    if (!visible || !signedIn) {
      setEntries([]);
      setLoading(false);
      setHasLoaded(false);
      setLoadError(false);
      return;
    }

    setLoading(true);
    setLoadError(false);
    try {
      const rows = await getJourneyLeaderboard();
      if (generation !== loadGenerationRef.current) return;
      setEntries(rows);
      setHasLoaded(true);
    } catch {
      if (generation === loadGenerationRef.current) {
        setHasLoaded(true);
        setLoadError(true);
      }
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, [signedIn, visible]);

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    if (!visible || !signedIn) return;
    void getJourneyLeaderboard().then((rows) => {
      if (generation !== loadGenerationRef.current) return;
      setEntries(rows);
      setHasLoaded(true);
      setLoadError(false);
    }).catch(() => {
      if (generation !== loadGenerationRef.current) return;
      setHasLoaded(true);
      setLoadError(true);
    });
    return () => {
      if (generation === loadGenerationRef.current) loadGenerationRef.current += 1;
    };
  }, [signedIn, visible]);

  function openAliasEditor() {
    if (!signedIn || !alias || aliasSaving) return;
    setAliasDraft(alias);
    setAliasEditorOpen(true);
  }

  function handleAliasPress() {
    if (aliasLongPressFiredRef.current) {
      aliasLongPressFiredRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastAliasTapRef.current <= 450) {
      lastAliasTapRef.current = 0;
      openAliasEditor();
    } else {
      lastAliasTapRef.current = now;
    }
  }

  async function saveAlias() {
    const clean = aliasDraft.trim().replace(/\s+/g, ' ');
    if (clean.length < 3 || clean.length > 40 || /[<>\u0000-\u001F\u007F]/.test(clean)) {
      Alert.alert('Check the name', 'Enter a leaderboard name between 3 and 40 characters.');
      return;
    }
    try {
      const changed = await onSaveAlias(clean);
      if (!changed) throw new Error('Your leaderboard name could not be saved right now.');
      setAliasEditorOpen(false);
      await loadLeaderboard();
    } catch (caught) {
      Alert.alert('Name not saved', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  const header = (
    <View style={styles.headerContent}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Eyebrow>CHRON BIBLE COMMUNITY</Eyebrow>
          <Text style={styles.title}>Journey Leaderboard</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close leaderboard" onPress={onRequestClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
      </View>
      <Text style={styles.supportiveCopy}>Journey Points celebrate reading progress—not spiritual worth. Every chapter read is worth celebrating.</Text>

      {!signedIn ? (
        <View style={styles.joinCard}>
          <Text style={styles.joinTitle}>Join with a public leaderboard name</Text>
          <Text style={styles.joinBody}>Sign in with Google to view the leaderboard. You can customize your public name; your email, photo, and account ID are never shown here.</Text>
          <GoldButton title="Sign In with Google to Join" loading={signInBusy} onPress={() => { void onSignIn(); }} />
        </View>
      ) : (
        <View style={styles.aliasCard}>
          <View style={styles.aliasCopy}>
            <Text style={styles.aliasLabel}>YOUR PUBLIC ALIAS</Text>
            {aliasLoading ? <ActivityIndicator color={colors.gold} size="small" /> : alias ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${alias}. Double-tap or press and hold to change your leaderboard name.`}
                delayLongPress={1400}
                disabled={aliasSaving}
                onLongPress={() => { aliasLongPressFiredRef.current = true; openAliasEditor(); }}
                onPress={handleAliasPress}
              >
                <Text style={styles.alias}>{alias}</Text>
                <Text style={styles.aliasHint}>Double-tap or press and hold to change.</Text>
              </Pressable>
            ) : <Text style={styles.alias}>Unavailable right now</Text>}
          </View>
          {!alias && aliasError && !aliasLoading ? (
            <Pressable accessibilityRole="button" onPress={() => { void onRetryAlias(); }} style={styles.aliasButton}>
              <Text style={styles.aliasButtonText}>Retry Alias</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {signedIn ? <Text style={styles.listHeading}>ALL READERS</Text> : null}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onRequestClose}>
      <View style={[styles.page, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
        <FlatList
          data={signedIn ? entries : []}
          keyExtractor={(item, index) => `${item.rank}-${item.alias}-${index}`}
          ListHeaderComponent={header}
          ListEmptyComponent={signedIn ? (
            loading || !hasLoaded ? (
              <View style={styles.stateCard}><ActivityIndicator color={colors.gold} size="large" /><Text style={styles.stateText}>Loading the leaderboard…</Text></View>
            ) : loadError ? (
              <View style={styles.stateCard}><Text style={styles.stateTitle}>Leaderboard unavailable</Text><Text style={styles.stateText}>Your reading progress is safe. You can try again without leaving Chron Bible.</Text><OutlineButton title="Try Again" onPress={() => { void loadLeaderboard(); }} /></View>
            ) : (
              <View style={styles.stateCard}><Text style={styles.stateTitle}>The journey is beginning</Text><Text style={styles.stateText}>No leaderboard entries are available yet.</Text></View>
            )
          ) : null}
          renderItem={({ item }) => (
            <View
              accessible
              accessibilityLabel={`${item.isCurrentUser ? 'Your entry. ' : ''}Rank ${item.rank}, ${item.alias}, ${item.journeyPoints} Journey Points, ${item.completedChapters} completed chapters`}
              style={[styles.entry, item.isCurrentUser && styles.currentEntry]}
            >
              <View style={[styles.rankBadge, item.isCurrentUser && styles.currentRankBadge]}><Text style={[styles.rank, item.isCurrentUser && styles.currentRank]}>#{item.rank}</Text></View>
              <View style={styles.entryCopy}>
                <View style={styles.entryTitleRow}>
                  {item.isCurrentUser ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.alias}. Double-tap or press and hold to change your leaderboard name.`}
                      delayLongPress={1400}
                      onLongPress={() => { aliasLongPressFiredRef.current = true; openAliasEditor(); }}
                      onPress={handleAliasPress}
                    >
                      <Text numberOfLines={2} style={styles.entryAlias}>{item.alias}</Text>
                    </Pressable>
                  ) : <Text numberOfLines={2} style={styles.entryAlias}>{item.alias}</Text>}
                  {item.isCurrentUser ? <Text style={styles.youBadge}>YOU</Text> : null}
                </View>
                <Text style={styles.entryMeta}>{item.completedChapters} chapter{item.completedChapters === 1 ? '' : 's'} completed</Text>
              </View>
              <View style={styles.entryPoints}>
                <Text style={styles.entryPointsNumber}>{item.journeyPoints.toLocaleString()}</Text>
                <Text style={styles.entryPointsLabel}>points</Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.content}
          refreshControl={signedIn ? <RefreshControl refreshing={loading} onRefresh={() => { void loadLeaderboard(); }} tintColor={colors.gold} colors={[colors.gold]} /> : undefined}
          ListFooterComponent={<Pressable accessibilityRole="button" onPress={onRequestClose} style={styles.doneButton}><Text style={styles.doneButtonText}>Close Leaderboard</Text></Pressable>}
        />
        <Modal visible={visible && aliasEditorOpen} transparent animationType="fade" onRequestClose={() => setAliasEditorOpen(false)}>
          <View style={styles.editorScrim}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close name editor" onPress={() => setAliasEditorOpen(false)} style={styles.editorBackdrop} />
            <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editorCenter}>
              <View style={styles.editorCard}>
                <Text style={styles.editorTitle}>Your leaderboard name</Text>
                <Text style={styles.editorBody}>This name is public and appears on both Journey leaderboards. Your account details remain private.</Text>
                <TextInput
                  accessibilityLabel="Leaderboard name"
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={40}
                  onChangeText={setAliasDraft}
                  selectTextOnFocus
                  style={styles.editorInput}
                  value={aliasDraft}
                />
                <View style={styles.editorActions}>
                  <Pressable disabled={aliasSaving} onPress={() => setAliasEditorOpen(false)} style={styles.editorButton}><Text style={styles.editorCancel}>Cancel</Text></Pressable>
                  <Pressable disabled={aliasSaving} onPress={() => { void saveAlias(); }} style={[styles.editorButton, styles.editorSave, aliasSaving && styles.disabled]}><Text style={styles.editorSaveText}>{aliasSaving ? 'Saving…' : 'Save'}</Text></Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  headerContent: { paddingBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  titleCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  closeButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: colors.gold, fontSize: 28, lineHeight: 31, fontWeight: '600' },
  supportiveCopy: { color: colors.ivory, fontSize: 14, lineHeight: 21, marginTop: 10 },
  joinCard: { marginTop: 18, padding: 18, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.plum },
  joinTitle: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '900' },
  joinBody: { color: colors.ivory, fontSize: 13, lineHeight: 20, marginBottom: 3 },
  aliasCard: { minHeight: 76, marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aliasCopy: { flex: 1, gap: 5 },
  aliasLabel: { color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: '900', letterSpacing: 1.3 },
  alias: { color: colors.gold, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  aliasHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  aliasButton: { minHeight: 42, minWidth: 104, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  aliasButtonText: { color: colors.gold, fontSize: 12, fontWeight: '900' },
  listHeading: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '900', letterSpacing: 1.5, marginTop: 24 },
  stateCard: { minHeight: 170, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  stateText: { color: colors.ivory, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  entry: { minHeight: 78, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  currentEntry: { borderColor: colors.gold, backgroundColor: colors.plum },
  rankBadge: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel2 },
  currentRankBadge: { backgroundColor: colors.gold },
  rank: { color: colors.ivory, fontSize: 14, fontWeight: '900' },
  currentRank: { color: colors.charcoal },
  entryCopy: { flex: 1, minWidth: 0 },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  entryAlias: { flexShrink: 1, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  youBadge: { color: colors.charcoal, backgroundColor: colors.gold, borderRadius: 8, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  entryMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  entryPoints: { alignItems: 'flex-end' },
  entryPointsNumber: { color: colors.gold, fontSize: 16, lineHeight: 20, fontWeight: '900' },
  entryPointsLabel: { color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase' },
  separator: { height: 9 },
  doneButton: { minHeight: 48, marginTop: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold },
  doneButtonText: { color: colors.charcoal, fontSize: 14, fontWeight: '900' },
  editorScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)' },
  editorBackdrop: { ...StyleSheet.absoluteFill },
  editorCenter: { flex: 1, justifyContent: 'center', padding: 20 },
  editorCard: { borderRadius: 20, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, padding: 21, gap: 13 },
  editorTitle: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900' },
  editorBody: { color: colors.ivory, fontSize: 14, lineHeight: 21 },
  editorInput: { minHeight: 56, borderRadius: 13, borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.text, color: colors.charcoal, paddingHorizontal: 14, fontSize: 19 },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 11 },
  editorButton: { minHeight: 48, minWidth: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingHorizontal: 14 },
  editorSave: { backgroundColor: colors.gold },
  editorCancel: { color: colors.text, fontSize: 15, fontWeight: '900' },
  editorSaveText: { color: colors.charcoal, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: .78 },
  disabled: { opacity: .5 },
});
