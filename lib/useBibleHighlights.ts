import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  createBibleHighlight,
  deleteBibleHighlight,
  loadBibleHighlights,
  loadLocalBibleHighlights,
  updateBibleHighlight,
  type CreateBibleHighlightInput,
  type UpdateBibleHighlightInput,
} from '@/lib/bibleHighlights';
import type { BibleHighlight } from '@/lib/bibleHighlightsCore';

export function useBibleHighlights() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const identity = userId ?? 'guest';
  const generation = useRef(0);
  const [highlights, setHighlights] = useState<BibleHighlight[]>([]);
  const [ready, setReady] = useState(false);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [syncUnavailable, setSyncUnavailable] = useState(false);

  const reload = useCallback(async () => {
    const currentGeneration = ++generation.current;
    setReady(false);
    setLoadedIdentity(null);
    if (authLoading) return;
    try {
      const loaded = await loadBibleHighlights(userId);
      if (generation.current !== currentGeneration) return;
      setHighlights(loaded);
      setLoadedIdentity(identity);
      setSyncUnavailable(false);
    } catch {
      const local = await loadLocalBibleHighlights(userId);
      if (generation.current !== currentGeneration) return;
      setHighlights(local);
      setLoadedIdentity(identity);
      setSyncUnavailable(Boolean(userId));
    } finally {
      if (generation.current === currentGeneration) setReady(true);
    }
  }, [authLoading, identity, userId]);

  useFocusEffect(useCallback(() => {
    void reload();
    return () => { generation.current += 1; };
  }, [reload]));

  const create = useCallback(async (input: CreateBibleHighlightInput) => {
    const created = await createBibleHighlight(input, userId);
    setHighlights((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    return created;
  }, [userId]);

  const update = useCallback(async (highlight: BibleHighlight, changes: UpdateBibleHighlightInput) => {
    const saved = await updateBibleHighlight(highlight, changes, userId);
    setHighlights((current) => current.map((item) => item.id === highlight.id ? saved : item));
    return saved;
  }, [userId]);

  const remove = useCallback(async (highlight: BibleHighlight) => {
    await deleteBibleHighlight(highlight, userId);
    setHighlights((current) => current.filter((item) => item.id !== highlight.id));
  }, [userId]);

  return { highlights, ready: ready && !authLoading && loadedIdentity === identity, syncUnavailable, create, update, remove, reload };
}
