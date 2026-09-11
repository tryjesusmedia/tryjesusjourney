import kjvData from './kjv.json';
import webData from './web.json';
import {
  BIBLE_BOOKS,
  bibleVerseNumbers,
  canonicalBibleText,
  canonicalChapterLabel,
  cleanBibleReference,
  parseBibleReferenceParts,
} from './bibleReferenceCore';

export { BIBLE_BOOKS, canonicalBookName, canonicalChapterLabel } from './bibleReferenceCore';

export type BibleTranslation = 'KJV' | 'WEB';

export type BibleVerse = {
  verse: number;
  text: string;
};

export type BibleVerseRange = BibleVerse & {
  startOffset: number;
  endOffset: number;
  plainText: string;
};

export type BiblePassageSection = {
  chapterLabel: string;
  displayReference: string;
  fullText: string;
  verses: BibleVerseRange[];
};

export const BIBLE_TRANSLATIONS: { id: BibleTranslation; shortLabel: string; label: string }[] = [
  { id: 'KJV', shortLabel: 'KJV', label: 'King James Version' },
  { id: 'WEB', shortLabel: 'WEB', label: 'World English Bible' },
];

const chapterSets: Record<BibleTranslation, Record<string, BibleVerse[]>> = {
  KJV: kjvData as Record<string, BibleVerse[]>,
  WEB: webData as Record<string, BibleVerse[]>,
};

export function getBibleChapter(label: string, translation: BibleTranslation): BibleVerse[] {
  return chapterSets[translation][canonicalChapterLabel(label)] ?? [];
}

export function getBibleChapterText(label: string, translation: BibleTranslation) {
  const verses = getBibleChapter(label, translation);
  let cursor = 0;
  const ranges: BibleVerseRange[] = verses.map((verse, index) => {
    const plainText = verse.text;
    const range = { ...verse, plainText, startOffset: cursor, endOffset: cursor + plainText.length };
    cursor = range.endOffset + (index === verses.length - 1 ? 0 : 1);
    return range;
  });
  return { text: canonicalBibleText(ranges), verses: ranges };
}

export function getBiblePassage(reference: string, translation: BibleTranslation): BiblePassageSection[] {
  const parsed = parseBibleReferenceParts(reference);
  const fallback = parsed.length ? parsed : parseBibleReferenceParts(`${cleanBibleReference(reference)} 1`);
  return fallback.flatMap((part) => {
    const chapterLabel = canonicalChapterLabel(`${part.book} ${part.chapter}`);
    const chapter = getBibleChapterText(chapterLabel, translation);
    if (!chapter.verses.length) return [];
    const included = new Set(bibleVerseNumbers(part.verseSpec, chapter.verses.at(-1)?.verse ?? 0));
    const verses = chapter.verses.filter((verse) => included.has(verse.verse));
    const displayReference = part.verseSpec?.endsWith('-') && verses.length
      ? `${chapterLabel}:${verses[0].verse}-${verses.at(-1)!.verse}`
      : part.displayReference;
    return [{
      chapterLabel,
      displayReference,
      fullText: chapter.text,
      verses,
    }];
  });
}

export function referenceForOffsets(
  chapterLabel: string,
  translation: BibleTranslation,
  startOffset: number,
  endOffset: number,
) {
  const chapter = getBibleChapterText(chapterLabel, translation);
  const touched = chapter.verses.filter((verse) => startOffset < verse.endOffset && endOffset > verse.startOffset);
  const first = touched[0]?.verse;
  const last = touched.at(-1)?.verse;
  if (!first) return canonicalChapterLabel(chapterLabel);
  return `${canonicalChapterLabel(chapterLabel)}:${first}${last && last !== first ? `-${last}` : ''}`;
}

export function canonicalBiblePosition(chapterLabel: string, startOffset = 0) {
  const match = canonicalChapterLabel(chapterLabel).match(/^(.+?)\s+(\d+)$/u);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const book = BIBLE_BOOKS.findIndex((candidate) => candidate === match[1]);
  return (book < 0 ? BIBLE_BOOKS.length : book) * 10_000_000 + Number(match[2]) * 100_000 + startOffset;
}

export function bibleGatewayReference(url: string) {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)biblegateway\.com$/iu.test(parsed.hostname) || !/^\/passage\/?$/iu.test(parsed.pathname)) return null;
    return cleanBibleReference(parsed.searchParams.get('search') ?? '');
  } catch {
    return null;
  }
}
