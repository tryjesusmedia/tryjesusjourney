import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const guideReader = await readFile(new URL('../app/guide-reader.tsx', import.meta.url), 'utf8');

for (const label of ['Start Over', 'A−', 'A+', 'Return to Bible Guides']) {
  assert.ok(guideReader.includes(label), `Guide reader must include ${label}`);
}

for (const removedLabel of ['Previous Lesson', 'Previous Guide', 'Need Help?']) {
  assert.ok(!guideReader.includes(`>${removedLabel}<`), `Guide reader menu must not include ${removedLabel}`);
}

assert.match(guideReader, /footer,\.site-footer\{display:none!important\}/);
assert.match(guideReader, /matches\('footer,\.site-footer'\)/);
assert.match(guideReader, /querySelectorAll\?\.\('footer,\.site-footer'\)/);
assert.match(guideReader, /new MutationObserver\(\(mutations\) =>/);
assert.match(guideReader, /router\.replace\('\/\(tabs\)\/journey'\)/);
assert.doesNotMatch(guideReader, /router\.back\(\)/);

console.log('Native guide menu and embedded-footer cleanup passed.');
