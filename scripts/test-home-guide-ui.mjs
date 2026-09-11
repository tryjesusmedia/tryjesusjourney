import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bibleGuideSets } from '../data/bibleGuides.ts';

const home = await readFile(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const guideHome = await readFile(new URL('../app/(tabs)/journey.tsx', import.meta.url), 'utf8');
const guideReader = await readFile(new URL('../app/guide-reader.tsx', import.meta.url), 'utf8');

const bibleDecodedUrl = 'https://try-jesus-new-york-shop.fourthwall.com/products/bible-decoded-by-pastor-kal-roller';
const bibleDecodedBlurb = "What if the Bible contains layers of meaning you've never noticed before? Discover simply study techniques that can help Scripture come alive, reveal powerful connections, and turn ordinary Bible reading into an eye-opening journey of discovery.";
assert.match(home, new RegExp(bibleDecodedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.ok(home.includes(bibleDecodedBlurb), 'Bible Decoded must use the requested blurb');
assert.ok(home.indexOf('styles.bibleDecodedCard') < home.indexOf('styles.hero'), 'Bible Decoded must be the first home card');
assert.match(home, /<Modal[^>]*onRequestClose=\{\(\) => setReminderOpen\(false\)\}/);
assert.match(home, /styles\.modalBackdrop[^>]*onPress=\{\(\) => setReminderOpen\(false\)\}/);
assert.ok(home.indexOf('NEXT LIVE DISCUSSION') < home.indexOf('FELLOWSHIP BETWEEN LIVE DISCUSSIONS'));
assert.match(home, /Linking\.openURL\(WHATSAPP_GROUP_URL\)/);

assert.equal(bibleGuideSets.length, 2);
assert.equal(bibleGuideSets.reduce((count, set) => count + set.guides.length, 0), 19);
for (const set of bibleGuideSets) {
  assert.equal(set.guides.length, set.guideCount, `${set.id} guide count must match its list`);
  assert.deepEqual(set.guides.map((guide) => guide.number), Array.from({ length: set.guideCount }, (_, index) => index + 1));
  assert.ok(set.guides.every((guide) => guide.title.trim()), `${set.id} guide titles must be present`);
}

assert.match(guideHome, /title=\{open \? 'Hide Guides' : 'See Guides'\}/);
assert.doesNotMatch(guideHome, /Continue Where I Left Off/);
assert.match(guideHome, /guideSet\.guides\.map/);
assert.match(guideHome, /params: \{ set: guideSet\.id, guide: String\(guide\.number\) \}/);

for (const label of ['Start Over', 'A−', 'A+', 'Return to Bible Guides', 'Previous Lesson', 'Need Help?']) {
  assert.ok(guideReader.includes(label), `Guide reader must include ${label}`);
}
assert.match(guideReader, /\.guide-reader-toolbar/);
assert.match(guideReader, /#listenButton/);
assert.match(guideReader, /\.guide-audio-speed/);
assert.match(guideReader, /document\.querySelector\('\[data-text-size=/);
assert.match(guideReader, /router\.replace\('\/\(tabs\)\/journey'\)/);
assert.doesNotMatch(guideReader, /router\.back\(\)/);

console.log('Home promotion, reminder dismissal, guide lists, and guide-reader controls passed.');
