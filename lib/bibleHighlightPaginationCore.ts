export const BIBLE_HIGHLIGHT_PAGE_SIZE = 1000;

export async function fetchAllBibleHighlightPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = BIBLE_HIGHLIGHT_PAGE_SIZE,
) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Bible highlight page size must be a positive integer.');
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
