import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { chronologicalPlanMeta } from '@/data/chronologicalBiblePlan';

export const CHRONOLOGICAL_PLAN_ID = chronologicalPlanMeta.planId;
const LEGACY_PLAN_ID = chronologicalPlanMeta.legacyPlanId;
const GUEST_KEY = 'tryjesus_chronological_plan_progress_v2';
const LEGACY_GUEST_KEY = 'tryjesus_chronological_plan_progress';

export type ChronologicalProgress = {
  completed: number[];
  lastIndex: number;
};

const empty: ChronologicalProgress = { completed: [], lastIndex: 0 };

function migrateLegacyProgress(progress: ChronologicalProgress): ChronologicalProgress {
  const completedLegacy = new Set(progress.completed.map(Number));
  const completed = Array.from(completedLegacy).flatMap((legacyIndex) => chronologicalPlanMeta.legacyMigration[String(legacyIndex)] ?? []);
  const lastChildren = chronologicalPlanMeta.legacyMigration[String(Number(progress.lastIndex))] ?? [0];
  const lastIndex = completedLegacy.has(Number(progress.lastIndex)) ? lastChildren[lastChildren.length - 1] : lastChildren[0];
  return { completed: Array.from(new Set(completed)).sort((left, right) => left - right), lastIndex };
}

function normalizeProgress(data?: { completed_indices?: unknown; last_index?: unknown } | null): ChronologicalProgress {
  const completed = Array.isArray(data?.completed_indices)
    ? data.completed_indices.map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index < chronologicalPlanMeta.readingCount)
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
      const { data: legacy } = await supabase
        .from('reading_plan_progress')
        .select('completed_indices,last_index')
        .eq('user_id', userId)
        .eq('plan_id', LEGACY_PLAN_ID)
        .maybeSingle();
      if (legacy) {
        const migrated = migrateLegacyProgress({
          completed: Array.isArray(legacy.completed_indices) ? legacy.completed_indices.map(Number) : [],
          lastIndex: Number(legacy.last_index ?? 0),
        });
        await saveChronologicalProgress(migrated, userId);
        return migrated;
      }
    }
  }

  const raw = await AsyncStorage.getItem(GUEST_KEY);
  if (raw) return normalizeProgress({ completed_indices: JSON.parse(raw).completed, last_index: JSON.parse(raw).lastIndex });
  const legacyRaw = await AsyncStorage.getItem(LEGACY_GUEST_KEY);
  if (!legacyRaw) return empty;
  const migrated = migrateLegacyProgress(JSON.parse(legacyRaw));
  await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(migrated));
  return migrated;
}

export async function saveChronologicalProgress(progress: ChronologicalProgress, userId?: string) {
  const normalized = {
    completed: Array.from(new Set(progress.completed)).filter((index) => index >= 0 && index < chronologicalPlanMeta.readingCount).sort((a, b) => a - b),
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
