import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ASK_HISTORY_LIMIT,
  mergeGuestAskMessages,
  mergeGuestGuideProgress,
  mergeGuestJournalEntries,
} from '../lib/localStoreCore.ts';

const localGuide = {
  lessonUrl: 'https://tryjesusmedia.com/get-to-know-jesus/guide4/',
  progressPercent: 15,
  updatedAt: '2026-09-10T12:00:00.000Z',
};
const olderCloudGuide = {
  lessonUrl: 'https://tryjesusmedia.com/get-to-know-jesus/guide3/',
  progressPercent: 95,
  updatedAt: '2026-09-10T13:00:00.000Z',
};
const newerCloudGuide = {
  lessonUrl: 'https://tryjesusmedia.com/get-to-know-jesus/guide5/',
  progressPercent: 5,
  updatedAt: '2026-09-10T11:00:00.000Z',
};
assert.deepEqual(mergeGuestGuideProgress(localGuide, olderCloudGuide), localGuide, 'Import must not move guide progress backwards');
assert.deepEqual(mergeGuestGuideProgress(localGuide, newerCloudGuide), newerCloudGuide, 'Import keeps the furthest guide position');
assert.deepEqual(mergeGuestGuideProgress(null, olderCloudGuide), olderCloudGuide);

const localJournal = {
  id: 'local-1',
  title: 'Prayer',
  body: 'Please guide me.',
  createdAt: '2026-09-10T12:00:00.000Z',
};
const cloudJournal = {
  id: 'legacy-cloud:user-a:journal:4',
  title: 'Thanks',
  body: 'Thank you for today.',
  createdAt: '2026-09-09T12:00:00.000Z',
  legacyCloudId: 'user-a:journal:4',
};
assert.deepEqual(
  mergeGuestJournalEntries([localJournal], [cloudJournal, { ...cloudJournal }]),
  [localJournal, cloudJournal],
  'Journal import retains local entries and deduplicates retries',
);
assert.deepEqual(
  mergeGuestJournalEntries([localJournal], [{ ...localJournal, id: 'different-id' }]),
  [localJournal],
  'An identical journal entry is not duplicated under a different ID',
);

const askMessages = Array.from({ length: ASK_HISTORY_LIMIT + 5 }, (_, index) => ({
  id: `message-${index}`,
  role: index % 2 ? 'assistant' : 'user',
  text: `Message ${index}`,
  createdAt: new Date(Date.UTC(2026, 8, 10, 0, index)).toISOString(),
}));
const capped = mergeGuestAskMessages([], askMessages);
assert.equal(capped.length, ASK_HISTORY_LIMIT);
assert.equal(capped[0].id, 'message-5', 'The cap keeps the newest Ask history');
assert.equal(capped.at(-1).id, `message-${ASK_HISTORY_LIMIT + 4}`);

const cloudAsk = {
  id: 'legacy-cloud:user-a:ask:8',
  role: 'assistant',
  text: 'A saved answer',
  createdAt: '2026-09-10T13:00:00.000Z',
  legacyCloudId: 'user-a:ask:8',
};
assert.deepEqual(
  mergeGuestAskMessages([], [cloudAsk, { ...cloudAsk }]),
  [cloudAsk],
  'Ask import deduplicates a repeated cloud download',
);

const authSource = await readFile(new URL('../contexts/AuthContext.tsx', import.meta.url), 'utf8');
const importerSource = await readFile(new URL('../lib/legacyCloudData.ts', import.meta.url), 'utf8');
const askSource = await readFile(new URL('../app/(tabs)/ask.tsx', import.meta.url), 'utf8');
const moreSource = await readFile(new URL('../app/(tabs)/more.tsx', import.meta.url), 'utf8');
assert.match(authSource, /preserveLegacyCloudData\(userId\)/);
assert.match(importerSource, /if \(requireAll\) \{\s*await Promise\.all\(preservationOperations\(userId\)\)/);
assert.match(importerSource, /runOnce\(userId, 'guide'/);
assert.match(importerSource, /runOnce\(userId, 'journal'/);
assert.match(importerSource, /runOnce\(userId, 'ask'/);
assert.match(importerSource, /\.from\('guide_progress'\)/);
assert.match(importerSource, /\.from\('journal_entries'\)/);
assert.match(importerSource, /\.from\('pastor_kal_chat_messages'\)/);
assert.doesNotMatch(importerSource, /\.(?:insert|upsert|update)\(/, 'Legacy preservation must be download-only');
assert.doesNotMatch(importerSource, /\.from\([^;]+?\.delete\(/, 'Legacy preservation must not delete cloud rows');
assert.match(askSource, /getGuestAskHistory\(\)/);
assert.match(askSource, /appendGuestAskMessage/);
assert.doesNotMatch(askSource, /\.from\('pastor_kal_chat_messages'\)/, 'New Ask messages stay on-device');

const requiredPreservation = moreSource.indexOf(
  'await preserveLegacyCloudData(session.user.id, { requireAll: true })',
);
const accountDeletion = moreSource.indexOf("supabase.functions.invoke('delete-account'");
assert.ok(requiredPreservation >= 0, 'Account deletion must require complete legacy preservation');
assert.ok(accountDeletion > requiredPreservation, 'Strict legacy preservation must finish before account deletion starts');

console.log('Legacy cloud preservation, local merge, deduplication, and Ask history cap checks passed.');
