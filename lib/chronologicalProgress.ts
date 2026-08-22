import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export const CHRONOLOGICAL_PLAN_ID = 'chronological-bible-order-v1';
const GUEST_KEY = 'tryjesus_chronological_plan_progress';

export type ChronologicalProgress = {
  completed: number[];
  lastIndex: number;
};

const empty: ChronologicalProgress = { completed: [], lastIndex: 0 };

export async function loadChronologicalProgress(userId?: string): Promise<ChronologicalProgress> {
  if (userId) {
    const { data, error } = await supabase
      .from('reading_plan_progress')
      .select('completed_indices,last_index')
      .eq('user_id', userId)
      .eq('plan_id', CHRONOLOGICAL_PLAN_ID)
      .maybeSingle();

    if (!error && data) {
      return {
        completed: Array.isArray(data.completed_indices) ? data.completed_indices.map(Number) : [],
        lastIndex: Number(data.last_index ?? 0),
      };
    }
  }

  const raw = await AsyncStorage.getItem(GUEST_KEY);
  return raw ? JSON.parse(raw) : empty;
}

export async function saveChronologicalProgress(progress: ChronologicalProgress, userId?: string) {
  const normalized = {
    completed: Array.from(new Set(progress.completed)).sort((a, b) => a - b),
    lastIndex: Math.max(0, progress.lastIndex),
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
