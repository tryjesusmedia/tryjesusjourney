export type BibleGuideSetId = 'get-to-know-jesus' | 'bible-prophecy';

export type BibleGuideSet = {
  id: BibleGuideSetId;
  title: string;
  eyebrow: string;
  description: string;
  guideCount: number;
  path: string;
};

export const bibleGuideSets: BibleGuideSet[] = [
  { id: 'get-to-know-jesus', title: 'Get to Know Jesus', eyebrow: '10-GUIDE RELATIONSHIP JOURNEY', description: 'Explore who God is, what Jesus has done, and what following Him means for your life.', guideCount: 10, path: 'get-to-know-jesus' },
  { id: 'bible-prophecy', title: 'Bible Prophecy', eyebrow: '9-GUIDE PROPHECY JOURNEY', description: 'Examine the Bible’s prophetic evidence, sequence, and meaning one guide at a time.', guideCount: 9, path: 'bible-prophecy' },
];

export function getBibleGuideSet(id: string | undefined) {
  return bibleGuideSets.find((guideSet) => guideSet.id === id) ?? bibleGuideSets[0];
}

export function guideUrl(guideSet: BibleGuideSet, guideNumber = 1) {
  const boundedGuide = Math.max(1, Math.min(guideNumber, guideSet.guideCount));
  return `https://tryjesusmedia.com/${guideSet.path}/guide${boundedGuide}/`;
}

export function guideNumberFromUrl(guideSet: BibleGuideSet, url?: string | null) {
  const match = url?.match(new RegExp(`/${guideSet.path}/guide(\\d+)/?`, 'i'));
  return Math.max(1, Math.min(Number(match?.[1] ?? 1), guideSet.guideCount));
}

export function guideSetProgress(guideSet: BibleGuideSet, lessonUrl?: string | null, pagePercent = 0) {
  if (!lessonUrl) return 0;
  const guideNumber = guideNumberFromUrl(guideSet, lessonUrl);
  const boundedPagePercent = Math.max(0, Math.min(100, pagePercent));
  return Math.round((((guideNumber - 1) + boundedPagePercent / 100) / guideSet.guideCount) * 100);
}
