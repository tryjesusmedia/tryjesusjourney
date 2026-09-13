import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureJourneyProfile, updateJourneyAlias } from '@/lib/journeyRewards';

export function useJourneyProfile(userId?: string) {
  const generationRef = useRef(0);
  const [alias, setAlias] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (!userId) {
      setAlias(null);
      setLoading(false);
      setSaving(false);
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

  const saveAlias = useCallback(async (value: string) => {
    if (!userId || saving) return null;
    const generation = ++generationRef.current;
    setSaving(true);
    setError(false);
    try {
      const nextAlias = await updateJourneyAlias(value);
      if (generationRef.current !== generation) return null;
      setAlias(nextAlias);
      return nextAlias;
    } catch (caught) {
      if (generationRef.current === generation) setError(true);
      throw caught;
    } finally {
      if (generationRef.current === generation) setSaving(false);
    }
  }, [saving, userId]);

  return { alias, loading, saving, error, refresh, saveAlias };
}
