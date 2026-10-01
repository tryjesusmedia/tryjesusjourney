import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bibleGuideSets } from '../data/bibleGuides.ts';

const home = await readFile(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const tabs = await readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const bibleTab = await readFile(new URL('../app/(tabs)/bible.tsx', import.meta.url), 'utf8');
const bibleDecoded = await readFile(new URL('../app/(tabs)/programs.tsx', import.meta.url), 'utf8');
const live = await readFile(new URL('../app/(tabs)/live.tsx', import.meta.url), 'utf8');
const more = await readFile(new URL('../app/(tabs)/more.tsx', import.meta.url), 'utf8');
const links = await readFile(new URL('../constants/links.ts', import.meta.url), 'utf8');
const liveOffer = await readFile(new URL('../components/LiveDiscussionOffer.tsx', import.meta.url), 'utf8');
const youtubeOffer = await readFile(new URL('../components/YouTubeOffer.tsx', import.meta.url), 'utf8');
const youtubeFunction = await readFile(new URL('../supabase/functions/random-youtube-video/index.ts', import.meta.url), 'utf8');
const guideHome = await readFile(new URL('../app/(tabs)/journey.tsx', import.meta.url), 'utf8');
const guideReader = await readFile(new URL('../app/guide-reader.tsx', import.meta.url), 'utf8');
const reminderPicker = await readFile(new URL('../components/ReminderPickerModal.tsx', import.meta.url), 'utf8');

const bibleDecodedUrl = 'https://tryjesusmedia.com/bibledecoded/';
const oldBibleDecodedUrl = 'https://try-jesus-new-york-shop.fourthwall.com/products/bible-decoded-by-pastor-kal-roller';
assert.match(links, /https:\/\/tryjesusmedia\.com\/bibledecoded\//);
assert.doesNotMatch(links, new RegExp(oldBibleDecodedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(home, /<Redirect href="\/\(tabs\)\/bible"/);
assert.match(tabs, /initialRouteName="bible"/);
const visibleTabs = [...tabs.matchAll(/<Tabs.Screen name="([^"]+)" options=\{\{ title:/g)].map((match) => match[1]);
assert.deepEqual(visibleTabs, ['bible', 'programs', 'more']);
assert.match(tabs, /title: 'Chronological Bible'/);
assert.doesNotMatch(tabs, /event.preventDefault|Linking.openURL/);
assert.match(bibleTab, /<ChronologicalBibleContent showBackButton=\{false\} \/>/);
assert.match(bibleDecoded, /Explore Bible Decoded/);
assert.match(bibleDecoded, /Linking.openURL\(BIBLE_DECODED_URL\)/);
assert.doesNotMatch(bibleDecoded, /\$227|\$97|next 100/);
for (const route of ['journey', 'ask', 'live', 'videos', 'journal']) {
  assert.ok(tabs.includes(`name="${route}" options={detailOptions(`));
  assert.ok(more.includes(`router.push('/(tabs)/${route}')`));
}
assert.match(more, /Additional perks/);
assert.match(more, /WHATSAPP_GROUP_URL/);
assert.match(more, /TRY_JESUS_MEDIA_STORE_URL/);
assert.match(more, /Delete sync account and online data/);

for (const screen of [liveOffer, live]) {
  assert.match(screen, /<ReminderPickerModal visible=\{reminderOpen\} onRequestClose=\{\(\) => setReminderOpen\(false\)\} onSelect=\{remind\} \/>/);
}
assert.match(reminderPicker, /<Modal transparent visible=\{visible\} animationType="fade" onRequestClose=\{onRequestClose\}>/);
assert.match(reminderPicker, /style=\{styles\.backdrop\} onPress=\{onRequestClose\}/);
for (const label of ['24 hours before', '1 hour before', '15 minutes before', 'At start time']) {
  assert.ok(reminderPicker.includes(label), `Shared reminder picker must include ${label}`);
}

assert.ok(live.indexOf('NEXT LIVE DISCUSSION') < live.indexOf('FELLOWSHIP BETWEEN LIVE DISCUSSIONS'));
assert.match(live, /Join the Try Jesus Media WhatsApp group/);
assert.match(live, /Linking\.openURL\(WHATSAPP_GROUP_URL\)/);
assert.match(live, /contentContainerStyle=\{styles\.content\}/);
assert.match(more, /Powered by FaithCraft\.Agency/);
assert.match(more, /openLink\('https:\/\/faithcraft\.agency\/'\)/);
assert.match(youtubeOffer, /latest three episodes/i);
assert.match(youtubeOffer, /TRY_JESUS_MEDIA_YOUTUBE_URL/);
assert.match(youtubeOffer, /TRY_JESUS_MEDIA_SECOND_YOUTUBE_URL/);
assert.match(youtubeFunction, /publishedAt/);
assert.match(youtubeFunction, /return rightPublished - leftPublished/);
assert.match(youtubeFunction, /for \(const handle of channelHandles\)[^]*videoSources\.get\(video\.id\) === handle/);
assert.doesNotMatch(youtubeFunction, /Math\.random/);
for (const offer of [youtubeOffer, liveOffer]) {
  assert.match(offer, /setFocused\(true\)/);
  assert.match(offer, /setFocused\(false\)/);
}
assert.match(youtubeOffer, /if \(!focused \|\| videos\.length < 2 \|\| !width\) return/);
assert.match(liveOffer, /if \(!focused\) return/);

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
