import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { CHRONOLOGICAL_NOTES_PLAN_ID } from '@/lib/chronologicalProgress';
import {
  applyDetachedNoteDeletion,
  accountNotesKey,
  ensureStableClientMutationId,
  guestNotesKey,
  mergeDetachedNotesIntoAccount,
  mergeGuestNotesIntoAccount,
  replaceChronologicalNoteById,
  shouldLinkGuestNotes,
} from '@/lib/chronologicalNotesCore';

const LOCAL_KEY = 'tryjesus_chronological_notes_v2';
const LEGACY_LOCAL_KEY = 'tryjesus_chronological_notes_v1';
const GUEST_LOCAL_KEY = guestNotesKey(LOCAL_KEY);
const GUEST_MIGRATION_MARKER_KEY = `${GUEST_LOCAL_KEY}:legacy-imported`;
const GUEST_LINK_TARGET_KEY = `${GUEST_LOCAL_KEY}:link-target`;

export type ChronologicalNote = {
  id: string;
  readingId: string;
  body: string;
  createdAt: string;
  principleNumber?: number;
  synced: boolean;
  deletedAt?: string;
  clientMutationId?: string;
  ownerUserId?: string;
};

type RemotePrinciple = {
  id: string;
  reading_id: string;
  body: string;
  principle_number: number;
  created_at: string;
  deleted_at?: string | null;
  client_mutation_id?: string | null;
};

function normalizeNote(note: ChronologicalNote, ownerUserId?: string): ChronologicalNote | null {
  if (!note?.id || !note?.readingId || !note?.body) return null;
  const normalized: ChronologicalNote = {
    ...note,
    body: note.body.trim(),
    synced: Boolean(note.synced),
    ownerUserId,
  };
  return normalized.synced ? normalized : ensureStableClientMutationId(normalized, Crypto.randomUUID);
}

