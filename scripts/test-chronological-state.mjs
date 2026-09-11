import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  accountProgressKey,
  guestProgressKey,
  migrateOriginalChronologicalProgress,
  selectAccountChronologicalProgress,
  selectAccountChronologicalProgressWithGuest,
  shouldLinkGuestProgress,
} from '../lib/chronologicalProgressCore.ts';
import {
  applyDetachedNoteDeletion,
  accountNotesKey,
  ensureStableClientMutationId,
  guestNotesKey,
  mergeDetachedNotesIntoAccount,
  mergeGuestNotesIntoAccount,
  replaceChronologicalNoteById,
  shouldLinkGuestNotes,
} from '../lib/chronologicalNotesCore.ts';
import {
  chronologicalLoadIdentity,
  isChronologicalLoadCurrent,
} from '../lib/chronologicalLoadCore.ts';

const plan = JSON.parse(await readFile(new URL('../data/chronologicalBiblePlan.json', import.meta.url), 'utf8'));
const limits = { chapterCount: plan.chapterCount, readingCount: plan.readingCount };
for (const reading of plan.readings) {
  for (const task of reading.bibleTasks) {
    const gateway = new URL(task.url);
    assert.match(gateway.hostname, /(^|\.)biblegateway\.com$/u);
    assert.equal(gateway.searchParams.get('version'), 'KJV');
    assert.equal(gateway.searchParams.get('search'), task.label, `${task.label} must open its matching KJV passage on BibleGateway`);
  }
}
const maps = {
  previousChapterMigration: plan.previousChapterMigration,
  previousReadingMigration: plan.previousReadingMigration,
  taskChapterMigration: plan.taskChapterMigration,
  taskReadingMigration: plan.taskReadingMigration,
  originalChapterMigration: plan.originalChapterMigration,
  originalReadingMigration: plan.originalReadingMigration,
};

const baseKey = 'tryjesus_chronological_plan_progress_v4';
assert.notEqual(guestProgressKey(baseKey), accountProgressKey(baseKey, 'user-a'));
assert.notEqual(accountProgressKey(baseKey, 'user-a'), accountProgressKey(baseKey, 'user-b'));

const guest = { completed: [1, 2], lastIndex: 2, updatedAt: '2026-09-10T10:00:00.000Z' };
const userBRemote = { completed: [44], lastIndex: 12, updatedAt: '2026-09-10T11:00:00.000Z' };
assert.equal(shouldLinkGuestProgress(null, null, guest, null, 'user-a'), true);
assert.equal(shouldLinkGuestProgress(null, null, guest, 'user-a', 'user-b'), false);
assert.equal(shouldLinkGuestProgress(null, userBRemote, guest, null, 'user-b'), false);
assert.deepEqual(selectAccountChronologicalProgress(null, userBRemote), userBRemote);

const userALocalBeforeDetach = { completed: [1], lastIndex: 1, updatedAt: '2026-09-10T09:00:00.000Z' };
const userARemoteBeforeDetach = { completed: [1, 2], lastIndex: 2, updatedAt: '2026-09-10T10:00:00.000Z' };
const userADetachedEdit = { completed: [1, 2, 3], lastIndex: 3, updatedAt: '2026-09-10T12:00:00.000Z' };
assert.equal(
  shouldLinkGuestProgress(userALocalBeforeDetach, userARemoteBeforeDetach, userADetachedEdit, 'user-a', 'user-a'),
  true,
  'A targeted detached snapshot must be considered even when account and remote snapshots exist',
);
assert.deepEqual(
  selectAccountChronologicalProgressWithGuest(
    userALocalBeforeDetach,
    userARemoteBeforeDetach,
    userADetachedEdit,
    'user-a',
    'user-a',
  ),
  userADetachedEdit,
  'The newest same-account detached edit must win on reconnect',
);
assert.deepEqual(
  selectAccountChronologicalProgressWithGuest(
    null,
    userBRemote,
    userADetachedEdit,
    'user-a',
    'user-b',
  ),
  userBRemote,
  'A different account must never consume another account’s detached progress',
);

