import {
  exportChronologicalProgressToGuest,
  loadChronologicalProgress,
} from '@/lib/chronologicalProgress';
import {
  exportChronologicalNotesToGuest,
  loadChronologicalNotes,
} from '@/lib/chronologicalNotes';
import {
  exportBibleHighlightsToGuest,
  loadBibleHighlights,
} from '@/lib/bibleHighlights';

type DetachOptions = {
  requireFreshRemoteCopy?: boolean;
};

export async function prepareChronologicalDetach(
  userId: string,
  { requireFreshRemoteCopy = false }: DetachOptions = {},
) {
  // Preserve legacy notes/highlights during detach even though those tools are no longer shown in the app.
  const refreshes = [
    loadChronologicalProgress(userId),
    loadChronologicalNotes(userId),
    loadBibleHighlights(userId),
  ];
  if (requireFreshRemoteCopy) await Promise.all(refreshes);
  else await Promise.allSettled(refreshes);

  await Promise.all([
    exportChronologicalProgressToGuest(userId),
    exportChronologicalNotesToGuest(userId),
    exportBibleHighlightsToGuest(userId),
  ]);
}
