import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow } from '@/components/ui';
import { colors } from '@/constants/theme';
import { JOURNEY_TOTAL_CHAPTERS, type JourneyRewardSummary } from '@/lib/journeyRewardsCore';

type JourneyStatusCardProps = {
  summary: JourneyRewardSummary;
  signedIn: boolean;
  alias: string | null;
  aliasLoading: boolean;
  onOpenLeaderboard: () => void;
};

export function JourneyStatusCard({
  summary,
  signedIn,
  alias,
  aliasLoading,
  onOpenLeaderboard,
}: JourneyStatusCardProps) {
  const milestoneCopy = summary.nextMilestone
    ? `${summary.chaptersUntilNextMilestone} chapter${summary.chaptersUntilNextMilestone === 1 ? '' : 's'} to the ${summary.nextMilestone}-chapter milestone`
    : 'Every Journey milestone reached';
  const achievementCopy = summary.currentMilestone
    ? `${summary.currentMilestone}-chapter milestone reached`
    : 'Your first milestone is one chapter';

  return (
    <Card style={styles.card}>
      <View style={styles.headingRow}>
        <View>
          <Eyebrow>JOURNEY POINTS</Eyebrow>
          <Text style={styles.points}>{summary.journeyPoints.toLocaleString()}</Text>
        </View>
        <View style={styles.chapterPill}>
          <Text style={styles.chapterPillNumber}>{summary.completedChapters}/{JOURNEY_TOTAL_CHAPTERS}</Text>
          <Text style={styles.chapterPillLabel}>chapters</Text>
        </View>
      </View>

      <View style={styles.milestoneRow}>
        <View style={styles.milestoneTrack}>
          <View style={[styles.milestoneFill, { width: `${Math.round(summary.nextMilestoneProgress * 100)}%` }]} />
        </View>
        <Text style={styles.achievementText}>{achievementCopy}</Text>
        <Text style={styles.milestoneText}>{milestoneCopy}</Text>
      </View>

      <Text style={styles.purpose}>Journey Points celebrate your reading progress—not spiritual worth.</Text>
      <Text style={styles.identity}>
        {signedIn
          ? aliasLoading ? 'Preparing your Journey alias…' : alias ? `Your alias: ${alias}` : 'Your alias is temporarily unavailable.'
          : 'Sign in with Google to receive an alias and join the leaderboard.'}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={signedIn ? 'View Journey leaderboard' : 'Sign in to view Journey leaderboard'}
        onPress={onOpenLeaderboard}
        style={({ pressed }) => [styles.leaderboardButton, pressed && styles.pressed]}
      >
        <Text style={styles.leaderboardButtonText}>View Leaderboard</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel2, padding: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  points: { color: colors.text, fontSize: 30, lineHeight: 35, fontWeight: '900' },
  chapterPill: { minWidth: 78, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.plum, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  chapterPillNumber: { color: colors.gold, fontSize: 17, lineHeight: 20, fontWeight: '900' },
  chapterPillLabel: { color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: .7 },
  milestoneRow: { marginTop: 14 },
  milestoneTrack: { height: 6, overflow: 'hidden', borderRadius: 8, backgroundColor: 'rgba(255,255,255,.11)' },
  milestoneFill: { height: '100%', borderRadius: 8, backgroundColor: colors.green },
  achievementText: { color: colors.green, fontSize: 12, lineHeight: 18, fontWeight: '900', marginTop: 7 },
  milestoneText: { color: colors.ivory, fontSize: 12, lineHeight: 18, marginTop: 1 },
  purpose: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 13 },
  identity: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  leaderboardButton: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 14 },
  leaderboardButtonText: { color: colors.gold, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: .78 },
});
