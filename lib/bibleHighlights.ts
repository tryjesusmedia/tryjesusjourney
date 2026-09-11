import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { applyDetachedBibleHighlightDeletion } from '@/lib/bibleHighlightDetachCore';
import { fetchAllBibleHighlightPages } from '@/lib/bibleHighlightPaginationCore';
import {
  mergeBibleHighlights,
  reconcileRemoteBibleHighlights,
} from '@/lib/bibleHighlightSyncCore';
import {
  normalizeBibleHighlight,
  type BibleHighlight,
  type HighlightColor,
} from '@/lib/bibleHighlightsCore';
import type { BibleTranslation } from '@/data/bible';
import { referenceForOffsets } from '@/data/bible';

const LOCAL_KEY = 'tryjesus_bible_highlights_v1';
const GUEST_KEY = `${LOCAL_KEY}:guest`;
const LINK_TARGET_KEY = `${LOCAL_KEY}:link-target`;

type RemoteHighlight = {
  id: string;
  user_id: string;
  plan_id: string;
  reading_id: string;
  chapter_label: string;
  translation: BibleTranslation;
  start_offset: number;
  end_offset: number;
  selected_text: string;
  color: HighlightColor;
  note: string | null;
  created_at: string;
  updated_at: string;
  client_mutation_id: string;
  deleted_at?: string | null;
};

export type CreateBibleHighlightInput = {
  planId: string;
  readingId: string;
  chapterLabel: string;
  reference: string;
  translation: BibleTranslation;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  color: HighlightColor;
  note?: string;
  createdAt?: string;
};

export type UpdateBibleHighlightInput = Partial<Pick<BibleHighlight, 'note' | 'color' | 'createdAt'>>;

function accountKey(userId: string) {
  return `${LOCAL_KEY}:user:${userId}`;
}

async function readAtKey(key: string, ownerUserId?: string) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  let parsed: BibleHighlight[] = [];
  try {
    parsed = JSON.parse(raw) as BibleHighlight[];
  } catch {
    return [];
  }
  const normalized = parsed
    .map((item) => normalizeBibleHighlight({ ...item, ownerUserId }))
    .filter((item): item is BibleHighlight => Boolean(item));
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

async function writeAtKey(key: string, highlights: BibleHighlight[], ownerUserId?: string) {
  await AsyncStorage.setItem(key, JSON.stringify(highlights.map((highlight) => ({ ...highlight, ownerUserId }))));
}

async function readGuest() {
  return readAtKey(GUEST_KEY);
}

async function readAccount(userId: string) {
  return readAtKey(accountKey(userId), userId);
}

async function writeGuest(highlights: BibleHighlight[]) {
  return writeAtKey(GUEST_KEY, highlights);
}

async function writeAccount(highlights: BibleHighlight[], userId: string) {
  return writeAtKey(accountKey(userId), highlights, userId);
}

function fromRemote(row: RemoteHighlight): BibleHighlight {
  return {
    id: row.id,
    planId: row.plan_id,
    readingId: row.reading_id,
    chapterLabel: row.chapter_label,
    reference: referenceForOffsets(row.chapter_label, row.translation === 'WEB' ? 'WEB' : 'KJV', row.start_offset, row.end_offset),
    translation: row.translation === 'WEB' ? 'WEB' : 'KJV',
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    selectedText: row.selected_text,
    color: row.color,
    note: row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: true,
    clientMutationId: row.client_mutation_id,
    ownerUserId: row.user_id,
    remoteId: row.id,
    deletedAt: row.deleted_at ?? undefined,
  };
}

const remoteFields = 'id,user_id,plan_id,reading_id,chapter_label,translation,start_offset,end_offset,selected_text,color,note,created_at,updated_at,client_mutation_id,deleted_at';