const migratedJob = migrateOriginalChronologicalProgress({
  completed_indices: [0],
  last_index: 0,
  updated_at: '2026-09-10T10:00:00.000Z',
}, maps, limits);
assert.deepEqual(migratedJob.completed, plan.originalChapterMigration['0']);
assert.equal(migratedJob.lastIndex, 4, 'Completed legacy Job resumes at the first Job segment with incomplete chapters');
assert.equal(plan.originalReadingMigration['0'].last, 8);
assert.equal(plan.originalReadingMigration['0'].resume, 4);

const notesBaseKey = 'tryjesus_chronological_notes_v2';
assert.notEqual(guestNotesKey(notesBaseKey), accountNotesKey(notesBaseKey, 'user-a'));
assert.notEqual(accountNotesKey(notesBaseKey, 'user-a'), accountNotesKey(notesBaseKey, 'user-b'));

let mutationFactoryCalls = 0;
const stableMutationId = '733ddb65-c44d-42c4-9526-e10f5f466d79';
const noteWithMutation = ensureStableClientMutationId(
  { id: 'local-1', clientMutationId: undefined },
  () => { mutationFactoryCalls += 1; return stableMutationId; },
);
const sameNoteOnRetry = ensureStableClientMutationId(
  noteWithMutation,
  () => { mutationFactoryCalls += 1; return '74918e6e-e361-4e1e-bfe7-e18b1b876ef1'; },
);
assert.equal(noteWithMutation.clientMutationId, stableMutationId);
assert.equal(sameNoteOnRetry.clientMutationId, stableMutationId);
assert.equal(mutationFactoryCalls, 1, 'A retry must reuse the original client mutation ID');

const guestNotes = [
  { id: 'guest-1', clientMutationId: stableMutationId },
  { id: 'guest-2', clientMutationId: 'fae4371c-8eb2-4f72-a34f-2fa17b1d4fcb' },
];
const accountNotes = [{ id: 'server-1', clientMutationId: stableMutationId, ownerUserId: 'user-a' }];
assert.equal(shouldLinkGuestNotes(guestNotes, null, 'user-a'), true);
assert.equal(shouldLinkGuestNotes(guestNotes, 'user-a', 'user-b'), false);
assert.deepEqual(mergeGuestNotesIntoAccount(accountNotes, guestNotes, 'user-a'), [
  accountNotes[0],
  { ...guestNotes[1], ownerUserId: 'user-a' },
]);

const detachedDeletion = {
  id: 'server-1',
  clientMutationId: stableMutationId,
  ownerUserId: undefined,
  synced: true,
  deletedAt: '2026-09-10T12:30:00.000Z',
};
assert.deepEqual(
  mergeDetachedNotesIntoAccount(
    [{ ...accountNotes[0], synced: true, deletedAt: undefined }],
    [detachedDeletion],
    'user-a',
  ),
  [{ ...detachedDeletion, ownerUserId: 'user-a' }],
  'A same-account detached tombstone must replace the account copy',
);
assert.deepEqual(
  applyDetachedNoteDeletion(
    [{ id: 'server-1', synced: true, clientMutationId: stableMutationId }],
    { id: 'server-1', synced: true, clientMutationId: stableMutationId },
    detachedDeletion.deletedAt,
  ),
  [{ id: 'server-1', synced: true, clientMutationId: stableMutationId, deletedAt: detachedDeletion.deletedAt }],
);
assert.deepEqual(
  applyDetachedNoteDeletion(
    [{ id: 'local-1', synced: false, clientMutationId: stableMutationId }],
    { id: 'local-1', synced: false, clientMutationId: stableMutationId },
    detachedDeletion.deletedAt,
  ),
  [],
  'Deleting a not-yet-synced detached note must remove its account checkpoint too',
);

const accountALoad = { generation: 7, identity: chronologicalLoadIdentity('user-a') };
assert.equal(isChronologicalLoadCurrent(accountALoad, 7, 'user-a', false), true);
assert.equal(isChronologicalLoadCurrent(accountALoad, 8, 'user-a', false), false, 'An older overlapping load is stale');
assert.equal(isChronologicalLoadCurrent(accountALoad, 7, 'user-b', false), false, 'Account transitions invalidate prior results');
assert.equal(isChronologicalLoadCurrent(accountALoad, 7, 'user-a', true), false, 'No results apply during auth hydration');

