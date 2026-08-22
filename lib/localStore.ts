import AsyncStorage from '@react-native-async-storage/async-storage';

export type GuestProgress = {
  lessonUrl: string;
  progressPercent: number;
  updatedAt: string;
};

const PROGRESS_KEY = 'tryjesus_guest_progress';
const JOURNAL_KEY = 'tryjesus_guest_journal';

export async function getGuestProgress(): Promise<GuestProgress | null> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveGuestProgress(progress: GuestProgress) {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export type GuestJournal = { id: string; title: string; body: string; createdAt: string };

export async function getGuestJournal(): Promise<GuestJournal[]> {
  const raw = await AsyncStorage.getItem(JOURNAL_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveGuestJournal(entries: GuestJournal[]) {
  await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}
