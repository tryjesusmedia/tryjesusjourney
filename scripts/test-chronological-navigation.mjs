import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sectionFolderItems, continueReading } from '../lib/chronologicalNavigation.ts';
const plan = JSON.parse(fs.readFileSync(new URL('../data/chronologicalBiblePlan.json', import.meta.url)));
const sections = plan.sections.map(section => ({ ...section, readings: plan.readings.filter(reading => reading.section === section.title) }));
const overview = sectionFolderItems(sections, null);
assert.equal(overview.length, 11);
assert(overview.every(item => item.kind === 'section'));
for (const section of sections) {
  const folder = sectionFolderItems(sections, section.id);
  assert.equal(folder.length, section.readings.length);
  assert(folder.every(item => item.kind === 'reading' && item.reading.section === section.title));
  assert.deepEqual(folder.map(item => item.reading.id), section.readings.map(item => item.id));
}
assert.deepEqual(sectionFolderItems(sections, 'missing'), overview);
const readings = plan.readings;
const completed = new Set(readings[20].bibleTasks.map(task => task.progressIndex));
assert.equal(continueReading(readings, completed, 20).id, readings[21].id);
assert.equal(continueReading(readings, new Set(), 20).id, readings[20].id);
const all = new Set(readings.flatMap(reading => reading.bibleTasks.map(task => task.progressIndex)));
assert.equal(continueReading(readings, all, 312).id, readings[0].id);
all.delete(readings[3].bibleTasks[0].progressIndex);
assert.equal(continueReading(readings, all, 312).id, readings[3].id);
assert.equal(completed.size, readings[20].bibleTasks.length, 'Navigation never changes completion data');
console.log('Section isolation, overview/back destination, reading order, resume and completion preservation passed.');
