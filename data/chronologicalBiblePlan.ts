import planData from './chronologicalBiblePlan.json';

export type ChronologicalChapterTask = {
  label: string;
  url: string;
  progressIndex: number;
};

export type ChronologicalReading = {
  id: string;
  index: number;
  number: number;
  section: string;
  title: string;
  reference: string;
  sourceNumber: number;
  sourceReference: string;
  partNumber: number;
  partCount: number;
  bibleTasks: ChronologicalChapterTask[];
  reviewNote: string | null;
};

export type ChronologicalSection = {
  id: string;
  number: number;
  title: string;
  readingCount: number;
  readings: ChronologicalReading[];
};

export const chronologicalReadings = planData.readings as ChronologicalReading[];

export const chronologicalBiblePlan: ChronologicalSection[] = planData.sections.map((section) => ({
  ...section,
  readings: chronologicalReadings.filter((reading) => reading.section === section.title),
}));

export const chronologicalPlanMeta = {
  planId: planData.planId,
  notesPlanId: planData.notesPlanId,
  previousPlanId: planData.previousPlanId,
  legacyPlanId: planData.legacyPlanId,
  taskLegacyPlanId: planData.taskLegacyPlanId,
  originalLegacyPlanId: planData.originalLegacyPlanId,
  legacyMigration: planData.legacyMigration as Record<string, number[]>,
  originalChapterMigration: planData.originalChapterMigration as Record<string, number[]>,
  originalReadingMigration: planData.originalReadingMigration as Record<string, { first: number; last: number; resume?: number }>,
  previousChapterMigration: planData.previousChapterMigration as Record<string, number>,
  previousReadingMigration: planData.previousReadingMigration as Record<string, number>,
  taskChapterMigration: planData.taskChapterMigration as Record<string, number[]>,
  taskReadingMigration: planData.taskReadingMigration as Record<string, number>,
  currentTaskChapterMigration: planData.currentTaskChapterMigration as Record<string, number[]>,
  readingCount: planData.readingCount,
  chapterCount: planData.chapterCount,
  sectionCount: planData.sectionCount,
};
