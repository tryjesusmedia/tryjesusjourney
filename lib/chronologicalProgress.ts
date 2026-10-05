import AsyncStorage from '@react-native-async-storage/async-storage';
import { chronologicalPlanMeta, chronologicalDocumentMigration } from '@/data/chronologicalBiblePlan';
import { supabase } from '@/lib/supabase';
import {
  accountProgressKey,
  emptyChronologicalProgress,
  guestProgressKey,
  hasSavedChronologicalProgress,
  migrateOriginalChronologicalProgress,
  migrateDocumentChronologicalProgress,
  migratePreviousChronologicalProgress,
  migrateTaskChronologicalProgress,
  normalizeChronologicalProgress,
  selectAccountChronologicalProgress,
  selectAccountChronologicalProgressWithGuest,
  shouldLinkGuestProgress,
  type ChronologicalProgress,
  type ProgressMigrationMaps,
  type StoredProgress,
} from '@/lib/chronologicalProgressCore';

export type { ChronologicalProgress } from '@/lib/chronologicalProgressCore';

export const CHRONOLOGICAL_PLAN_ID = chronologicalPlanMeta.planId;
export const CHRONOLOGICAL_NOTES_PLAN_ID = chronologicalPlanMeta.notesPlanId;

function localKeyForPlan(planId: string) {
  const version = planId.match(/-v(\d+)$/)?.[1];
  return version ? `tryjesus_chronological_plan_progress_v${version}` : `tryjesus_chronological_plan_progress_${planId}`;
}

const UNSCOPED_LOCAL_KEY = localKeyForPlan(CHRONOLOGICAL_PLAN_ID);
const GUEST_LOCAL_KEY = guestProgressKey(UNSCOPED_LOCAL_KEY);
const GUEST_MIGRATION_MARKER_KEY = `${GUEST_LOCAL_KEY}:legacy-imported`;
const GUEST_LINK_TARGET_KEY = `${GUEST_LOCAL_KEY}:link-target`;
const V4_LOCAL_KEY = localKeyForPlan('chronological-bible-order-v4');
const PREVIOUS_LOCAL_KEY = localKeyForPlan(chronologicalPlanMeta.previousPlanId);
const TASK_LEGACY_LOCAL_KEY = localKeyForPlan(chronologicalPlanMeta.taskLegacyPlanId);
const ORIGINAL_LOCAL_KEY = 'tryjesus_chronological_plan_progress';

const limits = {
  chapterCount: chronologicalPlanMeta.chapterCount,
  readingCount: chronologicalPlanMeta.readingCount,
};

const migrationMaps: ProgressMigrationMaps = {
  previousChapterMigration: chronologicalPlanMeta.previousChapterMigration,
  previousReadingMigration: chronologicalPlanMeta.previousReadingMigration,
  taskChapterMigration: chronologicalPlanMeta.taskChapterMigration,
  taskReadingMigration: chronologicalPlanMeta.taskReadingMigration,
  originalChapterMigration: chronologicalPlanMeta.originalChapterMigration,
  originalReadingMigration: chronologicalPlanMeta.originalReadingMigration,
};

function migrateDocumentProgress(data: StoredProgress) {
  return migrateDocumentChronologicalProgress(data, chronologicalDocumentMigration);
}

function normalize(data?: StoredProgress | null): ChronologicalProgress {
  return normalizeChronologicalProgress(data, limits);
}

function migratePreviousProgress(data: StoredProgress): ChronologicalProgress {
  return migrateDocumentProgress(migratePreviousChronologicalProgress(data, migrationMaps, {chapterCount:1205,readingCount:313}));
}

function migrateTaskProgress(data: StoredProgress): ChronologicalProgress {
  return migrateDocumentProgress(migrateTaskChronologicalProgress(data, migrationMaps, {chapterCount:1205,readingCount:313}));
}

function migrateOriginalProgress(data: StoredProgress): ChronologicalProgress {
  return migrateDocumentProgress(migrateOriginalChronologicalProgress(data, migrationMaps, {chapterCount:1205,readingCount:313}));
}

async function readStoredProgress(key: string): Promise<StoredProgress | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) as StoredProgress : null;
}

