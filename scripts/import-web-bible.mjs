import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BOOKS = {
  GEN: 'Genesis', EXO: 'Exodus', LEV: 'Leviticus', NUM: 'Numbers', DEU: 'Deuteronomy',
  JOS: 'Joshua', JDG: 'Judges', RUT: 'Ruth', '1SA': '1 Samuel', '2SA': '2 Samuel',
  '1KI': '1 Kings', '2KI': '2 Kings', '1CH': '1 Chronicles', '2CH': '2 Chronicles',
  EZR: 'Ezra', NEH: 'Nehemiah', EST: 'Esther', JOB: 'Job', PSA: 'Psalms',
  PRO: 'Proverbs', ECC: 'Ecclesiastes', SOL: 'Song of Solomon', ISA: 'Isaiah',
  JER: 'Jeremiah', LAM: 'Lamentations', EZE: 'Ezekiel', DAN: 'Daniel', HOS: 'Hosea',
  JOE: 'Joel', AMO: 'Amos', OBA: 'Obadiah', JON: 'Jonah', MIC: 'Micah', NAH: 'Nahum',
  HAB: 'Habakkuk', ZEP: 'Zephaniah', HAG: 'Haggai', ZEC: 'Zechariah', MAL: 'Malachi',
  MAT: 'Matthew', MAR: 'Mark', LUK: 'Luke', JOH: 'John', ACT: 'Acts', ROM: 'Romans',
  '1CO': '1 Corinthians', '2CO': '2 Corinthians', GAL: 'Galatians', EPH: 'Ephesians',
  PHI: 'Philippians', COL: 'Colossians', '1TH': '1 Thessalonians', '2TH': '2 Thessalonians',
  '1TI': '1 Timothy', '2TI': '2 Timothy', TIT: 'Titus', PHM: 'Philemon', HEB: 'Hebrews',
  JAM: 'James', '1PE': '1 Peter', '2PE': '2 Peter', '1JO': '1 John', '2JO': '2 John',
  '3JO': '3 John', JUD: 'Jude', REV: 'Revelation',
};

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? 'data/web.json';
const expectedVerseCount = Number(process.argv[4] ?? 31103);

if (!sourcePath) {
  throw new Error('Usage: node scripts/import-web-bible.mjs <vpl.txt> [output.json] [expected-verse-count]');
}

const source = await readFile(resolve(sourcePath), 'utf8');
const chapters = {};
let verseCount = 0;

for (const [index, rawLine] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
  if (!rawLine) continue;
  const match = rawLine.match(/^([123]?[A-Z]+)\s+(\d+):(\d+)\s?(.*)$/u);
  if (!match) throw new Error(`Unrecognized VPL row ${index + 1}: ${rawLine.slice(0, 80)}`);
  const [, code, chapterText, verseText, text] = match;
  const book = BOOKS[code];
  if (!book) throw new Error(`Unknown book code ${code} on row ${index + 1}`);
  const key = `${book} ${Number(chapterText)}`;
  (chapters[key] ??= []).push({ verse: Number(verseText), text });
  verseCount += 1;
}

if (Object.keys(chapters).length !== 1189 || verseCount !== expectedVerseCount) {
  throw new Error(`Unexpected Bible corpus size: ${Object.keys(chapters).length} chapters, ${verseCount} verses`);
}

await writeFile(resolve(outputPath), JSON.stringify(chapters));
console.log(`Wrote ${verseCount} verses in ${Object.keys(chapters).length} chapters to ${outputPath}`);