function toRemote(highlight: BibleHighlight, userId: string) {
  return {
    user_id: userId,
    plan_id: highlight.planId,
    reading_id: highlight.readingId,
    chapter_label: highlight.chapterLabel,
    translation: highlight.translation,
    start_offset: highlight.startOffset,
    end_offset: highlight.endOffset,
    selected_text: highlight.selectedText,
    color: highlight.color,
    note: highlight.note,
    created_at: highlight.createdAt,
    updated_at: highlight.updatedAt,
    client_mutation_id: highlight.clientMutationId,
  };
}

async function insertRemote(highlight: BibleHighlight, userId: string) {
  const result = await supabase
    .from('bible_highlights')
    .upsert(toRemote(highlight, userId), { onConflict: 'user_id,client_mutation_id' })
    .select(remoteFields)
    .single();
  if (result.error) throw result.error;
  return fromRemote(result.data as RemoteHighlight);
}

async function updateRemote(highlight: BibleHighlight, userId: string) {
  const remoteId = highlight.remoteId ?? highlight.id;
  const result = await supabase
    .from('bible_highlights')
    .update(toRemote(highlight, userId))
    .eq('id', remoteId)
    .eq('user_id', userId)
    .select(remoteFields)
    .single();
  if (result.error) throw result.error;
  return fromRemote(result.data as RemoteHighlight);
}

async function softDeleteRemote(highlight: BibleHighlight, userId: string) {
  const deletedAt = highlight.deletedAt ?? new Date().toISOString();
  const remoteId = highlight.remoteId ?? (highlight.synced ? highlight.id : undefined);
  const query = remoteId
    ? supabase
      .from('bible_highlights')
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq('id', remoteId)
      .eq('user_id', userId)
    : supabase
      .from('bible_highlights')
      .upsert({ ...toRemote({ ...highlight, updatedAt: deletedAt }, userId), deleted_at: deletedAt }, {
        onConflict: 'user_id,client_mutation_id',
      });
  const result = await query.select(remoteFields).single();
  if (result.error) throw result.error;
  return fromRemote(result.data as RemoteHighlight);
}

async function saveInBucket(highlight: BibleHighlight, userId?: string) {
  const highlights = userId ? await readAccount(userId) : await readGuest();
  const next = highlights.some((item) => item.id === highlight.id)
    ? highlights.map((item) => item.id === highlight.id ? highlight : item)
    : [highlight, ...highlights];
  if (userId) await writeAccount(next, userId);
  else await writeGuest(next);
  return next;
}

async function syncPending(highlights: BibleHighlight[], userId: string) {
  let working = [...highlights];
  for (const highlight of working.filter((item) => !item.synced)) {
    if (highlight.deletedAt && (highlight.remoteId || highlight.clientMutationId)) {
      await softDeleteRemote(highlight, userId);
      working = working.filter((item) => item.id !== highlight.id);
    } else if (highlight.deletedAt) {
      working = working.filter((item) => item.id !== highlight.id);
    } else {
      const synced = highlight.remoteId ? await updateRemote(highlight, userId) : await insertRemote(highlight, userId);
      working = working.map((item) => item.id === highlight.id ? synced : item);
    }
    await writeAccount(working, userId);
  }
  return working;
}

export async function loadLocalBibleHighlights(userId?: string) {
  const highlights = userId ? await readAccount(userId) : await readGuest();
  return highlights.filter((item) => !item.deletedAt);
}

