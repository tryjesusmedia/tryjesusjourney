import type { ChronologicalReading, ChronologicalSection } from '../data/chronologicalBiblePlan';

export type ChronologicalListItem =
  | { kind: 'section'; section: ChronologicalSection }
  | { kind: 'reading'; reading: ChronologicalReading };

export function sectionFolderItems(sections: ChronologicalSection[], sectionId: string | null): ChronologicalListItem[] {
  const section = sections.find(item => item.id === sectionId);
  return section
    ? section.readings.map(reading => ({ kind: 'reading', reading }))
    : sections.map(section => ({ kind: 'section', section }));
}

export function continueReading(readings: ChronologicalReading[], completed: Set<number>, lastIndex: number) {
  const incomplete = (reading: ChronologicalReading) => reading.bibleTasks.some(task => !completed.has(task.progressIndex));
  return readings.find(reading => reading.index >= lastIndex && incomplete(reading))
    ?? readings.find(incomplete)
    ?? readings[0];
}