const temporaryNotes = [
  { id: 'local-1', synced: false },
  { id: 'local-2', synced: false },
];
const afterFirstUpload = replaceChronologicalNoteById(temporaryNotes, 'local-1', { id: 'server-1', synced: true });
assert.deepEqual(afterFirstUpload, [
  { id: 'server-1', synced: true },
  { id: 'local-2', synced: false },
]);
assert.deepEqual(afterFirstUpload.filter((note) => !note.synced).map((note) => note.id), ['local-2']);

const idempotencyMigration = await readFile(
  new URL('../supabase/migrations/20260910000000_idempotent_chronological_notes.sql', import.meta.url),
  'utf8',
);
assert.match(idempotencyMigration, /client_mutation_id uuid/);
assert.match(idempotencyMigration, /unique index[^]*user_id, plan_id, client_mutation_id/i);
assert.match(idempotencyMigration, /p_client_mutation_id uuid default null/);
assert.match(idempotencyMigration, /chronological-bible-order-v3/);
assert.match(idempotencyMigration, /Client mutation ID was already used for a different principle/);
assert.match(idempotencyMigration, /notify pgrst, 'reload schema'/);

const chronologicalScreen = await readFile(new URL('../app/chronological.tsx', import.meta.url), 'utf8');
const moreScreen = await readFile(new URL('../app/(tabs)/more.tsx', import.meta.url), 'utf8');
const bibleTab = await readFile(new URL('../app/(tabs)/bible.tsx', import.meta.url), 'utf8');
const homeScreen = await readFile(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
assert.match(chronologicalScreen, /prepareChronologicalDetach\(sessionUserId\)[^]*await signOut\(\)/);
assert.match(chronologicalScreen, /accessibilityLabel="Chron Bible menu"/);
assert.match(chronologicalScreen, /session[^]*Sign Out of Google Sync[^]*Sign In to Sync/);
assert.match(chronologicalScreen, /<Eyebrow>YOUR PROGRESS<\/Eyebrow>/);
assert.doesNotMatch(chronologicalScreen, /YOUR OPTIONAL PROGRESS/);
assert.doesNotMatch(chronologicalScreen, /Read all \{chronologicalPlanMeta\.readingCount\} assignments/);
assert.doesNotMatch(chronologicalScreen, /Read freely, or mark chapters/);
assert.doesNotMatch(chronologicalScreen, /SYNC IS ON|SAVED ON THIS PHONE|Chron Bible is synced\./);
assert.match(chronologicalScreen, /openChapter\(task\.label\)[^]*task\.label[^]*chapterDivider[^]*openBibleGateway\(task\.url\)[^]*Read on BibleGateway/u, 'Each task must show native reading first, a divider, then BibleGateway');
assert.match(chronologicalScreen, /await Linking\.openURL\(url\)/u);
assert.doesNotMatch(chronologicalScreen, /BibleHighlightsWindow|BibleNotesButton|useBibleHighlights|kind: 'highlight'|searchResults\.highlights|HIGHLIGHT & NOTE/u);
assert.doesNotMatch(chronologicalScreen, /Search readings, highlights, and notes|SEARCH BIBLE \+ NOTES|No matching readings or notes|Read KJV/u);
assert.doesNotMatch(`${bibleTab}\n${homeScreen}\n${moreScreen}`, /Chron Bible[^\n<]*(?:highlights|notes)|(?:highlights|notes)[^\n<]*Chron Bible/iu, 'Visible Chron Bible copy must not advertise the retired notes/highlighting feature');
assert.doesNotMatch(chronologicalScreen, /key=\{normalizedQuery \? 'search' : view\}/);
assert.doesNotMatch(chronologicalScreen, /scrollTo(?:Offset|Index)/);
assert.match(moreScreen, /prepareChronologicalDetach\(session\.user\.id, \{ requireFreshRemoteCopy: true \}\)[^]*await signOut\(\)/);
assert.match(moreScreen, /prepareChronologicalDetach\(session\.user\.id, \{ requireFreshRemoteCopy: true \}\)[^]*functions\.invoke\('delete-account'/);

console.log('Chronological progress, detach, auth-race, note isolation, migration, and idempotency checks passed.');
