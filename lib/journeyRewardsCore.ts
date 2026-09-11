export const JOURNEY_POINTS_PER_CHAPTER = 10;
export const JOURNEY_TOTAL_CHAPTERS = 1205;
export const JOURNEY_MILESTONES = [1, 25, 100, 250, 500, 750, 1000, 1205] as const;

export type JourneyRewardSummary = {
  completedChapters: number;
  journeyPoints: number;
  currentMilestone: number | null;
  nextMilestone: number | null;
  chaptersUntilNextMilestone: number;
  nextMilestoneProgress: number;
};

export type JourneyLeaderboardEntry = {
  rank: number;
  alias: string;
  journeyPoints: number;
  completedChapters: number;
  isCurrentUser: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function distinctValidCompletedChapterIndices(completed: readonly unknown[] | null | undefined) {
  if (!Array.isArray(completed)) return [];
  return Array.from(new Set(
    completed
      .filter((index): index is number => typeof index === 'number'
        && Number.isInteger(index)
        && index >= 0
        && index < JOURNEY_TOTAL_CHAPTERS),
  )).sort((left, right) => left - right);
}

export function summarizeJourneyRewards(completed: readonly unknown[] | null | undefined): JourneyRewardSummary {
  const completedChapters = distinctValidCompletedChapterIndices(completed).length;
  const currentMilestone = [...JOURNEY_MILESTONES].reverse().find((milestone) => milestone <= completedChapters) ?? null;
  const nextMilestone = JOURNEY_MILESTONES.find((milestone) => milestone > completedChapters) ?? null;

  return {
    completedChapters,
    journeyPoints: completedChapters * JOURNEY_POINTS_PER_CHAPTER,
    currentMilestone,
    nextMilestone,
    chaptersUntilNextMilestone: nextMilestone ? nextMilestone - completedChapters : 0,
    nextMilestoneProgress: nextMilestone ? completedChapters / nextMilestone : 1,
  };
}

export function normalizeJourneyAlias(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value) && value.length === 1) return normalizeJourneyAlias(value[0]);
  if (isRecord(value)) return normalizeJourneyAlias(value.alias);
  return null;
}

function safeInteger(value: unknown) {
  const numeric = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isSafeInteger(numeric) ? numeric : null;
}

export function normalizeJourneyLeaderboardRows(value: unknown): JourneyLeaderboardEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap<JourneyLeaderboardEntry>((candidate) => {
    if (!isRecord(candidate)) return [];
    const rank = safeInteger(candidate.rank);
    const alias = normalizeJourneyAlias(candidate.alias);
    const journeyPoints = safeInteger(candidate.journey_points);
    const completedChapters = safeInteger(candidate.completed_chapters);
    if (
      rank === null || rank < 1
      || !alias
      || journeyPoints === null || journeyPoints < 0 || journeyPoints > JOURNEY_TOTAL_CHAPTERS * JOURNEY_POINTS_PER_CHAPTER
      || completedChapters === null || completedChapters < 0 || completedChapters > JOURNEY_TOTAL_CHAPTERS
      || typeof candidate.is_current_user !== 'boolean'
    ) return [];

    return [{
      rank,
      alias,
      journeyPoints,
      completedChapters,
      isCurrentUser: candidate.is_current_user,
    }];
  }).sort((left, right) => left.rank - right.rank
    || right.journeyPoints - left.journeyPoints
    || left.alias.localeCompare(right.alias));
}
