import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureJourneyProfile, rerollJourneyAlias } from '@/lib/journeyRewards';

export function useJourneyProfile(userId?: string) {
  const generationRef = useRef(0);
  const [alias, setAlias] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (!userId) {
      setAlias(null);
      setLoading(false);
      setRerolling(false);
      setError(false);
      return null;
    }

    setLoading(true);
    setError(false);
    try {
      const nextAlias = await ensureJourneyProfile();
      if (generationRef.current !== generation) return null;
      setAlias(nextAlias);
      return nextAlias;
    } catch {
      if (generationRef.current === generation) {
        setAlias(null);
        setError(true);
      }
      return null;
    } finally {
      if (generationRef.current === generation) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    return () => {
      generationRef.current += 1;
    };
  }, [refresh]);

  const changeAlias = useCallback(async () => {
    if (!userId || rerolling) return null;
    const generation = ++generationRef.current;
    setRerolling(true);
    setError(false);
    try {
      const nextAlias = await rerollJourneyAlias();
      if (generationRef.current !== generation) return null;
      setAlias(nextAlias);
      return nextAlias;
    } catch (caught) {
      if (generationRef.current === generation) setError(true);
      throw caught;
    } finally {
      if (generationRef.current === generation) setRerolling(false);
    }
  }, [rerolling, userId]);

  return { alias, loading, rerolling, error, refresh, changeAlias };
}
