export type SyncableHighlight = {
  id: string;
  updatedAt: string;
  synced: boolean;
  clientMutationId?: string;
  remoteId?: string;
  deletedAt?: string;
};

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function bibleHighlightIdentities(highlight: SyncableHighlight) {
  const identities = new Set<string>();
  if (highlight.remoteId) identities.add(`remote:${highlight.remoteId}`);
  if (highlight.synced || !highlight.id.startsWith('local-')) identities.add(`remote:${highlight.id}`);
  if (highlight.clientMutationId) identities.add(`mutation:${highlight.clientMutationId}`);
  identities.add(`id:${highlight.id}`);
  return identities;
}

export function mergeBibleHighlights<T extends SyncableHighlight>(current: T[], incoming: T[]) {
  type HighlightGroup = { value: T; aliases: Set<string> };
  const groups = new Set<HighlightGroup>();
  const groupByAlias = new Map<string, HighlightGroup>();
  for (const item of [...current, ...incoming]) {
    const aliases = bibleHighlightIdentities(item);
    const matching = new Set([...aliases].flatMap((alias) => {
      const group = groupByAlias.get(alias);
      return group ? [group] : [];
    }));
    const candidates = [...matching].map((group) => group.value).concat(item);
    const tombstones = candidates.filter((candidate) => Boolean(candidate.deletedAt));
    const winnerPool = tombstones.length ? tombstones : candidates;
    const winner = winnerPool.reduce((latest, candidate) => (
      timestamp(candidate.updatedAt) >= timestamp(latest.updatedAt) ? candidate : latest
    ));
    const combinedAliases = new Set(aliases);
    matching.forEach((group) => {
      group.aliases.forEach((alias) => combinedAliases.add(alias));
      groups.delete(group);
    });
    const group = { value: winner, aliases: combinedAliases };
    groups.add(group);
    combinedAliases.forEach((alias) => groupByAlias.set(alias, group));
  }
  return [...groups].map((group) => group.value);
}

export function reconcileRemoteBibleHighlights<T extends SyncableHighlight>(remote: T[], local: T[]) {
  const pending = local.filter((highlight) => !highlight.synced);
  return mergeBibleHighlights(remote, pending);
}
