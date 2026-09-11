export type ChronologicalLoadToken = {
  generation: number;
  identity: string;
};

export function chronologicalLoadIdentity(userId?: string) {
  return userId ? `user:${userId}` : 'guest';
}

export function isChronologicalLoadCurrent(
  token: ChronologicalLoadToken,
  currentGeneration: number,
  currentUserId: string | undefined,
  authLoading: boolean,
) {
  return !authLoading
    && token.generation === currentGeneration
    && token.identity === chronologicalLoadIdentity(currentUserId);
}
