import { supabase } from '@/lib/supabase';
import {
  normalizeJourneyAlias,
  normalizeJourneyLeaderboardRows,
  type JourneyLeaderboardEntry,
} from '@/lib/journeyRewardsCore';

function rpcErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

export async function ensureJourneyProfile() {
  const { data, error } = await supabase.rpc('ensure_journey_profile');
  if (error) throw new Error(rpcErrorMessage(error, 'Your Journey alias is unavailable right now.'));
  const alias = normalizeJourneyAlias(data);
  if (!alias) throw new Error('Your Journey alias is unavailable right now.');
  return alias;
}

export async function updateJourneyAlias(nextAlias: string) {
  const { data, error } = await supabase.rpc('update_journey_alias', { p_alias: nextAlias });
  if (error) throw new Error(rpcErrorMessage(error, 'Your leaderboard name could not be saved right now.'));
  const alias = normalizeJourneyAlias(data);
  if (!alias) throw new Error('Your leaderboard name could not be saved right now.');
  return alias;
}

export async function getJourneyLeaderboard(): Promise<JourneyLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_journey_leaderboard');
  if (error) throw new Error(rpcErrorMessage(error, 'The Journey leaderboard is unavailable right now.'));
  return normalizeJourneyLeaderboardRows(data);
}
