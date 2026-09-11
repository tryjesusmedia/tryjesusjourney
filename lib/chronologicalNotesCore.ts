export function replaceChronologicalNoteById<T extends { id: string }>(notes: T[], temporaryId: string, created: T) {
  return notes.map((note) => note.id === temporaryId ? created : note);
}

export function guestNotesKey(baseKey: string) {
  return `${baseKey}:guest`;
}

export function accountNotesKey(baseKey: string, userId: string) {
  return `${baseKey}:user:${userId}`;
}

export function ensureStableClientMutationId<T extends { clientMutationId?: string }>(note: T, createId: () => string) {
  if (note.clientMutationId) return note as T & { clientMutationId: string };
  return { ...note, clientMutationId: createId() };
}

export function shouldLinkGuestNotes<T>(guestNotes: T[], pendingLinkUserId: string | null, userId: string) {
  return guestNotes.length > 0 && (!pendingLinkUserId || pendingLinkUserId === userId);
}

export function mergeGuestNotesIntoAccount<
  T extends { id: string; clientMutationId?: string; ownerUserId?: string },
>(accountNotes: T[], guestNotes: T[], userId: string) {
  const knownIds = new Set(accountNotes.map((note) => note.id));
  const knownMutations = new Set(accountNotes.map((note) => note.clientMutationId).filter(Boolean));
  const additions = guestNotes
    .filter((note) => !knownIds.has(note.id) && (!note.clientMutationId || !knownMutations.has(note.clientMutationId)))
    .map((note) => ({ ...note, ownerUserId: userId }));
  return [...accountNotes, ...additions];
}

export function mergeDetachedNotesIntoAccount<
  T extends { id: string; clientMutationId?: string; ownerUserId?: string },
>(accountNotes: T[], guestNotes: T[], userId: string) {
  const detachedById = new Map(guestNotes.map((note) => [note.id, note]));
  const detachedByMutation = new Map(
    guestNotes.filter((note) => note.clientMutationId).map((note) => [note.clientMutationId, note]),
  );
  const consumed = new Set<T>();
  const reconciled = accountNotes.map((accountNote) => {
    const detached = detachedById.get(accountNote.id)
      ?? (accountNote.clientMutationId ? detachedByMutation.get(accountNote.clientMutationId) : undefined);
    if (!detached) return accountNote;
    consumed.add(detached);
    return { ...detached, ownerUserId: userId };
  });
  const additions = guestNotes
    .filter((note) => !consumed.has(note))
    .map((note) => ({ ...note, ownerUserId: userId }));
  return [...reconciled, ...additions];
}

export function applyDetachedNoteDeletion<
  T extends { id: string; synced: boolean; deletedAt?: string; clientMutationId?: string },
>(notes: T[], deleted: T, deletedAt: string) {
  const matches = (note: T) => note.id === deleted.id
    || Boolean(note.clientMutationId && deleted.clientMutationId && note.clientMutationId === deleted.clientMutationId);
  if (!deleted.synced) return notes.filter((note) => !matches(note));
  return notes.map((note) => matches(note) ? { ...note, deletedAt } : note);
}
