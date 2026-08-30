import planData from './chronologicalBiblePlan.json';

export type ChronologicalChapterTask = {
  label: string;
  url: string;
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
  legacyPlanId: planData.legacyPlanId,
  legacyMigration: planData.legacyMigration as Record<string, number[]>,
  originalReadingCount: planData.originalReadingCount,
  readingCount: planData.readingCount,
};
