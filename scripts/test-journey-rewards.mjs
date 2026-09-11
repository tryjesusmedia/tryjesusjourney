import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  JOURNEY_MILESTONES,
  JOURNEY_POINTS_PER_CHAPTER,
  JOURNEY_TOTAL_CHAPTERS,
  distinctValidCompletedChapterIndices,
  normalizeJourneyAlias,
  normalizeJourneyLeaderboardRows,
  summarizeJourneyRewards,
} from '../lib/journeyRewardsCore.ts';

assert.equal(JOURNEY_POINTS_PER_CHAPTER, 10);
assert.equal(JOURNEY_TOTAL_CHAPTERS, 1205);
assert.deepEqual([...JOURNEY_MILESTONES], [1, 25, 100, 250, 500, 750, 1000, 1205]);

assert.deepEqual(
  distinctValidCompletedChapterIndices([1204, 0, 0, 24, -1, 1205, 1.5, Number.NaN, null, true, '', '2']),
  [0, 24, 1204],
  'Only distinct integer chapter indices from 0 through 1204 earn points',
);
assert.deepEqual(summarizeJourneyRewards([]), {
  completedChapters: 0,
  journeyPoints: 0,
  currentMilestone: null,
  nextMilestone: 1,
  chaptersUntilNextMilestone: 1,
  nextMilestoneProgress: 0,
});
assert.deepEqual(summarizeJourneyRewards(Array.from({ length: 25 }, (_, index) => index)), {
  completedChapters: 25,
  journeyPoints: 250,
  currentMilestone: 25,
  nextMilestone: 100,
  chaptersUntilNextMilestone: 75,
  nextMilestoneProgress: .25,
});
const completeSummary = summarizeJourneyRewards(Array.from({ length: 1205 }, (_, index) => index));
assert.equal(completeSummary.journeyPoints, 12050);
assert.equal(completeSummary.currentMilestone, 1205);
assert.equal(completeSummary.nextMilestone, null);
assert.equal(completeSummary.chaptersUntilNextMilestone, 0);
assert.equal(completeSummary.nextMilestoneProgress, 1);

assert.equal(normalizeJourneyAlias('  Cedar Lamp  '), 'Cedar Lamp');
assert.equal(normalizeJourneyAlias([{ alias: 'Quiet Harbor' }]), 'Quiet Harbor');
assert.equal(normalizeJourneyAlias('   '), null);

const leaderboard = normalizeJourneyLeaderboardRows([
  {
    rank: '2', alias: '  Quiet Harbor ', journey_points: 250, completed_chapters: 25, is_current_user: true,
    user_id: 'must-not-leak', email: 'must-not-leak@example.com', avatar_url: 'must-not-leak', full_name: 'Must Not Leak',
  },
  { rank: 1, alias: 'Cedar Lamp', journey_points: 1000, completed_chapters: 100, is_current_user: false },
  { rank: 2, alias: 'Golden Path', journey_points: 250, completed_chapters: 25, is_current_user: false },
  { rank: 0, alias: 'Invalid Rank', journey_points: 0, completed_chapters: 0, is_current_user: false },
  { rank: 3, alias: '', journey_points: 10, completed_chapters: 1, is_current_user: false },
]);
assert.deepEqual(leaderboard, [
  { rank: 1, alias: 'Cedar Lamp', journeyPoints: 1000, completedChapters: 100, isCurrentUser: false },
  { rank: 2, alias: 'Golden Path', journeyPoints: 250, completedChapters: 25, isCurrentUser: false },
  { rank: 2, alias: 'Quiet Harbor', journeyPoints: 250, completedChapters: 25, isCurrentUser: true },
]);
for (const entry of leaderboard) {
  assert.deepEqual(Object.keys(entry).sort(), ['alias', 'completedChapters', 'isCurrentUser', 'journeyPoints', 'rank'].sort());
}

