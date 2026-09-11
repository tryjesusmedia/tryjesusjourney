import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASK_HISTORY_LIMIT, type GuestAskMessage, type GuestChatSource, type GuestJournal, type GuestProgress } from './localStoreCore';
import {
  mergeLegacyAskHistory,
  mergeLegacyGuideProgress,
  mergeLegacyJournalEntries,
} from './localStore';
import { supabase } from './supabase';

type LegacyDataset = 'guide' | 'journal' | 'ask';

type PreserveLegacyCloudDataOptions = {
  requireAll?: boolean;
};

type LegacyGuideRow = {
  guide_id?: unknown;
  lesson_id?: unknown;
  progress_percent?: unknown;
  updated_at?: unknown;
};

type LegacyJournalRow = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  created_at?: unknown;
};

type LegacyAskRow = {
  id?: unknown;
  role?: unknown;
  message?: unknown;
  sources?: unknown;
  created_at?: unknown;
};

const IMPORT_MARKER_PREFIX = 'tryjesus_legacy_cloud_preserved_v1';
const JOURNAL_PAGE_SIZE = 500;
const inFlight = new Map<string, Promise<void>>();

function markerKey(userId: string, dataset: LegacyDataset) {
  return `${IMPORT_MARKER_PREFIX}:${userId}:${dataset}`;
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sources(value: unknown): GuestChatSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is GuestChatSource => Boolean(item) && typeof item === 'object');
}

async function runOnce(userId: string, dataset: LegacyDataset, operation: () => Promise<void>) {
  const key = markerKey(userId, dataset);
  if (await AsyncStorage.getItem(key)) return;
  await operation();
  await AsyncStorage.setItem(key, new Date().toISOString());
}

async function preserveGuideProgress(userId: string) {
  const result = await supabase
    .from('guide_progress')
    .select('guide_id,lesson_id,progress_percent,updated_at')
    .eq('user_id', userId);
  if (result.error) throw result.error;

  for (const row of (result.data ?? []) as LegacyGuideRow[]) {
    const guideId = text(row.guide_id).trim();
    if (!guideId) continue;
    const progress: GuestProgress = {
      lessonUrl: text(row.lesson_id),
      progressPercent: number(row.progress_percent),
      updatedAt: text(row.updated_at),
    };
    await mergeLegacyGuideProgress(guideId, progress);
  }
}

async function fetchJournalEntries(userId: string) {
  const rows: LegacyJournalRow[] = [];
  for (let from = 0; ; from += JOURNAL_PAGE_SIZE) {
    const result = await supabase
      .from('journal_entries')
      .select('id,title,body,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + JOURNAL_PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data ?? []) as LegacyJournalRow[];
    rows.push(...page);
    if (page.length < JOURNAL_PAGE_SIZE) return rows;
  }
}

async function preserveJournal(userId: string) {
  const rows = await fetchJournalEntries(userId);
  const entries = rows.flatMap((row): GuestJournal[] => {
    if (row.id == null) return [];
    const cloudId = `${userId}:journal:${text(row.id)}`;
    return [{
      id: `legacy-cloud:${cloudId}`,
      title: text(row.title, 'Reflection') || 'Reflection',
      body: text(row.body),
      createdAt: text(row.created_at),
      legacyCloudId: cloudId,
    }];
  });
  await mergeLegacyJournalEntries(entries);
}

async function preserveAskHistory(userId: string) {
  const result = await supabase
    .from('pastor_kal_chat_messages')
    .select('id,role,message,sources,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(ASK_HISTORY_LIMIT);
  if (result.error) throw result.error;

  const messages = ((result.data ?? []) as LegacyAskRow[]).flatMap((row): GuestAskMessage[] => {
    if (row.id == null || (row.role !== 'user' && row.role !== 'assistant')) return [];
    const cloudId = `${userId}:ask:${text(row.id)}`;
    return [{
      id: `legacy-cloud:${cloudId}`,
      role: row.role,
      text: text(row.message),
      sources: sources(row.sources),
      createdAt: text(row.created_at),
      legacyCloudId: cloudId,
    }];
  });
  await mergeLegacyAskHistory(messages);
}

function preservationOperations(userId: string) {
  return [
    runOnce(userId, 'guide', () => preserveGuideProgress(userId)),
    runOnce(userId, 'journal', () => preserveJournal(userId)),
    runOnce(userId, 'ask', () => preserveAskHistory(userId)),
  ];
}

export async function preserveLegacyCloudData(
  userId: string,
  { requireAll = false }: PreserveLegacyCloudDataOptions = {},
) {
  if (!userId) return;

  // Account deletion must stop if even one legacy dataset cannot be copied.
  // The normal sign-in path below remains best-effort and retries later.
  if (requireAll) {
    await Promise.all(preservationOperations(userId));
    return;
  }

  const pending = inFlight.get(userId);
  if (pending) return pending;

  const operation = (async () => {
    try {
      const results = await Promise.allSettled(preservationOperations(userId));
      for (const result of results) {
        if (result.status === 'rejected') console.warn('Could not preserve legacy account data yet.', result.reason);
      }
    } finally {
      inFlight.delete(userId);
    }
  })();

  inFlight.set(userId, operation);
  return operation;
}
