import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBibleReferenceParts,bibleVerseNumbers,canonicalChapterLabel} from '../data/bibleReferenceCore.ts';
import {migrateDocumentChronologicalProgress} from '../lib/chronologicalProgressCore.ts';
const plan=JSON.parse(readFileSync(new URL('../data/chronologicalBiblePlan.json',import.meta.url)));
const kjv=JSON.parse(readFileSync(new URL('../data/kjv.json',import.meta.url)));
assert.equal(plan.planId,'chronological-bible-doc-v5');assert.equal(plan.readings.length,313);assert.equal(plan.sections.length,11);
assert.equal(plan.source.documentId,'11JsQNJrr6Q4_seXuJbVr2zzXyA5esrp3ud5ixP9AbOw');
const verses=[];const indices=[];
for(const [i,r] of plan.readings.entries()) {
 assert.equal(r.index,i);assert.equal(r.number,i+1);assert.ok(r.title&&r.title!==r.reference);assert.ok(r.guidance.length>=4);
 for(const t of r.bibleTasks) {
  indices.push(t.progressIndex);
  assert.equal(new URL(t.url).searchParams.get('search'),t.label);
  const parts=parseBibleReferenceParts(t.label);assert.ok(parts.length,t.label);
  for(const p of parts) {
   const label=canonicalChapterLabel(`${p.book} ${p.chapter}`),chapter=kjv[label];assert.ok(chapter,t.label);
   const selected=bibleVerseNumbers(p.verseSpec,chapter.at(-1).verse);assert.ok(selected.length,t.label);
   for(const v of selected){assert.ok(chapter.some(x=>x.verse===v),t.label);verses.push(`${label}:${v}`);}
  }
 }
}
assert.deepEqual(indices,Array.from({length:1440},(_,i)=>i));
assert.equal(verses.length,31102);assert.equal(new Set(verses).size,31102);
assert.equal(new Set(verses.map(v=>v.split(':')[0])).size,1189);
const oldJohn=934;
const migrated=migrateDocumentChronologicalProgress({completed:[oldJohn],lastIndex:216},plan.migration);
const john=plan.readings.flatMap(r=>r.bibleTasks).filter(t=>t.label.startsWith('John 1:'));
assert.ok(migrated.completed.includes(john.find(t=>t.label==='John 1:1-14').progressIndex));
assert.ok(!migrated.completed.includes(john.find(t=>t.label==='John 1:15-51').progressIndex));
assert.deepEqual(migrateDocumentChronologicalProgress({completed:[]},plan.migration).completed,[]);
console.log('Document plan: all 313 readings, 1,440 exact native-reader passages, 31,102 unique verses, and conservative migration passed.');
