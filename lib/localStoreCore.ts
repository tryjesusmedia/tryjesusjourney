export type GuestProgress = {
  lessonUrl: string;
  progressPercent: number;
  updatedAt: string;
};

export type GuestJournal = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  legacyCloudId?: string;
};

export type GuestChatSource = {
  id?: string | number;
  category?: string;
  topic?: string;
  source_title?: string;
  source_url?: string;
  scripture_refs?: string[] | string;
};

export type GuestAskMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: GuestChatSource[];
  createdAt: string;
  legacyCloudId?: string;
};

export const ASK_HISTORY_LIMIT = 80;

function boundedPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalized(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function guideProgressScore(progress: GuestProgress) {
  const guideNumber = Number(progress.lessonUrl.match(/\/guide(\d+)\/?/i)?.[1] ?? 1);
  return (Math.max(1, Number.isFinite(guideNumber) ? guideNumber : 1) - 1) * 100
    + boundedPercent(progress.progressPercent);
}

export function mergeGuestGuideProgress(current: GuestProgress | null, incoming: GuestProgress) {
  if (!current) return incoming;
  const currentScore = guideProgressScore(current);
  const incomingScore = guideProgressScore(incoming);
  if (incomingScore !== currentScore) return incomingScore > currentScore ? incoming : current;
  return timestamp(incoming.updatedAt) > timestamp(current.updatedAt) ? incoming : current;
}

function journalFingerprint(entry: GuestJournal) {
  return `${normalized(entry.title)}\u0000${normalized(entry.body)}\u0000${entry.createdAt}`;
}

export function mergeGuestJournalEntries(current: GuestJournal[], incoming: GuestJournal[]) {
  const merged: GuestJournal[] = [];
  const ids = new Set<string>();
  const cloudIds = new Set<string>();
  const fingerprints = new Set<string>();

  for (const entry of [...current, ...incoming]) {
    const id = String(entry.id);
    const cloudId = entry.legacyCloudId ? String(entry.legacyCloudId) : '';
    const fingerprint = journalFingerprint(entry);
    if (ids.has(id) || (cloudId && cloudIds.has(cloudId)) || fingerprints.has(fingerprint)) continue;
    ids.add(id);
    if (cloudId) cloudIds.add(cloudId);
    fingerprints.add(fingerprint);
    merged.push(entry);
  }

  return merged.sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt));
}

function askFingerprint(message: GuestAskMessage) {
  return `${message.role}\u0000${normalized(message.text)}\u0000${message.createdAt}`;
}

export function mergeGuestAskMessages(
  current: GuestAskMessage[],
  incoming: GuestAskMessage[],
  limit = ASK_HISTORY_LIMIT,
) {
  const merged: Array<{ message: GuestAskMessage; order: number }> = [];
  const ids = new Set<string>();
  const cloudIds = new Set<string>();
  const fingerprints = new Set<string>();

  for (const [order, message] of [...current, ...incoming].entries()) {
    const id = String(message.id);
    const cloudId = message.legacyCloudId ? String(message.legacyCloudId) : '';
    const fingerprint = askFingerprint(message);
    if (ids.has(id) || (cloudId && cloudIds.has(cloudId)) || fingerprints.has(fingerprint)) continue;
    ids.add(id);
    if (cloudId) cloudIds.add(cloudId);
    fingerprints.add(fingerprint);
    merged.push({ message, order });
  }

  merged.sort((left, right) => timestamp(left.message.createdAt) - timestamp(right.message.createdAt) || left.order - right.order);
  return merged.slice(-Math.max(1, Math.floor(limit))).map(({ message }) => message);
}
