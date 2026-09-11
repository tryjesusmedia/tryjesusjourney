import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  mergeGuestAskMessages,
  mergeGuestGuideProgress,
  mergeGuestJournalEntries,
  type GuestAskMessage,
  type GuestJournal,
  type GuestProgress,
} from './localStoreCore';

export type { GuestAskMessage, GuestChatSource, GuestJournal, GuestProgress } from './localStoreCore';

const PROGRESS_KEY = 'tryjesus_guest_progress';
const GUIDE_PROGRESS_PREFIX = 'tryjesus_guest_guide_progress_';
const JOURNAL_KEY = 'tryjesus_guest_journal';
const ASK_HISTORY_KEY = 'tryjesus_guest_ask_history';
export const LEGACY_MAIN_GUIDE_ID = 'main-bible-journey';

function createStorageLock() {
  let tail = Promise.resolve();
  return async function run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };
}

const withGuideLock = createStorageLock();
const withJournalLock = createStorageLock();
const withAskLock = createStorageLock();

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function guideProgressKey(guideId: string) {
  return guideId === LEGACY_MAIN_GUIDE_ID ? PROGRESS_KEY : `${GUIDE_PROGRESS_PREFIX}${guideId}`;
}

export async function getGuestProgress(): Promise<GuestProgress | null> {
  return readJson<GuestProgress | null>(PROGRESS_KEY, null);
}

export async function saveGuestProgress(progress: GuestProgress) {
  await withGuideLock(() => AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)));
}

export async function getGuestGuideProgress(guideId: string): Promise<GuestProgress | null> {
  return readJson<GuestProgress | null>(`${GUIDE_PROGRESS_PREFIX}${guideId}`, null);
}

export async function saveGuestGuideProgress(guideId: string, progress: GuestProgress) {
  await withGuideLock(() => AsyncStorage.setItem(`${GUIDE_PROGRESS_PREFIX}${guideId}`, JSON.stringify(progress)));
}

export async function mergeLegacyGuideProgress(guideId: string, progress: GuestProgress) {
  return withGuideLock(async () => {
    const key = guideProgressKey(guideId);
    const current = await readJson<GuestProgress | null>(key, null);
    const merged = mergeGuestGuideProgress(current, progress);
    await AsyncStorage.setItem(key, JSON.stringify(merged));
    return merged;
  });
}

export async function getGuestJournal(): Promise<GuestJournal[]> {
  return readJson<GuestJournal[]>(JOURNAL_KEY, []);
}

export async function saveGuestJournal(entries: GuestJournal[]) {
  await withJournalLock(() => AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(entries)));
}

export async function addGuestJournalEntry(entry: GuestJournal) {
  return withJournalLock(async () => {
    const current = await readJson<GuestJournal[]>(JOURNAL_KEY, []);
    const merged = mergeGuestJournalEntries(current, [entry]);
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(merged));
    return merged;
  });
}

export async function removeGuestJournalEntry(id: string) {
  return withJournalLock(async () => {
    const current = await readJson<GuestJournal[]>(JOURNAL_KEY, []);
    const next = current.filter((entry) => entry.id !== id);
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
    return next;
  });
}

export async function mergeLegacyJournalEntries(entries: GuestJournal[]) {
  return withJournalLock(async () => {
    const current = await readJson<GuestJournal[]>(JOURNAL_KEY, []);
    const merged = mergeGuestJournalEntries(current, entries);
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(merged));
    return merged;
  });
}

export async function getGuestAskHistory(): Promise<GuestAskMessage[]> {
  return readJson<GuestAskMessage[]>(ASK_HISTORY_KEY, []);
}

export async function appendGuestAskMessage(message: GuestAskMessage) {
  return withAskLock(async () => {
    const current = await readJson<GuestAskMessage[]>(ASK_HISTORY_KEY, []);
    const merged = mergeGuestAskMessages(current, [message]);
    await AsyncStorage.setItem(ASK_HISTORY_KEY, JSON.stringify(merged));
    return merged;
  });
}

export async function mergeLegacyAskHistory(messages: GuestAskMessage[]) {
  return withAskLock(async () => {
    const current = await readJson<GuestAskMessage[]>(ASK_HISTORY_KEY, []);
    const merged = mergeGuestAskMessages(current, messages);
    await AsyncStorage.setItem(ASK_HISTORY_KEY, JSON.stringify(merged));
    return merged;
  });
}
