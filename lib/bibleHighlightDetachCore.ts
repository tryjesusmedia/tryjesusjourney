export type DetachableHighlight = {
  id: string;
  synced: boolean;
  updatedAt: string;
  clientMutationId?: string;
  remoteId?: string;
  deletedAt?: string;
};

export function applyDetachedBibleHighlightDeletion<T extends DetachableHighlight>(
  current: T[],
  highlight: T,
  deletedAt: string,
  linkedUserId?: string | null,
) {
  const remoteId = highlight.remoteId ?? (highlight.synced ? highlight.id : undefined);
  if ((!remoteId && !highlight.clientMutationId) || !linkedUserId) return current.filter((item) => item.id !== highlight.id);
  const tombstone: T = {
    ...highlight,
    synced: false,
    remoteId,
    deletedAt,
    updatedAt: deletedAt,
  };
  return current.map((item) => item.id === highlight.id ? tombstone : item);
}