async function readNotesAtKey(
  key: string,
  ownerUserId?: string,
  allowDetachedSynced = false,
): Promise<ChronologicalNote[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as ChronologicalNote[];
  const normalized = parsed
    .map((note) => {
      if (!ownerUserId && (note.ownerUserId || (note.synced && !allowDetachedSynced))) return null;
      if (ownerUserId && note.ownerUserId && note.ownerUserId !== ownerUserId) return null;
      return normalizeNote(note, ownerUserId);
    })
    .filter((note): note is ChronologicalNote => Boolean(note));
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

async function writeNotesAtKey(key: string, notes: ChronologicalNote[]) {
  await AsyncStorage.setItem(key, JSON.stringify(notes));
}

async function readGuestNotes(): Promise<ChronologicalNote[]> {
  const detachedUserId = await AsyncStorage.getItem(GUEST_LINK_TARGET_KEY);
  const current = await readNotesAtKey(GUEST_LOCAL_KEY, undefined, Boolean(detachedUserId));
  if (current.length || await AsyncStorage.getItem(GUEST_MIGRATION_MARKER_KEY)) return current;

  const legacyRaw = await AsyncStorage.getItem(LEGACY_LOCAL_KEY);
  const legacy = legacyRaw ? JSON.parse(legacyRaw) as ChronologicalNote[] : [];
  // Synced legacy rows necessarily came from a signed-in account. Never expose
  // them in guest mode; their owner will retrieve them from Supabase after login.
  const guestOnly = legacy
    .filter((note) => !note.synced && !note.ownerUserId)
    .map((note) => normalizeNote(note))
    .filter((note): note is ChronologicalNote => Boolean(note));
  await AsyncStorage.multiSet([
    [GUEST_LOCAL_KEY, JSON.stringify(guestOnly)],
    [GUEST_MIGRATION_MARKER_KEY, '1'],
  ]);
  return guestOnly;
}

async function writeGuestNotes(notes: ChronologicalNote[]) {
  const detachedUserId = await AsyncStorage.getItem(GUEST_LINK_TARGET_KEY);
  const guestOnly = notes
    .filter((note) => !note.ownerUserId && (!note.synced || Boolean(detachedUserId)))
    .map((note) => ({ ...note, ownerUserId: undefined }));
  await writeNotesAtKey(GUEST_LOCAL_KEY, guestOnly);
}

async function readAccountNotes(userId: string) {
  return readNotesAtKey(accountNotesKey(LOCAL_KEY, userId), userId);
}

async function writeAccountNotes(notes: ChronologicalNote[], userId: string) {
  await writeNotesAtKey(accountNotesKey(LOCAL_KEY, userId), notes.map((note) => ({ ...note, ownerUserId: userId })));
}

async function finishGuestNoteLink(userId: string) {
  const targetUserId = await AsyncStorage.getItem(GUEST_LINK_TARGET_KEY);
  if (targetUserId !== userId) return;
  await AsyncStorage.multiSet([
    [GUEST_LOCAL_KEY, '[]'],
    [GUEST_MIGRATION_MARKER_KEY, '1'],
  ]);
  await AsyncStorage.removeItem(GUEST_LINK_TARGET_KEY);
}

function fromRemote(note: RemotePrinciple, userId: string): ChronologicalNote {
  return {
    id: note.id,
    readingId: note.reading_id,
    body: note.body,
    createdAt: note.created_at,
    principleNumber: note.principle_number,
    synced: true,
    clientMutationId: note.client_mutation_id ?? undefined,
    ownerUserId: userId,
  };
}

async function createRemoteNote(note: ChronologicalNote): Promise<ChronologicalNote> {
  const result = await supabase.rpc('create_conflict_principle', {
    p_plan_id: CHRONOLOGICAL_NOTES_PLAN_ID,
    p_reading_id: note.readingId,
    p_body: note.body,
    p_cross_reference_numbers: [],
    p_client_mutation_id: note.clientMutationId,
  });
  if (result.error) throw result.error;
  const created = (Array.isArray(result.data) ? result.data[0] : result.data) as RemotePrinciple;
  return fromRemote(created, note.ownerUserId ?? '');
}

export async function loadChronologicalNotes(userId?: string): Promise<ChronologicalNote[]> {
  if (!userId) return loadLocalChronologicalNotes();

  let workingLocal = await readAccountNotes(userId);
  const [guest, pendingLinkUserId] = await Promise.all([
    readGuestNotes(),
    AsyncStorage.getItem(GUEST_LINK_TARGET_KEY),
  ]);
  if (shouldLinkGuestNotes(guest, pendingLinkUserId, userId)) {
    await AsyncStorage.setItem(GUEST_LINK_TARGET_KEY, userId);
    workingLocal = pendingLinkUserId === userId
      ? mergeDetachedNotesIntoAccount(workingLocal, guest, userId)
      : mergeGuestNotesIntoAccount(workingLocal, guest, userId);
    await writeAccountNotes(workingLocal, userId);
  }

  const pendingDeletes = workingLocal.filter((note) => note.synced && note.deletedAt);
  for (const note of pendingDeletes) {
    const result = await supabase.from('conflict_principles').delete().eq('id', note.id).eq('user_id', userId);
    if (result.error) throw result.error;
    workingLocal = workingLocal.filter((item) => item.id !== note.id);
    await writeAccountNotes(workingLocal, userId);
  }

  const pending = workingLocal.filter((note) => !note.synced && !note.deletedAt);
  const uploaded: ChronologicalNote[] = [];
  for (const note of pending) {
    const created = await createRemoteNote(note);
    uploaded.push(created);
    workingLocal = replaceChronologicalNoteById(workingLocal, note.id, created);
    // Commit each temp-ID replacement before attempting the next upload or the
    // final refresh. A later failure can then retry without duplicating notes
    // that the server already accepted.
    await writeAccountNotes(workingLocal, userId);
  }

  const remoteResult = await supabase
    .from('conflict_principles')
    .select('id,reading_id,body,principle_number,created_at,deleted_at,client_mutation_id')
    .eq('user_id', userId)
    .eq('plan_id', CHRONOLOGICAL_NOTES_PLAN_ID)
    .is('deleted_at', null)
    .order('principle_number');
  if (remoteResult.error) throw remoteResult.error;

  const remote = (remoteResult.data as RemotePrinciple[]).map((note) => fromRemote(note, userId));
  const remoteIds = new Set(remote.map((note) => note.id));
  const remoteMutations = new Set(remote.map((note) => note.clientMutationId).filter(Boolean));
  const localRemainder = [...workingLocal.filter((note) => !note.synced), ...uploaded]
    .filter((note) => !remoteIds.has(note.id) && (!note.clientMutationId || !remoteMutations.has(note.clientMutationId)));
  const merged = [...remote, ...localRemainder]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  await writeAccountNotes(merged, userId);
  await finishGuestNoteLink(userId);
  return merged;
}

export async function loadLocalChronologicalNotes(userId?: string): Promise<ChronologicalNote[]> {
  const local = userId ? await readAccountNotes(userId) : await readGuestNotes();
  return local.filter((note) => !note.deletedAt).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createChronologicalNote(readingId: string, body: string, userId?: string): Promise<ChronologicalNote> {
  const clientMutationId = Crypto.randomUUID();
  const local: ChronologicalNote = {
    id: `local-${clientMutationId}`,
    readingId,
    body: body.trim(),
    createdAt: new Date().toISOString(),
    synced: false,
    clientMutationId,
    ownerUserId: userId,
  };
  const notes = userId ? await readAccountNotes(userId) : await readGuestNotes();
  if (userId) await writeAccountNotes([local, ...notes], userId);
  else {
    await writeGuestNotes([local, ...notes]);
    const detachedUserId = await AsyncStorage.getItem(GUEST_LINK_TARGET_KEY);
    if (detachedUserId) {
      const accountNotes = await readAccountNotes(detachedUserId);
      await writeAccountNotes(
        mergeDetachedNotesIntoAccount(accountNotes, [local], detachedUserId),
        detachedUserId,
      );
    }
  }
  if (!userId) return local;

  try {
    const created = await createRemoteNote(local);
    await writeAccountNotes([created, ...notes], userId);
    return created;
  } catch {
    // Keep the note on the phone. The next successful sync uploads it.
    return local;
  }
}

export async function deleteChronologicalNote(note: ChronologicalNote, userId?: string) {
  if (!userId) {
    const notes = await readGuestNotes();
    const deletedAt = new Date().toISOString();
    const nextNotes = applyDetachedNoteDeletion(notes, note, deletedAt);
    await writeGuestNotes(nextNotes);
    const detachedUserId = await AsyncStorage.getItem(GUEST_LINK_TARGET_KEY);
    if (detachedUserId) {
      const accountNotes = await readAccountNotes(detachedUserId);
      await writeAccountNotes(
        applyDetachedNoteDeletion(accountNotes, { ...note, ownerUserId: detachedUserId }, deletedAt),
        detachedUserId,
      );
    }
    return;
  }

  const notes = await readAccountNotes(userId);
  if (note.synced) {
    const { error } = await supabase.from('conflict_principles').delete().eq('id', note.id).eq('user_id', userId);
    if (error) {
      await writeAccountNotes(notes.map((item) => item.id === note.id ? { ...item, deletedAt: new Date().toISOString() } : item), userId);
      return;
    }
  }
  await writeAccountNotes(notes.filter((item) => item.id !== note.id), userId);
}

export async function exportChronologicalNotesToGuest(userId: string) {
  const notes = await readAccountNotes(userId);
  const guestNotes = notes.map((note) => ({ ...note, ownerUserId: undefined }));
  await AsyncStorage.multiSet([
    [GUEST_LOCAL_KEY, JSON.stringify(guestNotes)],
    [GUEST_MIGRATION_MARKER_KEY, '1'],
    [GUEST_LINK_TARGET_KEY, userId],
  ]);
  return guestNotes;
}