async function readGuestProgress(): Promise<ChronologicalProgress> {
  const current = await readStoredProgress(GUEST_LOCAL_KEY);
  if (current) return normalize(current);

  const migrationFinished = await AsyncStorage.getItem(GUEST_MIGRATION_MARKER_KEY);
  if (migrationFinished) return emptyChronologicalProgress();

  const v4Guest = await readStoredProgress(guestProgressKey(V4_LOCAL_KEY));
  const v4Imported = await AsyncStorage.getItem(`${guestProgressKey(V4_LOCAL_KEY)}:legacy-imported`);
  const unscoped = v4Guest || v4Imported ? null : await readStoredProgress(V4_LOCAL_KEY);
  const previous = v4Guest || v4Imported || unscoped ? null : await readStoredProgress(PREVIOUS_LOCAL_KEY);
  const taskLegacy = v4Guest || v4Imported || unscoped || previous ? null : await readStoredProgress(TASK_LEGACY_LOCAL_KEY);
  const original = v4Guest || v4Imported || unscoped || previous || taskLegacy ? null : await readStoredProgress(ORIGINAL_LOCAL_KEY);
  const migrated = v4Guest ? migrateDocumentProgress(v4Guest)
    : unscoped ? migrateDocumentProgress(unscoped)
    : previous ? migratePreviousProgress(previous)
    : taskLegacy ? migrateTaskProgress(taskLegacy)
    : original ? migrateOriginalProgress(original) : emptyChronologicalProgress();
  const detachedTarget = await AsyncStorage.getItem(`${guestProgressKey(V4_LOCAL_KEY)}:link-target`);
  if (v4Guest && detachedTarget) await AsyncStorage.setItem(GUEST_LINK_TARGET_KEY,detachedTarget);

  await AsyncStorage.multiSet([
    [GUEST_LOCAL_KEY, JSON.stringify(migrated)],
    [GUEST_MIGRATION_MARKER_KEY, '1'],
  ]);
  return migrated;
}

async function writeGuestProgress(progress: ChronologicalProgress) {
  await AsyncStorage.setItem(GUEST_LOCAL_KEY, JSON.stringify(progress));
}

async function readAccountProgress(userId: string): Promise<ChronologicalProgress | null> {
  const stored = await readStoredProgress(accountProgressKey(UNSCOPED_LOCAL_KEY, userId));
  return stored ? normalize(stored) : null;
}

async function readLegacyAccountProgress(userId: string): Promise<ChronologicalProgress | null> {
  const old = await readStoredProgress(accountProgressKey(V4_LOCAL_KEY,userId));
  return old ? migrateDocumentProgress(old) : null;
}

async function writeAccountProgress(progress: ChronologicalProgress, userId: string) {
  await AsyncStorage.setItem(accountProgressKey(UNSCOPED_LOCAL_KEY, userId), JSON.stringify(progress));
}

async function finishGuestLink(userId: string) {
  const targetUserId = await AsyncStorage.getItem(GUEST_LINK_TARGET_KEY);
  if (targetUserId !== userId) return;
  await AsyncStorage.multiSet([
    [GUEST_LOCAL_KEY, JSON.stringify(emptyChronologicalProgress())],
    [GUEST_MIGRATION_MARKER_KEY, '1'],
  ]);
  await AsyncStorage.removeItem(GUEST_LINK_TARGET_KEY);
}

export async function loadLocalChronologicalProgress(userId?: string): Promise<ChronologicalProgress> {
  if (!userId) return readGuestProgress();
  await readGuestProgress(); // Import the previous guest's account-link marker before reading it.
  const [accountLocal, pendingLinkUserId] = await Promise.all([
    readAccountProgress(userId),
    AsyncStorage.getItem(GUEST_LINK_TARGET_KEY),
  ]);
  if (pendingLinkUserId !== userId) return accountLocal ?? await readLegacyAccountProgress(userId) ?? emptyChronologicalProgress();
  const guest = await readGuestProgress();
  return selectAccountChronologicalProgressWithGuest(accountLocal, null, guest, pendingLinkUserId, userId)
    ?? emptyChronologicalProgress();
}

