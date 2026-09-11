import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const journal = await readFile(new URL('../app/(tabs)/journal.tsx', import.meta.url), 'utf8');
const ask = await readFile(new URL('../app/(tabs)/ask.tsx', import.meta.url), 'utf8');
const chronological = await readFile(new URL('../app/chronological.tsx', import.meta.url), 'utf8');

assert.match(journal, /updateGuestJournalEntry\(editingEntry\.id, changes\)/);
assert.match(journal, /title=\{editingEntry \? 'Save Changes' : 'Save to My Prayer Journal'\}/);
assert.match(journal, /<KeyboardAvoidingView/);
assert.match(journal, /keyboardShouldPersistTaps="handled"/);
assert.doesNotMatch(journal, /maxLength=/, 'Editing must not silently truncate a previously saved prayer');

const normalizeStyleSource = (source) => source.replace(/\s+/g, '').replace(/:0\./g, ':.');
const compactAsk = normalizeStyleSource(ask);
const compactChronological = normalizeStyleSource(chronological);
for (const fragment of [
  "backgroundColor:colors.gold,borderRadius:18,padding:3,shadowColor:'#000',shadowOpacity:.24,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:5",
  "minHeight:50,flexDirection:'row',alignItems:'center',borderRadius:15,backgroundColor:'#FFF7E6',paddingHorizontal:12",
]) {
  assert.ok(compactAsk.includes(fragment), `Ask composer is missing Chron search styling: ${fragment}`);
  assert.ok(compactChronological.includes(fragment), `Chron search styling changed: ${fragment}`);
}
assert.match(compactAsk, /input:\{[^}]*flex:1[^}]*minHeight:50[^}]*paddingVertical:10[^}]*color:'#241C22'[^}]*fontSize:16[^}]*fontWeight:'700'/);
assert.match(compactChronological, /search:\{[^}]*flex:1[^}]*minHeight:50[^}]*paddingVertical:10[^}]*color:'#241C22'[^}]*fontSize:16[^}]*fontWeight:'700'/);
assert.match(ask, /accessibilityElementsHidden importantForAccessibility="no"/);

console.log('Prayer editing and Ask/Chron search-bar parity checks passed.');