const screen = await readFile(new URL('../app/chronological.tsx', import.meta.url), 'utf8');
const statusCard = await readFile(new URL('../components/JourneyStatusCard.tsx', import.meta.url), 'utf8');
const leaderboardModal = await readFile(new URL('../components/JourneyLeaderboardModal.tsx', import.meta.url), 'utf8');
const profileHook = await readFile(new URL('../lib/useJourneyProfile.ts', import.meta.url), 'utf8');
const service = await readFile(new URL('../lib/journeyRewards.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260911150000_journey_rewards.sql', import.meta.url), 'utf8');
const lockdownMigration = await readFile(new URL('../supabase/migrations/20260911153000_lock_down_journey_reward_rpcs.sql', import.meta.url), 'utf8');

assert.ok(
  screen.indexOf('<Card style={styles.progressCard}>') < screen.indexOf('<JourneyStatusCard'),
  'Journey status belongs immediately after the existing Chron progress card',
);
assert.match(screen, /summarizeJourneyRewards\(progress\.completed\)/u, 'Offline points must derive from current on-phone progress');
assert.match(screen, /<JourneyLeaderboardModal/u);
assert.doesNotMatch(screen, /scrollTo(?:Offset|Index)/u, 'Opening the modal must not move the Chron reading list');
assert.doesNotMatch(screen.slice(screen.indexOf('if (authLoading || !ready')), /journeyProfile\.loading[^]*return/u, 'Profile network state must never gate the Bible screen');

assert.match(statusCard, /Journey Points celebrate your reading progress.not spiritual worth\./u);
assert.match(statusCard, /View Leaderboard/u);
assert.match(statusCard, /Sign in with Google to receive an alias and join the leaderboard\./u);

assert.match(service, /supabase\.rpc\('ensure_journey_profile'\)/u);
assert.match(service, /supabase\.rpc\('reroll_journey_alias'\)/u);
assert.match(service, /supabase\.rpc\('get_journey_leaderboard'\)/u);
assert.match(profileHook, /if \(!userId\)[^]*setAlias\(null\)/u, 'Signed-out readers must not request a public alias');
assert.match(profileHook, /catch \{[^]*setError\(true\)/u, 'Profile failures must stay contained in the optional reward layer');

assert.match(leaderboardModal, /if \(!visible \|\| !signedIn\)[^]*return;/u, 'A guest must never trigger the authenticated leaderboard RPC');
assert.match(leaderboardModal, /data=\{signedIn \? entries : \[\]\}/u);
assert.match(leaderboardModal, /Sign In with Google to Join/u);
assert.match(leaderboardModal, />Change alias</u);
assert.match(leaderboardModal, /isCurrentUser && styles\.currentEntry/u);
assert.match(leaderboardModal, /item\.rank[^]*item\.alias[^]*item\.journeyPoints[^]*item\.completedChapters/u);
assert.doesNotMatch(leaderboardModal, /TextInput|session\.user|user_id|avatar_url|full_name/u, 'The leaderboard must use only server-safe public fields and curated aliases');
assert.doesNotMatch(`${statusCard}\n${leaderboardModal}\n${profileHook}\n${service}`, /streak|demotion|spiritual level/iu);

assert.match(migration, /alter table public\.journey_reward_profiles enable row level security/iu);
assert.match(migration, /create unique index[^]*lower\(alias\)/iu);
assert.match(migration, /count\(distinct completed_index\)[^]*completed_index between 0 and 1204/iu);
assert.match(migration, /completed_chapters \* 10 as journey_points/iu);
assert.match(migration, /returns table \([^]*"rank" bigint,[^]*alias text,[^]*journey_points integer,[^]*completed_chapters integer,[^]*is_current_user boolean/iu);
assert.match(migration, /player\.user_id = auth\.uid\(\) as is_current_user/iu);
assert.doesNotMatch(migration, /create or replace function public\.reroll_journey_alias\([^)]*(?:user|alias)/iu, 'Alias reroll must never accept a target user or public text');
assert.match(lockdownMigration, /journey_ensure_profile_for_user\(uuid\) from public, anon, authenticated/iu);
assert.match(lockdownMigration, /ensure_journey_profile\(\) from public, anon/iu);
assert.match(lockdownMigration, /reroll_journey_alias\(\) from public, anon/iu);
assert.match(lockdownMigration, /get_journey_leaderboard\(\) from public, anon/iu);
assert.match(lockdownMigration, /grant execute on function public\.get_journey_leaderboard\(\) to authenticated/iu);

console.log('Journey Points, milestone, alias, privacy, offline, and leaderboard checks passed.');
