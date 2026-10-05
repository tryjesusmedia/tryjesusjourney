import planData from './chronologicalBiblePlan.json';
export type ChronologicalChapterTask = { label: string; url: string; progressIndex: number };
export type GuideBlock = {text: string; style: string};
export type ChronologicalReading = {
  id: string; index: number; number: number; section: string; title: string;
  reference: string; sourceReference: string; bibleTasks: ChronologicalChapterTask[]; guidance: string[];
};
export type ChronologicalSection = {
  id: string; number: number; title: string; readingCount: number;
  introduction: GuideBlock[]; reflection: GuideBlock[]; readings: ChronologicalReading[];
};
export const chronologicalReadings: ChronologicalReading[] = planData.readings;
export const chronologicalBiblePlan: ChronologicalSection[] = planData.sections.map(section=>({
  ...section,readings:chronologicalReadings.filter(r=>r.section===section.title),
}));
export const chronologicalGuide: {title:string;blocks:GuideBlock[];table?:string[][]}[] = planData.guide;
export const chronologicalDocumentMigration = planData.migration;
export const chronologicalPlanMeta = {
  planId:planData.planId,
  source:planData.source,
  notesPlanId:'chronological-bible-order-v3', // Retain historical notes; never reassign them to new readings.
  previousPlanId:'chronological-bible-order-v3',
  taskLegacyPlanId:'chronological-bible-order-v2',
  originalLegacyPlanId:'chronological-bible-order-v1',
  ...planData.migration.legacy,
  readingCount:planData.readingCount,chapterCount:planData.chapterCount,sectionCount:planData.sectionCount,
};
