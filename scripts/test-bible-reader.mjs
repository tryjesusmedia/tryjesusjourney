import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  bibleVerseNumbers,
  canonicalBibleText,
  canonicalChapterLabel,
  contiguousVerseGroups,
  parseBibleReferenceParts,
} from '../data/bibleReferenceCore.ts';
import { applyDetachedBibleHighlightDeletion } from '../lib/bibleHighlightDetachCore.ts';
import { parseBibleHighlightCreationDate } from '../lib/bibleHighlightDateCore.ts';
import { fetchAllBibleHighlightPages } from '../lib/bibleHighlightPaginationCore.ts';
import { mergeBibleHighlights, reconcileRemoteBibleHighlights } from '../lib/bibleHighlightSyncCore.ts';

const kjv = JSON.parse(await readFile(new URL('../data/kjv.json', import.meta.url), 'utf8'));
const web = JSON.parse(await readFile(new URL('../data/web.json', import.meta.url), 'utf8'));
assert.equal(Object.keys(kjv).length, 1189);
assert.equal(Object.keys(web).length, 1189);
assert.equal(Object.values(kjv).reduce((total, verses) => total + verses.length, 0), 31102);
assert.equal(Object.values(web).reduce((total, verses) => total + verses.length, 0), 31103);
assert.equal(web['Genesis 1'][0].text, 'In the beginning, God created the heavens and the earth.');
assert.equal(canonicalChapterLabel('Psalm 23'), 'Psalms 23');

for (const [name, corpus, chapter, phrase] of [
  ['KJV', kjv, 'John 3', 'For God so loved the world'],
  ['WEB', web, 'John 3', 'For God so loved the world'],
]) {
  const canonical = canonicalBibleText(corpus[chapter]);
  const startOffset = canonical.indexOf(phrase);
  assert.ok(startOffset >= 0, `${name} fixture phrase must exist`);
  assert.equal(canonical.slice(startOffset, startOffset + phrase.length), phrase, `${name} text-only offsets must round-trip`);
  assert.ok(!canonical.startsWith('1 '), `${name} canonical offsets must not include rendered verse numbers`);
  assert.equal(canonical.split('\n').length, corpus[chapter].length, `${name} must use one newline between verses`);
}

assert.deepEqual(parseBibleReferenceParts('2 Samuel 14:25-26; 15:1-6'), [
  { book: '2 Samuel', chapter: 14, verseSpec: '25-26', displayReference: '2 Samuel 14:25-26' },
  { book: '2 Samuel', chapter: 15, verseSpec: '1-6', displayReference: '2 Samuel 15:1-6' },
]);
assert.deepEqual(parseBibleReferenceParts('2 John 7–11'), [
  { book: '2 John', chapter: 1, verseSpec: '7-11', displayReference: '2 John 7-11' },
]);
assert.deepEqual(parseBibleReferenceParts('Jude 5'), [
  { book: 'Jude', chapter: 1, verseSpec: '5', displayReference: 'Jude 5' },
]);
assert.deepEqual(parseBibleReferenceParts('Jude 5, 7-9'), [
  { book: 'Jude', chapter: 1, verseSpec: '5, 7-9', displayReference: 'Jude 5, 7-9' },
]);
assert.deepEqual(parseBibleReferenceParts('Jude'), [
  { book: 'Jude', chapter: 1, displayReference: 'Jude 1' },
]);
for (const book of ['Obadiah', 'Philemon', '2 John', '3 John', 'Jude']) {
  assert.deepEqual(parseBibleReferenceParts(`${book} 1`), [
    { book, chapter: 1, verseSpec: undefined, displayReference: `${book} 1` },
  ], `${book} 1 must open the complete one-chapter book`);
}
assert.deepEqual(parseBibleReferenceParts('Revelation 21–22'), [
  { book: 'Revelation', chapter: 21, displayReference: 'Revelation 21' },
  { book: 'Revelation', chapter: 22, displayReference: 'Revelation 22' },
]);
assert.deepEqual(parseBibleReferenceParts('1 John 1:5-2:2'), [
  { book: '1 John', chapter: 1, verseSpec: '5-', displayReference: '1 John 1:5-end' },
  { book: '1 John', chapter: 2, verseSpec: '1-2', displayReference: '1 John 2:1-2' },
]);
assert.deepEqual(parseBibleReferenceParts('2 Kings 18:13-19:7'), [
  { book: '2 Kings', chapter: 18, verseSpec: '13-', displayReference: '2 Kings 18:13-end' },
  { book: '2 Kings', chapter: 19, verseSpec: '1-7', displayReference: '2 Kings 19:1-7' },
]);
assert.deepEqual(parseBibleReferenceParts('Isaiah 52:13-53:12'), [
  { book: 'Isaiah', chapter: 52, verseSpec: '13-', displayReference: 'Isaiah 52:13-end' },
  { book: 'Isaiah', chapter: 53, verseSpec: '1-12', displayReference: 'Isaiah 53:1-12' },
]);
assert.deepEqual(parseBibleReferenceParts('Revelation 20:11-21:5'), [
  { book: 'Revelation', chapter: 20, verseSpec: '11-', displayReference: 'Revelation 20:11-end' },
  { book: 'Revelation', chapter: 21, verseSpec: '1-5', displayReference: 'Revelation 21:1-5' },
]);
assert.deepEqual(contiguousVerseGroups([{ verse: 17 }, { verse: 23 }, { verse: 24 }]), [
  [{ verse: 17 }],
  [{ verse: 23 }, { verse: 24 }],
]);
assert.deepEqual(bibleVerseNumbers('13-', 15), [13, 14, 15], 'An open-ended cross-chapter range must include the rest of its first chapter');

