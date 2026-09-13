import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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
  aliasRerolling: boolean;
  signInBusy: boolean;
  onRequestClose: () => void;
  onSignIn: () => Promise<void>;
  onChangeAlias: () => Promise<string | null>;
};

export function JourneyLeaderboardModal({
  visible,
  signedIn,
  aliasRerolling,
  signInBusy,
  onRequestClose,
  onSignIn,
  onChangeAlias,
}: JourneyLeaderboardModalProps) {
  const insets = useSafeAreaInsets();
  const loadGenerationRef = useRef(0);
  const [entries, setEntries] = useState<JourneyLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

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

  async function changeAlias() {
    try {
      const changed = await onChangeAlias();
      if (!changed) throw new Error('A new Journey alias could not be selected right now.');
      await loadLeaderboard();
    } catch (caught) {
      Alert.alert('Alias not changed', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  function confirmAliasChange() {
    if (aliasRerolling) return;
    Alert.alert(
      'Change your alias?',
      'A new friendly alias will be selected for you. Public names cannot be typed or customized.',
      [
        { text: 'Keep This Alias', style: 'cancel' },
        { text: 'Change Alias', onPress: () => { void changeAlias(); } },
      ],
    );
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
      <Text style={styles.supportiveCopy}>Journey Points celebrate reading progress. Every chapter read is worth celebrating.</Text>

      {!signedIn ? (
        <View style={styles.joinCard}>
          <Text style={styles.joinTitle}>Join with a safe alias</Text>
          <Text style={styles.joinBody}>Sign in with Google to receive a friendly random alias and view the leaderboard. Your name, email, photo, and account ID are never shown here.</Text>
          <GoldButton title="Sign In with Google to Join" loading={signInBusy} onPress={() => { void onSignIn(); }} />
        </View>
      ) : null}

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
                  <Text numberOfLines={2} style={styles.entryAlias}>{item.alias}</Text>
                  {item.isCurrentUser ? <Text style={styles.youBadge}>YOU</Text> : null}
                </View>
                <Text style={styles.entryMeta}>{item.completedChapters} chapter{item.completedChapters === 1 ? '' : 's'} completed</Text>
                {item.isCurrentUser ? <Pressable accessibilityRole="button" disabled={aliasRerolling} onPress={confirmAliasChange} style={styles.aliasButton}><Text style={styles.aliasButtonText}>{aliasRerolling ? 'Choosing…' : 'Change random alias'}</Text></Pressable> : null}
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
  aliasButton: { alignSelf: 'flex-start', minHeight: 34, marginTop: 6, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.gold, justifyContent: 'center' },
  aliasButtonText: { color: colors.gold, fontSize: 10, lineHeight: 14, fontWeight: '900' },
  youBadge: { color: colors.charcoal, backgroundColor: colors.gold, borderRadius: 8, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  entryMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  entryPoints: { alignItems: 'flex-end' },
  entryPointsNumber: { color: colors.gold, fontSize: 16, lineHeight: 20, fontWeight: '900' },
  entryPointsLabel: { color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase' },
  separator: { height: 9 },
  doneButton: { minHeight: 48, marginTop: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold },
  doneButtonText: { color: colors.charcoal, fontSize: 14, fontWeight: '900' },
});