async function loadRemoteProgress(userId: string): Promise<ChronologicalProgress | null> {
  const current = await supabase
    .from('reading_plan_progress')
    .select('completed_indices,last_index,updated_at')
    .eq('user_id', userId)
    .eq('plan_id', CHRONOLOGICAL_PLAN_ID)
    .maybeSingle();
  if (current.error) throw current.error;
  if (current.data) return normalize(current.data);

  const accountLegacy = await readLegacyAccountProgress(userId);
  for (const [id,migrate] of [
    ['chronological-bible-order-v4',migrateDocumentProgress],
    [chronologicalPlanMeta.previousPlanId,migratePreviousProgress],
    [chronologicalPlanMeta.taskLegacyPlanId,migrateTaskProgress],
    [chronologicalPlanMeta.originalLegacyPlanId,migrateOriginalProgress],
  ] as const) {
    const old = await supabase.from('reading_plan_progress').select('completed_indices,last_index,updated_at').eq('user_id',userId).eq('plan_id',id).maybeSingle();
    if (old.error) throw old.error;
    if (old.data) return selectAccountChronologicalProgress(accountLegacy,migrate(old.data));
  }
  return accountLegacy;
}

export async function loadChronologicalProgress(userId?: string): Promise<ChronologicalProgress> {
  if (!userId) return readGuestProgress();

  await readGuestProgress();
  const accountLocal = await readAccountProgress(userId);
  const remote = await loadRemoteProgress(userId);
  const pendingLinkUserId = await AsyncStorage.getItem(GUEST_LINK_TARGET_KEY);
  if (pendingLinkUserId === userId || (!pendingLinkUserId && !accountLocal && !remote)) {
    const guest = await readGuestProgress();
    if (shouldLinkGuestProgress(accountLocal, remote, guest, pendingLinkUserId, userId)) {
      if (!pendingLinkUserId) await AsyncStorage.setItem(GUEST_LINK_TARGET_KEY, userId);
      const linked = selectAccountChronologicalProgressWithGuest(
        accountLocal,
        remote,
        guest,
        pendingLinkUserId,
        userId,
      ) ?? guest;
      const saved = await saveChronologicalProgress(linked, userId);
      await finishGuestLink(userId);
      return saved;
    }
  }

  // The newest complete snapshot wins. Merging the arrays would make an
  // intentionally unchecked chapter reappear the next time another device syncs.
  const newest = selectAccountChronologicalProgress(accountLocal, remote) ?? emptyChronologicalProgress();
  const merged: ChronologicalProgress = { ...newest, updatedAt: new Date().toISOString() };
  const saved = await saveChronologicalProgress(merged, userId);
  await finishGuestLink(userId);
  return saved;
}

export async function saveChronologicalProgress(progress: Omit<ChronologicalProgress, 'updatedAt'> | ChronologicalProgress, userId?: string) {
  const normalized = normalize({
    completed: progress.completed,
    lastIndex: progress.lastIndex,
    updatedAt: new Date().toISOString(),
  });
  if (userId) {
    await writeAccountProgress(normalized, userId);
  } else {
    await writeGuestProgress(normalized);
    const detachedUserId = await AsyncStorage.getItem(GUEST_LINK_TARGET_KEY);
    if (detachedUserId) await writeAccountProgress(normalized, detachedUserId);
  }

  if (userId) {
    const { error } = await supabase.from('reading_plan_progress').upsert({
      user_id: userId,
      plan_id: CHRONOLOGICAL_PLAN_ID,
      completed_indices: normalized.completed,
      last_index: normalized.lastIndex,
      updated_at: normalized.updatedAt,
    }, { onConflict: 'user_id,plan_id' });
    if (error) throw error;
  }
  return normalized;
}

export async function exportChronologicalProgressToGuest(userId: string) {
  const progress = await readAccountProgress(userId) ?? emptyChronologicalProgress();
  await AsyncStorage.multiSet([
    [GUEST_LOCAL_KEY, JSON.stringify(progress)],
    [GUEST_MIGRATION_MARKER_KEY, '1'],
    [GUEST_LINK_TARGET_KEY, userId],
  ]);
  return progress;
}