for (const [chapter, verses] of Object.entries(kjv)) {
  for (let index = 1; index < verses.length; index += 1) {
    assert.equal(verses[index].verse, verses[index - 1].verse + 1, `${chapter} must not skip a verse number`);
  }
}

const reader = await readFile(new URL('../app/bible-reader.tsx', import.meta.url), 'utf8');
const readerHtml = await readFile(new URL('../components/bibleReaderHtml.ts', import.meta.url), 'utf8');
const notes = await readFile(new URL('../components/BibleHighlights.tsx', import.meta.url), 'utf8');
const highlightsCore = await readFile(new URL('../lib/bibleHighlightsCore.ts', import.meta.url), 'utf8');
const highlightsStore = await readFile(new URL('../lib/bibleHighlights.ts', import.meta.url), 'utf8');
const guideReader = await readFile(new URL('../app/guide-reader.tsx', import.meta.url), 'utf8');
for (const color of ['yellow', 'orange', 'red', 'green', 'cyan', 'purple']) {
  assert.ok(highlightsCore.includes(`'${color}'`), `Reader must expose the ${color} highlighter through the shared palette`);
}
assert.ok(reader.includes('HIGHLIGHT_COLORS'));
assert.match(reader, /message\.type === 'selection'\s*&& ready/u, 'Selection must remain disabled until saved highlights finish loading');
assert.match(reader, /if \(!ready \|\| !pendingSelection \|\| selectionBusy\) return;/u, 'Creation must remain gated until saved highlights finish loading');
assert.match(reader, /left: 16, right: 16, minHeight: 89/u, 'The six-color palette must use the full narrow-phone width above the Notes button');
assert.match(reader, /TAP A COLOR TO HIGHLIGHT/u, 'The color action must be explicit once text is selected');
assert.match(reader, /pendingSelection\.selectedText/u, 'The palette must confirm which text is selected');
assert.match(reader, /Highlight saved/u, 'Saving a highlight must give visible confirmation without leaving the reader');
assert.match(reader, /message\.type !== 'ready'/u, 'A fresh WebView ready message must not overwrite the saved reading position');
assert.match(reader, /requestAnimationFrame\(\(\) => \{[^]*window\.scrollTo\(0, \$\{y\}\)[^]*setTimeout\(\(\) => window\.scrollTo\(0, \$\{y\}\), 50\)/u, 'The reader must restore its exact position after rendered highlights refresh');
assert.match(reader, /window\.getSelection\(\)\?\.removeAllRanges\(\)/u, 'The native selection must clear after a highlight is saved');
const chooseColorBody = reader.slice(reader.indexOf('async function chooseColor'), reader.indexOf('function chooseTranslation'));
assert.doesNotMatch(chooseColorBody, /router\.(?:back|push|replace)/u, 'Saving a highlight must never close or navigate away from the reader');
for (const label of ['Date Created', 'Bible Order', 'Chronological', 'Color', 'Save Changes']) {
  assert.ok(notes.includes(label), `Notes window must include ${label}`);
}
assert.match(guideReader, /bibleGatewayReference\(nextUrl\)/);
assert.match(guideReader, /\/bible-reader/);
assert.match(guideReader, /egwwritings\\\.org\|whiteestate\\\.org/);
assert.match(readerHtml, /data-selection-group/);
assert.match(readerHtml, /role="button" tabindex="0" aria-label="Open highlight and note"/u);
assert.match(readerHtml, /event\.key === 'Enter' \|\| event\.key === ' '/u);
const loadStore = highlightsStore.slice(
  highlightsStore.indexOf('export async function loadBibleHighlights'),
  highlightsStore.indexOf('export async function createBibleHighlight'),
);
assert.ok(
  loadStore.indexOf(".from('bible_highlights')") < loadStore.indexOf('working = await syncPending'),
  'Reconnect must fetch and reconcile the remote copy before uploading pending phone edits',
);
assert.match(loadStore, /\.order\('id', \{ ascending: true \}\)\s*\.range\(from, to\)/u, 'Every remote page must use the same deterministic id order');
assert.ok(
  loadStore.indexOf('await fetchAllBibleHighlightPages') < loadStore.indexOf('reconcileRemoteBibleHighlights'),
  'Reconciliation must wait for every remote page',
);
const softDeleteStore = highlightsStore.slice(
  highlightsStore.indexOf('async function softDeleteRemote'),
  highlightsStore.indexOf('async function saveInBucket'),
);
assert.match(softDeleteStore, /\.upsert\(/u, 'A deletion without a returned remote id must upsert a tombstone by mutation id');
assert.match(softDeleteStore, /deleted_at: deletedAt/u);
assert.doesNotMatch(highlightsStore, /\.from\('bible_highlights'\)\.delete\(/u, 'Bible highlights must never be hard-deleted');
assert.match(highlightsStore, /client_mutation_id,deleted_at/u, 'Remote loads must include server tombstones');
const migration = await readFile(new URL('../supabase/migrations/20260911000000_bible_highlights.sql', import.meta.url), 'utf8');
assert.match(migration, /deleted_at timestamptz/u);
assert.match(migration, /preserve_bible_highlight_tombstone/u);
assert.match(migration, /revoke delete on public\.bible_highlights/u);
const immutableTombstoneGuard = migration.indexOf('if old.deleted_at is not null then');
const incomingTombstoneGuard = migration.indexOf('if new.deleted_at is not null then');
const staleLiveGuard = migration.indexOf('if new.updated_at < old.updated_at then');
assert.ok(immutableTombstoneGuard >= 0 && immutableTombstoneGuard < incomingTombstoneGuard);
assert.ok(incomingTombstoneGuard < staleLiveGuard, 'A new tombstone must win even when its device timestamp is older');
assert.match(migration.slice(staleLiveGuard), /return old;/u, 'A stale live update must preserve the newer stored row');

const pageSource = Array.from({ length: 2505 }, (_, index) => ({ id: String(index).padStart(4, '0') }));
const requestedPages = [];
const pagedHighlights = await fetchAllBibleHighlightPages(async (from, to) => {
  requestedPages.push([from, to]);
  return pageSource.slice(from, to + 1);
});
assert.deepEqual(requestedPages, [[0, 999], [1000, 1999], [2000, 2999]]);
assert.equal(pagedHighlights.length, 2505, 'Pagination must retain highlights beyond Supabase’s 1,000-row response cap');
assert.deepEqual(pagedHighlights, pageSource, 'Pagination must preserve deterministic server order');

const detachedFixture = {
  id: 'remote-highlight', planId: 'chronological', readingId: 'reading-1', chapterLabel: 'John 3', reference: 'John 3:16',
  translation: 'KJV', startOffset: 0, endOffset: 8, selectedText: 'For God', color: 'yellow', note: '',
  createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-01T12:00:00.000Z', synced: true,
};
const detachedDeleted = applyDetachedBibleHighlightDeletion(
  [detachedFixture], detachedFixture, '2026-09-11T12:00:00.000Z', 'linked-user',
);
assert.equal(detachedDeleted.length, 1, 'Detached deletion must retain a hidden tombstone until reconnect');
assert.equal(detachedDeleted[0].deletedAt, '2026-09-11T12:00:00.000Z');
assert.equal(detachedDeleted[0].remoteId, 'remote-highlight');
assert.equal(detachedDeleted[0].synced, false);
assert.deepEqual(applyDetachedBibleHighlightDeletion([detachedFixture], detachedFixture, '2026-09-11T12:00:00.000Z'), []);
const responseLostFixture = {
  ...detachedFixture,
  id: 'local-response-lost',
  remoteId: undefined,
  synced: false,
  clientMutationId: '12345678-1234-4234-8234-123456789abc',
};
const responseLostDeleted = applyDetachedBibleHighlightDeletion(
  [responseLostFixture], responseLostFixture, '2026-09-11T12:00:00.000Z', 'linked-user',
);
assert.equal(responseLostDeleted[0].deletedAt, '2026-09-11T12:00:00.000Z', 'A response-lost insert must retain a mutation-linked tombstone');

const remoteFixture = {
  ...detachedFixture,
  id: 'server-id',
  remoteId: 'server-id',
  clientMutationId: 'shared-mutation',
  updatedAt: '2026-09-10T12:00:00.000Z',
};
const olderOfflineFixture = {
  ...remoteFixture,
  id: 'local-id',
  remoteId: undefined,
  synced: false,
  note: 'older phone edit',
  updatedAt: '2026-09-09T12:00:00.000Z',
};
const newerOfflineFixture = {
  ...olderOfflineFixture,
  note: 'newer phone edit',
  updatedAt: '2026-09-11T12:00:00.000Z',
};
assert.deepEqual(reconcileRemoteBibleHighlights([remoteFixture], [olderOfflineFixture]), [remoteFixture], 'Newer web edits must win on reconnect');
assert.deepEqual(reconcileRemoteBibleHighlights([remoteFixture], [newerOfflineFixture]), [newerOfflineFixture], 'Newer phone edits must remain pending');
assert.equal(mergeBibleHighlights([remoteFixture], [newerOfflineFixture]).length, 1, 'Client mutation identity must deduplicate acknowledged inserts');
const sameRemoteNewMutation = {
  ...newerOfflineFixture,
  remoteId: 'server-id',
  clientMutationId: 'new-web-mutation',
};
assert.deepEqual(
  mergeBibleHighlights([remoteFixture], [sameRemoteNewMutation]),
  [sameRemoteNewMutation],
  'A stable remote row id must deduplicate even if another client changed its mutation id',
);
const olderRemoteTombstone = {
  ...remoteFixture,
  deletedAt: '2026-09-10T12:00:00.000Z',
};
assert.deepEqual(
  mergeBibleHighlights([olderRemoteTombstone], [newerOfflineFixture]),
  [olderRemoteTombstone],
  'A server tombstone must win over a newer offline edit',
);
assert.deepEqual(reconcileRemoteBibleHighlights([], [remoteFixture]), [], 'A server deletion must remove the stale synced phone copy');
assert.equal(parseBibleHighlightCreationDate('2026-02-31'), null, 'Impossible creation dates must not silently roll into March');
assert.equal(parseBibleHighlightCreationDate('2028-02-29'), '2028-02-29T12:00:00.000Z');

console.log('Bundled KJV/WEB reader, reference parsing, highlight notes, and guide-link routing passed.');
