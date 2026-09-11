export type ChronologicalProgress = {
  completed: number[];
  lastIndex: number;
  updatedAt: string;
};

export type StoredProgress = {
  completed_indices?: unknown;
  completed?: unknown;
  last_index?: unknown;
  lastIndex?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
};

export type ProgressLimits = {
  chapterCount: number;
  readingCount: number;
};

export type ProgressMigrationMaps = {
  previousChapterMigration: Record<string, number>;
  previousReadingMigration: Record<string, number>;
  taskChapterMigration: Record<string, number[]>;
  taskReadingMigration: Record<string, number>;
  originalChapterMigration: Record<string, number[]>;
  originalReadingMigration: Record<string, { first: number; last: number; resume?: number }>;
};

export const emptyChronologicalProgress = (): ChronologicalProgress => ({ completed: [], lastIndex: 0, updatedAt: '' });

export function rawCompleted(data?: StoredProgress | null) {
  const values = Array.isArray(data?.completed_indices) ? data.completed_indices : Array.isArray(data?.completed) ? data.completed : [];
  return values.map(Number).filter((index) => Number.isInteger(index) && index >= 0);
}

export function rawLastIndex(data?: StoredProgress | null) {
  const value = Number(data?.last_index ?? data?.lastIndex ?? 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function rawUpdatedAt(data?: StoredProgress | null) {
  return String(data?.updated_at ?? data?.updatedAt ?? '');
}

export function normalizeChronologicalProgress(data: StoredProgress | null | undefined, limits: ProgressLimits): ChronologicalProgress {
  const completed = rawCompleted(data).filter((index) => index < limits.chapterCount);
  return {
    completed: Array.from(new Set(completed)).sort((left, right) => left - right),
    lastIndex: Math.max(0, Math.min(rawLastIndex(data), limits.readingCount - 1)),
    updatedAt: rawUpdatedAt(data),
  };
}

export function migratePreviousChronologicalProgress(data: StoredProgress, maps: ProgressMigrationMaps, limits: ProgressLimits) {
  const completed = rawCompleted(data)
    .map((chapterIndex) => maps.previousChapterMigration[String(chapterIndex)])
    .filter((chapterIndex): chapterIndex is number => Number.isInteger(chapterIndex));
  const lastIndex = maps.previousReadingMigration[String(rawLastIndex(data))] ?? 0;
  return normalizeChronologicalProgress({ completed, lastIndex, updatedAt: rawUpdatedAt(data) }, limits);
}

export function migrateTaskChronologicalProgress(data: StoredProgress, maps: ProgressMigrationMaps, limits: ProgressLimits) {
  const completed = rawCompleted(data).flatMap((taskIndex) => maps.taskChapterMigration[String(taskIndex)] ?? []);
  const lastIndex = maps.taskReadingMigration[String(rawLastIndex(data))] ?? 0;
  return normalizeChronologicalProgress({ completed, lastIndex, updatedAt: rawUpdatedAt(data) }, limits);
}

export function migrateOriginalChronologicalProgress(data: StoredProgress, maps: ProgressMigrationMaps, limits: ProgressLimits) {
  const legacyCompleted = new Set(rawCompleted(data));
  const completed = Array.from(legacyCompleted).flatMap((legacyIndex) => maps.originalChapterMigration[String(legacyIndex)] ?? []);
  const oldLastIndex = rawLastIndex(data);
  const lastReading = maps.originalReadingMigration[String(oldLastIndex)] ?? { first: 0, last: 0 };
  const lastIndex = legacyCompleted.has(oldLastIndex) ? (lastReading.resume ?? lastReading.last) : lastReading.first;
  return normalizeChronologicalProgress({ completed, lastIndex, updatedAt: rawUpdatedAt(data) }, limits);
}

export function hasSavedChronologicalProgress(progress: ChronologicalProgress) {
  return Boolean(progress.updatedAt) || progress.completed.length > 0 || progress.lastIndex > 0;
}

export function newerChronologicalProgress(local: ChronologicalProgress, remote: ChronologicalProgress) {
  const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
  return localTime > remoteTime ? local : remote;
}

export function selectAccountChronologicalProgress(
  accountLocal: ChronologicalProgress | null,
  remote: ChronologicalProgress | null,
) {
  if (accountLocal && remote) return newerChronologicalProgress(accountLocal, remote);
  return accountLocal ?? remote;
}

export function guestProgressKey(baseKey: string) {
  return `${baseKey}:guest`;
}

export function accountProgressKey(baseKey: string, userId: string) {
  return `${baseKey}:user:${userId}`;
}

export function shouldLinkGuestProgress(
  accountLocal: ChronologicalProgress | null,
  remote: ChronologicalProgress | null,
  guest: ChronologicalProgress,
  pendingLinkUserId: string | null,
  userId: string,
) {
  const isFirstLink = !pendingLinkUserId && !accountLocal && !remote;
  const isTargetedReconnect = pendingLinkUserId === userId;
  return hasSavedChronologicalProgress(guest) && (isFirstLink || isTargetedReconnect);
}

export function selectAccountChronologicalProgressWithGuest(
  accountLocal: ChronologicalProgress | null,
  remote: ChronologicalProgress | null,
  guest: ChronologicalProgress,
  pendingLinkUserId: string | null,
  userId: string,
) {
  const account = selectAccountChronologicalProgress(accountLocal, remote);
  if (!shouldLinkGuestProgress(accountLocal, remote, guest, pendingLinkUserId, userId)) return account;
  return account ? newerChronologicalProgress(account, guest) : guest;
}
