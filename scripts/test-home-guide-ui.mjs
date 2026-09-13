import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bibleGuideSets } from '../data/bibleGuides.ts';

const home = await readFile(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const live = await readFile(new URL('../app/(tabs)/live.tsx', import.meta.url), 'utf8');
const more = await readFile(new URL('../app/(tabs)/more.tsx', import.meta.url), 'utf8');
const guideHome = await readFile(new URL('../app/(tabs)/journey.tsx', import.meta.url), 'utf8');
const guideReader = await readFile(new URL('../app/guide-reader.tsx', import.meta.url), 'utf8');
const reminderPicker = await readFile(new URL('../components/ReminderPickerModal.tsx', import.meta.url), 'utf8');

const bibleDecodedUrl = 'https://try-jesus-new-york-shop.fourthwall.com/products/bible-decoded-by-pastor-kal-roller';
const bibleDecodedBlurb = "What if the Bible contains layers of meaning you've never noticed before? Discover simply study techniques that can help Scripture come alive, reveal powerful connections, and turn ordinary Bible reading into an eye-opening journey of discovery.";
assert.match(home, new RegExp(bibleDecodedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.ok(home.includes(bibleDecodedBlurb), 'Bible Decoded must use the requested blurb');
assert.ok(home.indexOf('styles.bibleDecodedCard') < home.indexOf('styles.hero'), 'Bible Decoded must be the first home card');
for (const screen of [home, live]) {
  assert.match(screen, /<ReminderPickerModal visible=\{reminderOpen\} onRequestClose=\{\(\) => setReminderOpen\(false\)\} onSelect=\{remind\} \/>/);
}
assert.match(reminderPicker, /<Modal transparent visible=\{visible\} animationType="fade" onRequestClose=\{onRequestClose\}>/);
assert.match(reminderPicker, /style=\{styles\.backdrop\} onPress=\{onRequestClose\}/);
for (const label of ['24 hours before', '1 hour before', '15 minutes before', 'At start time']) {
  assert.ok(reminderPicker.includes(label), `Shared reminder picker must include ${label}`);
}
assert.ok(home.indexOf('NEXT LIVE DISCUSSION') < home.indexOf('FELLOWSHIP BETWEEN LIVE DISCUSSIONS'));
assert.match(home, /Linking\.openURL\(WHATSAPP_GROUP_URL\)/);
assert.ok(live.indexOf('NEXT LIVE DISCUSSION') < live.indexOf('FELLOWSHIP BETWEEN LIVE DISCUSSIONS'));
assert.match(live, /Join the Try Jesus Media WhatsApp group/);
assert.match(live, /Linking\.openURL\(WHATSAPP_GROUP_URL\)/);
assert.match(live, /contentContainerStyle=\{styles\.content\}/);
assert.match(more, /Powered by FaithCraft\.Agency/);
assert.match(more, /Linking\.openURL\('https:\/\/faithcraft\.agency\/'\)/);

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

for (const label of ['Start Over', 'A−', 'A+', 'Return to Bible Guides']) {
  assert.ok(guideReader.includes(label), `Guide reader must include ${label}`);
}
for (const removedLabel of ['Previous Lesson', 'Previous Guide', 'Need Help?']) {
  assert.ok(!guideReader.includes(`>${removedLabel}<`), `Guide reader menu must not include ${removedLabel}`);
}
assert.match(guideReader, /\.guide-reader-toolbar/);
assert.match(guideReader, /#listenButton/);
assert.match(guideReader, /\.guide-audio-speed/);
assert.match(guideReader, /footer,\.site-footer\{display:none!important\}/);
assert.match(guideReader, /querySelectorAll\?\.\('footer,\.site-footer'\)/);
assert.match(guideReader, /new MutationObserver\(\(mutations\) =>/);
assert.match(guideReader, /document\.querySelector\('\[data-text-size=/);
assert.match(guideReader, /router\.replace\('\/\(tabs\)\/journey'\)/);
assert.doesNotMatch(guideReader, /router\.back\(\)/);

console.log('Home promotion, reminder dismissal, guide lists, and guide-reader controls passed.');
