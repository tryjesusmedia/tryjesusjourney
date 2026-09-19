export type ReadingBadge = {
  id: string;
  day: number;
  book: string;
  label: string;
  title: string;
  reference: string;
  motif: string;
  palette: number;
  style: number;
  detail: number;
};
export const catalog: ReadingBadge[];
export function getBadge(id: string): ReadingBadge | undefined;
export function badgeSvg(badge: ReadingBadge | string): string;
export function badgeDataUri(badge: ReadingBadge | string): string;
