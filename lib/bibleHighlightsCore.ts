import { canonicalBiblePosition, canonicalChapterLabel, type BibleTranslation } from '@/data/bible';
import { chronologicalReadings } from '@/data/chronologicalBiblePlan';

export const HIGHLIGHT_COLORS = ['yellow', 'orange', 'red', 'green', 'cyan', 'purple'] as const;
export type HighlightColor = typeof HIGHLIGHT_COLORS[number];
export type HighlightSort = 'color' | 'canonical' | 'chronological' | 'created';

export const HIGHLIGHT_COLOR_HEX: Record<HighlightColor, string> = {
  yellow: '#FFE66D',
  orange: '#FFAD66',
  red: '#FF7C7C',
  green: '#8FE388',
  cyan: '#7FE7F2',
  purple: '#C5A3FF',
};

export type BibleHighlight = {
  id: string;
  planId: string;
  readingId: string;
  chapterLabel: string;
  reference: string;
  translation: BibleTranslation;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  color: HighlightColor;
  note: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  clientMutationId?: string;
  ownerUserId?: string;
  remoteId?: string;
  deletedAt?: string;
};

const chronologicalChapterOrder = (() => {
  const order = new Map<string, number>();
  chronologicalReadings.forEach((reading) => reading.bibleTasks.forEach((task) => {
    const key = canonicalChapterLabel(task.label);
    order.set(key, Math.min(order.get(key) ?? Number.MAX_SAFE_INTEGER, task.progressIndex));
  }));
  return order;
})();

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === 'string' && HIGHLIGHT_COLORS.includes(value as HighlightColor);
}

export function normalizeBibleHighlight(highlight: BibleHighlight): BibleHighlight | null {
  const startOffset = Math.max(0, Math.floor(Number(highlight.startOffset)));
  const endOffset = Math.max(startOffset, Math.floor(Number(highlight.endOffset)));
  const translation = highlight.translation === 'WEB' ? 'WEB' : 'KJV';
  const selectedText = String(highlight.selectedText ?? '').trim();
  if (!highlight.id || !highlight.planId || !highlight.readingId || !highlight.chapterLabel || !selectedText || endOffset <= startOffset) return null;
  return {
    ...highlight,
    readingId: String(highlight.readingId),
    chapterLabel: canonicalChapterLabel(highlight.chapterLabel),
    reference: String(highlight.reference || highlight.chapterLabel),
    translation,
    startOffset,
    endOffset,
    selectedText,
    color: isHighlightColor(highlight.color) ? highlight.color : 'yellow',
    note: String(highlight.note ?? ''),
    createdAt: new Date(highlight.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(highlight.updatedAt || Date.now()).toISOString(),
    synced: Boolean(highlight.synced),
  };
}

export function chronologicalBiblePosition(chapterLabel: string, startOffset = 0) {
  const planIndex = chronologicalChapterOrder.get(canonicalChapterLabel(chapterLabel));
  if (planIndex == null) return 1_000_000_000 + canonicalBiblePosition(chapterLabel, startOffset);
  return planIndex * 100_000 + startOffset;
}

export function sortBibleHighlights(highlights: BibleHighlight[], sort: HighlightSort) {
  const colorIndex = new Map(HIGHLIGHT_COLORS.map((color, index) => [color, index]));
  return [...highlights].sort((left, right) => {
    let comparison = 0;
    if (sort === 'color') comparison = (colorIndex.get(left.color) ?? 0) - (colorIndex.get(right.color) ?? 0);
    if (sort === 'canonical') comparison = canonicalBiblePosition(left.chapterLabel, left.startOffset) - canonicalBiblePosition(right.chapterLabel, right.startOffset);
    if (sort === 'chronological') comparison = chronologicalBiblePosition(left.chapterLabel, left.startOffset) - chronologicalBiblePosition(right.chapterLabel, right.startOffset);
    if (sort === 'created') comparison = timestamp(right.createdAt) - timestamp(left.createdAt);
    return comparison
      || canonicalBiblePosition(left.chapterLabel, left.startOffset) - canonicalBiblePosition(right.chapterLabel, right.startOffset)
      || timestamp(right.createdAt) - timestamp(left.createdAt)
      || left.id.localeCompare(right.id);
  });
}