export async function loadBibleHighlights(userId?: string) {
  if (!userId) return loadLocalBibleHighlights();

  let working = await readAccount(userId);
  const [guest, linkTarget] = await Promise.all([readGuest(), AsyncStorage.getItem(LINK_TARGET_KEY)]);
  if (guest.length && (!linkTarget || linkTarget === userId)) {
    await AsyncStorage.setItem(LINK_TARGET_KEY, userId);
    working = mergeBibleHighlights(working, guest.map((item) => ({ ...item, ownerUserId: userId })));
    await writeAccount(working, userId);
  }
  const remoteRows = await fetchAllBibleHighlightPages<RemoteHighlight>(async (from, to) => {
    const result = await supabase
      .from('bible_highlights')
      .select(remoteFields)
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, to);
    if (result.error) throw result.error;
    return result.data as RemoteHighlight[];
  });
  const remote = remoteRows.map(fromRemote);
  working = reconcileRemoteBibleHighlights(remote, working);
  await writeAccount(working, userId);
  working = await syncPending(working, userId);
  const merged = working.filter((item) => !item.deletedAt);
  await writeAccount(merged, userId);

  if (await AsyncStorage.getItem(LINK_TARGET_KEY) === userId) {
    await writeGuest([]);
    await AsyncStorage.removeItem(LINK_TARGET_KEY);
  }
  return merged;
}

export async function createBibleHighlight(input: CreateBibleHighlightInput, userId?: string) {
  const now = new Date().toISOString();
  const mutationId = Crypto.randomUUID();
  const local: BibleHighlight = {
    id: `local-${mutationId}`,
    ...input,
    note: input.note ?? '',
    createdAt: new Date(input.createdAt ?? now).toISOString(),
    updatedAt: now,
    synced: false,
    clientMutationId: mutationId,
    ownerUserId: userId,
  };
  await saveInBucket(local, userId);
  if (!userId) return local;

  try {
    const created = await insertRemote(local, userId);
    const current = await readAccount(userId);
    await writeAccount(current.map((item) => item.id === local.id ? created : item), userId);
    return created;
  } catch {
    return local;
  }
}

export async function updateBibleHighlight(
  highlight: BibleHighlight,
  changes: UpdateBibleHighlightInput,
  userId?: string,
) {
  const local: BibleHighlight = {
    ...highlight,
    ...changes,
    createdAt: changes.createdAt ? new Date(changes.createdAt).toISOString() : highlight.createdAt,
    updatedAt: new Date().toISOString(),
    synced: false,
    remoteId: highlight.remoteId ?? (highlight.synced ? highlight.id : undefined),
    ownerUserId: userId,
  };
  await saveInBucket(local, userId);
  if (!userId) return local;

  try {
    const saved = local.remoteId ? await updateRemote(local, userId) : await insertRemote(local, userId);
    const current = await readAccount(userId);
    await writeAccount(current.map((item) => item.id === local.id ? saved : item), userId);
    return saved;
  } catch {
    return local;
  }
}

export async function deleteBibleHighlight(highlight: BibleHighlight, userId?: string) {
  const current = userId ? await readAccount(userId) : await readGuest();
  const remoteId = highlight.remoteId ?? (highlight.synced ? highlight.id : undefined);
  const without = current.filter((item) => item.id !== highlight.id);
  if (!userId) {
    const linkTarget = await AsyncStorage.getItem(LINK_TARGET_KEY);
    await writeGuest(applyDetachedBibleHighlightDeletion(current, highlight, new Date().toISOString(), linkTarget));
    return;
  }
  if (!remoteId && !highlight.clientMutationId) {
    await writeAccount(without, userId);
    return;
  }

  const deletedAt = new Date().toISOString();
  const tombstone = { ...highlight, synced: false, remoteId, deletedAt, updatedAt: deletedAt };
  await writeAccount(current.map((item) => item.id === highlight.id ? tombstone : item), userId);
  try {
    await softDeleteRemote(tombstone, userId);
  } catch {
    return;
  }
  await writeAccount(without, userId);
}

export async function exportBibleHighlightsToGuest(userId: string) {
  const account = await readAccount(userId);
  const detached = account.filter((item) => !item.deletedAt).map((item) => ({
    ...item,
    ownerUserId: undefined,
    remoteId: item.remoteId ?? (item.synced ? item.id : undefined),
  }));
  await writeGuest(detached);
  await AsyncStorage.setItem(LINK_TARGET_KEY, userId);
  return detached;
}
