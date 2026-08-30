import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { chronologicalPlanMeta } from '@/data/chronologicalBiblePlan';

export const CHRONOLOGICAL_PLAN_ID = chronologicalPlanMeta.planId;
const LEGACY_PLAN_ID = chronologicalPlanMeta.legacyPlanId;
const ORIGINAL_LEGACY_PLAN_ID = chronologicalPlanMeta.originalLegacyPlanId;
const GUEST_KEY = 'tryjesus_chronological_plan_progress_v3';
const LEGACY_GUEST_KEY = 'tryjesus_chronological_plan_progress_v2';
const ORIGINAL_LEGACY_GUEST_KEY = 'tryjesus_chronological_plan_progress';

export type ChronologicalProgress = {
  completed: number[];
  lastIndex: number;
};

const empty: ChronologicalProgress = { completed: [], lastIndex: 0 };

function chaptersForTaskIndices(indices: number[]): number[] {
  return indices.flatMap((taskIndex) => chronologicalPlanMeta.taskChapterMigration[String(taskIndex)] ?? []);
}

function migrateV2Progress(progress: ChronologicalProgress): ChronologicalProgress {
  return { completed: Array.from(new Set(chaptersForTaskIndices(progress.completed.map(Number)))).sort((left, right) => left - right), lastIndex: Math.max(0, Math.min(Number(progress.lastIndex), chronologicalPlanMeta.readingCount - 1)) };
}

function migrateV1Progress(progress: ChronologicalProgress): ChronologicalProgress {
  const completedLegacy = new Set(progress.completed.map(Number));
  const completedTasks = Array.from(completedLegacy).flatMap((legacyIndex) => chronologicalPlanMeta.legacyMigration[String(legacyIndex)] ?? []);
  const lastChildren = chronologicalPlanMeta.legacyMigration[String(Number(progress.lastIndex))] ?? [0];
  const lastIndex = completedLegacy.has(Number(progress.lastIndex)) ? lastChildren[lastChildren.length - 1] : lastChildren[0];
  return { completed: Array.from(new Set(chaptersForTaskIndices(completedTasks))).sort((left, right) => left - right), lastIndex };
}

function normalizeProgress(data?: { completed_indices?: unknown; last_index?: unknown } | null): ChronologicalProgress {
  const completed = Array.isArray(data?.completed_indices)
    ? data.completed_indices.map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index < chronologicalPlanMeta.chapterCount)
    : [];
  const lastIndex = Math.max(0, Math.min(Number(data?.last_index ?? 0), chronologicalPlanMeta.readingCount - 1));
  return { completed: Array.from(new Set(completed)), lastIndex };
}

export async function loadChronologicalProgress(userId?: string): Promise<ChronologicalProgress> {
  if (userId) {
    const { data, error } = await supabase
      .from('reading_plan_progress')
      .select('completed_indices,last_index')
      .eq('user_id', userId)
      .eq('plan_id', CHRONOLOGICAL_PLAN_ID)
      .maybeSingle();

    if (!error && data) return normalizeProgress(data);

    if (!error && !data) {
      const { data: legacy, error: legacyError } = await supabase
        .from('reading_plan_progress')
        .select('completed_indices,last_index')
        .eq('user_id', userId)
        .eq('plan_id', LEGACY_PLAN_ID)
        .maybeSingle();
      if (!legacyError && legacy) {
        const migrated = migrateV2Progress({
          completed: Array.isArray(legacy.completed_indices) ? legacy.completed_indices.map(Number) : [],
          lastIndex: Number(legacy.last_index ?? 0),
        });
        await saveChronologicalProgress(migrated, userId);
        return migrated;
      }
      if (!legacyError && !legacy) {
        const { data: originalLegacy } = await supabase.from('reading_plan_progress').select('completed_indices,last_index').eq('user_id', userId).eq('plan_id', ORIGINAL_LEGACY_PLAN_ID).maybeSingle();
        if (originalLegacy) {
          const migrated = migrateV1Progress({ completed: Array.isArray(originalLegacy.completed_indices) ? originalLegacy.completed_indices.map(Number) : [], lastIndex: Number(originalLegacy.last_index ?? 0) });
          await saveChronologicalProgress(migrated, userId);
          return migrated;
        }
      }
    }
  }

  const raw = await AsyncStorage.getItem(GUEST_KEY);
  if (raw) { const parsed = JSON.parse(raw); return normalizeProgress({ completed_indices: parsed.completed, last_index: parsed.lastIndex }); }
  const legacyRaw = await AsyncStorage.getItem(LEGACY_GUEST_KEY);
  if (legacyRaw) { const migrated = migrateV2Progress(JSON.parse(legacyRaw)); await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(migrated)); return migrated; }
  const originalLegacyRaw = await AsyncStorage.getItem(ORIGINAL_LEGACY_GUEST_KEY);
  if (originalLegacyRaw) { const migrated = migrateV1Progress(JSON.parse(originalLegacyRaw)); await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(migrated)); return migrated; }
  return empty;
}

export async function saveChronologicalProgress(progress: ChronologicalProgress, userId?: string) {
  const normalized = {
    completed: Array.from(new Set(progress.completed)).filter((index) => index >= 0 && index < chronologicalPlanMeta.chapterCount).sort((a, b) => a - b),
    lastIndex: Math.max(0, Math.min(progress.lastIndex, chronologicalPlanMeta.readingCount - 1)),
  };

  await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(normalized));

  if (userId) {
    const { error } = await supabase.from('reading_plan_progress').upsert({
      user_id: userId,
      plan_id: CHRONOLOGICAL_PLAN_ID,
      completed_indices: normalized.completed,
      last_index: normalized.lastIndex,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,plan_id' });

    if (error) console.warn('Reading plan sync:', error.message);
  }
}
