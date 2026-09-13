import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Eyebrow } from '@/components/ui';
import { colors } from '@/constants/theme';
import { type JourneyRewardSummary } from '@/lib/journeyRewardsCore';

type JourneyProgressRewardsProps = {
  summary: JourneyRewardSummary;
  onOpenLeaderboard: () => void;
};

export function JourneyProgressRewards({
  summary,
  onOpenLeaderboard,
}: JourneyProgressRewardsProps) {
  const milestoneCopy = summary.nextMilestone
    ? `${summary.chaptersUntilNextMilestone} chapter${summary.chaptersUntilNextMilestone === 1 ? '' : 's'} to the ${summary.nextMilestone}-chapter milestone`
    : 'Every Journey milestone reached';
  const achievementCopy = summary.currentMilestone
    ? `${summary.currentMilestone}-chapter milestone reached`
    : 'No milestone reached yet';

  return (
    <View style={styles.details}>
      <View style={styles.headingRow}>
        <View>
          <Eyebrow>JOURNEY POINTS</Eyebrow>
          <Text style={styles.points}>{summary.journeyPoints.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.milestoneRow}>
        <View style={styles.milestoneTrack}>
          <View style={[styles.milestoneFill, { width: `${Math.round(summary.nextMilestoneProgress * 100)}%` }]} />
        </View>
        <Text style={styles.detailLabel}>MILESTONE REACHED</Text>
        <Text style={styles.achievementText}>{achievementCopy}</Text>
        <Text style={styles.detailLabel}>NEXT MILESTONE</Text>
        <Text style={styles.milestoneText}>{milestoneCopy}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View Journey leaderboard"
        onPress={onOpenLeaderboard}
        style={({ pressed }) => [styles.leaderboardButton, pressed && styles.pressed]}
      >
        <Text style={styles.leaderboardButtonText}>View Leaderboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  details: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  points: { color: colors.text, fontSize: 30, lineHeight: 35, fontWeight: '900' },
  milestoneRow: { marginTop: 14 },
  milestoneTrack: { height: 6, overflow: 'hidden', borderRadius: 8, backgroundColor: 'rgba(255,255,255,.11)' },
  milestoneFill: { height: '100%', borderRadius: 8, backgroundColor: colors.green },
  detailLabel: { color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '900', letterSpacing: 1.1, marginTop: 10 },
  achievementText: { color: colors.green, fontSize: 13, lineHeight: 19, fontWeight: '900', marginTop: 2 },
  milestoneText: { color: colors.ivory, fontSize: 13, lineHeight: 19, marginTop: 2 },
  leaderboardButton: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 14 },
  leaderboardButtonText: { color: colors.gold, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: .78 },
});
