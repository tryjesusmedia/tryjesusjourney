export function parseBibleHighlightCreationDate(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return null;
  const date = new Date(`${normalized}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) return null;
  return date.toISOString();
}
