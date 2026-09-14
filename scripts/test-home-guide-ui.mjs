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

const bibleDecodedUrl = 'https://try-jesus-new-york-shop.fourthwall.com/products/bible-decoded-by-pastor-kal-roller';
const bibleDecodedBlurb = "What if the Bible contains layers of meaning you've never noticed before? Discover simply study techniques that can help Scripture come alive, reveal powerful connections, and turn ordinary Bible reading into an eye-opening journey of discovery.";
assert.match(links, new RegExp(bibleDecodedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.ok(home.includes(bibleDecodedBlurb), 'Bible Decoded must use the requested blurb');
for (const screen of [home, bibleDecoded]) {
  assert.match(screen, /Discounted from \$97 to \$37 for only the next 100 customers\./);
}
const homeOffers = ['styles.readingCard', 'styles.bibleDecodedCard', 'styles.hero', '<YouTubeOffer />', '<LiveDiscussionOffer />', 'styles.whatsappCard', 'styles.askCard'];
for (let index = 1; index < homeOffers.length; index += 1) {
  assert.ok(home.indexOf(homeOffers[index - 1]) < home.indexOf(homeOffers[index]), `Home offer ${homeOffers[index - 1]} must appear before ${homeOffers[index]}`);
}
assert.doesNotMatch(home, /random-fourthwall-products|Programs & resources selected for you/);

assert.ok(tabs.indexOf('name="home"') < tabs.indexOf('name="bible"'));
assert.ok(tabs.indexOf('name="bible"') < tabs.indexOf('name="programs"'));
assert.ok(tabs.indexOf('name="programs"') < tabs.indexOf('name="journey"'));
assert.ok(tabs.indexOf('name="journey"') < tabs.indexOf('name="more"'));
assert.match(tabs, /name="bible" options=\{\{ title: 'Bible'/);
const bibleTabDeclaration = tabs.slice(tabs.indexOf('name="bible"'), tabs.indexOf('name="programs"'));
assert.doesNotMatch(bibleTabDeclaration, /tabPress/);
assert.match(bibleTab, /<ChronologicalBibleContent showBackButton=\{false\} \/>/);
assert.match(home, /router\.push\('\/\(tabs\)\/bible'\)/);
assert.match(tabs, /name="programs"[^]*title: 'Bible Decoded'[^]*Linking\.openURL\(BIBLE_DECODED_URL\)/);
assert.match(tabs, /name="journey" options=\{\{ title: 'Guides'/);
assert.match(tabs, /name="ask" options=\{\{ href: null \}\}/);
assert.match(tabs, /name="live" options=\{\{ href: null \}\}/);

for (const screen of [liveOffer, live]) {
  assert.match(screen, /<ReminderPickerModal visible=\{reminderOpen\} onRequestClose=\{\(\) => setReminderOpen\(false\)\} onSelect=\{remind\} \/>/);
}
assert.match(reminderPicker, /<Modal transparent visible=\{visible\} animationType="fade" onRequestClose=\{onRequestClose\}>/);
assert.match(reminderPicker, /style=\{styles\.backdrop\} onPress=\{onRequestClose\}/);
for (const label of ['24 hours before', '1 hour before', '15 minutes before', 'At start time']) {
  assert.ok(reminderPicker.includes(label), `Shared reminder picker must include ${label}`);
}
assert.match(home, /Linking\.openURL\(WHATSAPP_GROUP_URL\)/);
assert.ok(live.indexOf('NEXT LIVE DISCUSSION') < live.indexOf('FELLOWSHIP BETWEEN LIVE DISCUSSIONS'));
assert.match(live, /Join the Try Jesus Media WhatsApp group/);
assert.match(live, /Linking\.openURL\(WHATSAPP_GROUP_URL\)/);
assert.match(live, /contentContainerStyle=\{styles\.content\}/);
assert.match(more, /Powered by FaithCraft\.Agency/);
assert.match(more, /Linking\.openURL\('https:\/\/faithcraft\.agency\/'\)/);
const moreOffers = ['<YouTubeOffer />', '<LiveDiscussionOffer />', 'styles.whatsappCard', 'styles.askCard', 'Try Jesus Media Store', 'Questions &amp; Privacy', '>Members<'];
for (let index = 1; index < moreOffers.length; index += 1) {
  assert.ok(more.indexOf(moreOffers[index - 1]) < more.indexOf(moreOffers[index]), `More offer ${moreOffers[index - 1]} must appear before ${moreOffers[index]}`);
}
assert.doesNotMatch(more, /Chron Bible Sync|Disconnect Google|Sign In with Google|Sign Out/);
assert.match(more, /Delete Sync Account and Online Data/);

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
