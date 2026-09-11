export type BibleGuideSetId = 'get-to-know-jesus' | 'bible-prophecy';

export type BibleGuideSet = {
  id: BibleGuideSetId;
  title: string;
  eyebrow: string;
  description: string;
  guideCount: number;
  path: string;
  guides: BibleGuide[];
};

export type BibleGuide = {
  number: number;
  title: string;
};

export const bibleGuideSets: BibleGuideSet[] = [
  {
    id: 'get-to-know-jesus',
    title: 'Get to Know Jesus',
    eyebrow: '10-GUIDE RELATIONSHIP JOURNEY',
    description: 'Explore who God is, what Jesus has done, and what following Him means for your life.',
    guideCount: 10,
    path: 'get-to-know-jesus',
    guides: [
      { number: 1, title: 'If God Is Good, Why Is There So Much Evil?' },
      { number: 2, title: 'The Problem Success Cannot Solve' },
      { number: 3, title: 'The Greatest Scam in History: The Lie That Distorted God’s Character' },
      { number: 4, title: 'The Sanctuary: God’s Blueprint of Salvation' },
      { number: 5, title: 'The Sanctuary Revealed: What Jesus Is Doing Now' },
      { number: 6, title: 'The Day of Atonement: When Mercy Meets Judgment' },
      { number: 7, title: 'What Really Happens When You Die?' },
      { number: 8, title: 'Is Hell Eternal? The Truth About the Consuming Fire' },
      { number: 9, title: 'The 1,000 Years: What Happens After Jesus Returns?' },
      { number: 10, title: 'Wax On, Wax Off: The Secret of True Worship' },
    ],
  },
  {
    id: 'bible-prophecy',
    title: 'Bible Prophecy',
    eyebrow: '9-GUIDE PROPHECY JOURNEY',
    description: 'Examine the Bible’s prophetic evidence, sequence, and meaning one guide at a time.',
    guideCount: 9,
    path: 'bible-prophecy',
    guides: [
      { number: 1, title: 'Can the Bible Really Predict the Future?' },
      { number: 2, title: 'The Prophecy That Pinpointed the Messiah' },
      { number: 3, title: 'The Greatest Scam in History' },
      { number: 4, title: 'Who Is the Antichrist? Follow the Biblical Clues' },
      { number: 5, title: 'The Seal of God vs. the Mark of the Beast' },
      { number: 6, title: 'Does the Bible Predict the Rise of America?' },
      { number: 7, title: 'One Bible. Why So Many Churches?' },
      { number: 8, title: 'How Can You Recognize God’s Church Today?' },
      { number: 9, title: 'Does the Bible Predict a Last-Day Prophet?' },
    ],
  },
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
