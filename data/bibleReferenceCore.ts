export const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
] as const;

const BOOK_ALIASES: Record<string, string> = {
  psalm: 'Psalms', psalms: 'Psalms', ps: 'Psalms',
  song: 'Song of Solomon', 'song of songs': 'Song of Solomon', 'song of solomon': 'Song of Solomon',
  canticles: 'Song of Solomon',
};

const ONE_CHAPTER_BOOKS = new Set(['Obadiah', 'Philemon', '2 John', '3 John', 'Jude']);

export type ParsedBibleReferencePart = {
  book: string;
  chapter: number;
  verseSpec?: string;
  displayReference: string;
};

export function canonicalBibleText(verses: { text: string }[]) {
  return verses.map((verse) => verse.text).join('\n');
}

export function contiguousVerseGroups<T extends { verse: number }>(verses: T[]) {
  return verses.reduce<T[][]>((groups, verse) => {
    const current = groups.at(-1);
    if (!current || verse.verse !== current.at(-1)!.verse + 1) groups.push([verse]);
    else current.push(verse);
    return groups;
  }, []);
}

export function bibleVerseNumbers(spec: string | undefined, maximum: number) {
  if (!spec) return Array.from({ length: maximum }, (_, index) => index + 1);
  const selected = new Set<number>();
  for (const part of spec.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d*))?$/u);
    if (!match) continue;
    const first = Math.max(1, Number(match[1]));
    const last = Math.min(maximum, match[2] === '' ? maximum : Number(match[2] ?? match[1]));
    for (let verse = Math.min(first, last); verse <= Math.max(first, last); verse += 1) selected.add(verse);
  }
  return [...selected].sort((left, right) => left - right);
}

export function cleanBibleReference(value: string) {
  return value
    .replace(/[–—]/gu, '-')
    .replace(/\u00a0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function canonicalBookName(value: string) {
  const cleaned = cleanBibleReference(value).replace(/\.$/u, '');
  const alias = BOOK_ALIASES[cleaned.toLowerCase()];
  if (alias) return alias;
  const exact = BIBLE_BOOKS.find((book) => book.toLowerCase() === cleaned.toLowerCase());
  return exact ?? cleaned;
}

export function canonicalChapterLabel(label: string) {
  const match = cleanBibleReference(label).match(/^(.+?)\s+(\d+)$/u);
  return match ? `${canonicalBookName(match[1])} ${Number(match[2])}` : cleanBibleReference(label);
}

export function parseBibleReferenceParts(reference: string): ParsedBibleReferencePart[] {
  const normalized = cleanBibleReference(reference)
    .replace(/\s*;\s*/gu, ';')
    .replace(/^((?:read|see|compare)\s+)/iu, '');
  const parts: ParsedBibleReferencePart[] = [];
  let inheritedBook = '';

  for (const rawPart of normalized.split(';').filter(Boolean)) {
    const bookOnly = canonicalBookName(rawPart);
    if (BIBLE_BOOKS.some((book) => book === bookOnly)) {
      inheritedBook = bookOnly;
      parts.push({ book: bookOnly, chapter: 1, displayReference: `${bookOnly} 1` });
      continue;
    }
    const oneChapterVerses = rawPart.match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z ]*?)\s+([\d,\-\s]+)$/u);
    const crossChapter = rawPart.match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d+)\s*:\s*(\d+)\s*-\s*(\d+)\s*:\s*(\d+)$/u);
    const explicit = rawPart.match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d+)(?:\s*:\s*(.+))?$/u);
    const inherited = rawPart.match(/^(\d+)\s*:\s*(.+)$/u);
    const chapterRange = rawPart.match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d+)\s*-\s*(\d+)$/u);

    if (oneChapterVerses) {
      const book = canonicalBookName(oneChapterVerses[1]);
      if (ONE_CHAPTER_BOOKS.has(book)) {
        inheritedBook = book;
        const verseSpec = oneChapterVerses[2].replace(/\s+/gu, ' ').trim();
        parts.push({
          book,
          chapter: 1,
          verseSpec: verseSpec === '1' ? undefined : verseSpec,
          displayReference: `${book} ${verseSpec}`,
        });
        continue;
      }
    }

    if (crossChapter) {
      inheritedBook = canonicalBookName(crossChapter[1]);
      const firstChapter = Number(crossChapter[2]);
      const firstVerse = Number(crossChapter[3]);
      const lastChapter = Number(crossChapter[4]);
      const lastVerse = Number(crossChapter[5]);
      const chapterStart = Math.min(firstChapter, lastChapter);
      const chapterEnd = Math.max(firstChapter, lastChapter);
      for (let chapter = chapterStart; chapter <= chapterEnd; chapter += 1) {
        const verseSpec = chapter === firstChapter
          ? `${firstVerse}-`
          : chapter === lastChapter
            ? `1-${lastVerse}`
            : undefined;
        parts.push({
          book: inheritedBook,
          chapter,
          verseSpec,
          displayReference: `${inheritedBook} ${chapter}${verseSpec ? `:${verseSpec.replace(/-$/u, '-end')}` : ''}`,
        });
      }
      continue;
    }

    if (chapterRange) {
      inheritedBook = canonicalBookName(chapterRange[1]);
      if (ONE_CHAPTER_BOOKS.has(inheritedBook)) {
        const verseSpec = `${Number(chapterRange[2])}-${Number(chapterRange[3])}`;
        parts.push({ book: inheritedBook, chapter: 1, verseSpec, displayReference: `${inheritedBook} ${verseSpec}` });
        continue;
      }
      const first = Number(chapterRange[2]);
      const last = Number(chapterRange[3]);
      for (let chapter = Math.min(first, last); chapter <= Math.max(first, last); chapter += 1) {
        parts.push({ book: inheritedBook, chapter, displayReference: `${inheritedBook} ${chapter}` });
      }
      continue;
    }

    if (explicit) {
      inheritedBook = canonicalBookName(explicit[1]);
      if (ONE_CHAPTER_BOOKS.has(inheritedBook) && !explicit[3]) {
        const verseSpec = String(Number(explicit[2]));
        parts.push({ book: inheritedBook, chapter: 1, verseSpec, displayReference: `${inheritedBook} ${verseSpec}` });
        continue;
      }
      parts.push({
        book: inheritedBook,
        chapter: Number(explicit[2]),
        verseSpec: explicit[3]?.replace(/[^\d,\-\s].*$/u, '').trim(),
        displayReference: `${inheritedBook} ${Number(explicit[2])}${explicit[3] ? `:${explicit[3].trim()}` : ''}`,
      });
      continue;
    }

    if (inherited && inheritedBook) {
      parts.push({
        book: inheritedBook,
        chapter: Number(inherited[1]),
        verseSpec: inherited[2].trim(),
        displayReference: `${inheritedBook} ${Number(inherited[1])}:${inherited[2].trim()}`,
      });
    }
  }
  return parts;
}
