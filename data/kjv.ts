import kjvData from './kjv.json';

export type KjvVerse = {
  verse: number;
  text: string;
};

const chapters = kjvData as Record<string, KjvVerse[]>;

function canonicalChapterLabel(label: string) {
  return label.replace(/^Psalm\s+/i, 'Psalms ');
}

export function getKjvChapter(label: string): KjvVerse[] {
  return chapters[canonicalChapterLabel(label)] ?? [];
}
