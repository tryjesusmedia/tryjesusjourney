import { supabase } from '@/lib/supabase';
import planJson from '@/data/conflictPlan.json';

export const CONFLICT_PLAN_ID = 'bible-conflict-ages-v1';
export const CONFLICT_CHAPTER_PROGRESS_PLAN_ID = 'bible-conflict-ages-chapters-v1';

export type ConflictBibleTask = {
  label: string;
  reference: string;
  book: string;
  chapter: number;
  url: string;
};

export type ConflictCommentaryTask = {
  label: string;
  chapterNumber: number | null;
  title: string;
  paragraphId: number;
  url: string;
};

export type ConflictReading = {
  id: string;
  day: number;
  code: string;
  title: string;
  bibleReference: string;
  bibleUrl: string | null;
  bibleTasks: ConflictBibleTask[];
  commentaryBook: string;
  commentaryCode: string;
  commentaryCitation: string;
  commentaryUrl: string | null;
  commentaryTasks: ConflictCommentaryTask[];
  reviewNote: string | null;
  sourceEntry: string;
};

export type ConflictBook = {
  code: string;
  title: string;
  shortTitle: string;
  readingCount: number;
};

export type ConflictPlan = {
  planId: string;
  title: string;
  subtitle: string;
  books: ConflictBook[];
  readings: ConflictReading[];
  reviewQueue: { id: string; day: number; reviewNote: string }[];
};

export type ConflictProgress = {
  reading_id: string;
  bible_complete: boolean;
  commentary_complete: boolean;
  bible_opened_at?: string | null;
  commentary_opened_at?: string | null;
  completed_at?: string | null;
};

export type ConflictChapterProgress = {
  completed: number[];
  lastIndex: number;
};

export type ConflictSettings = {
  start_date: string;
  schedule_mode: 'pace' | 'calendar';
  last_reading_id: string | null;
};

export type ConflictPrinciple = {
  id: string;
  reading_id: string;
  principle_number: number;
  body: string;
  cross_reference_numbers: number[];
  created_at: string;
};

export type ConflictPost = {
  id: string;
  reading_id: string;
  principle_number?: number | null;
  principle_body?: string | null;
  body: string;
  author_name: string;
  author_avatar_url?: string | null;
  created_at: string;
};

export type ConflictReply = {
  id: string;
  post_id: string;
  body: string;
  author_name: string;
  created_at: string;
};

export type ConflictMemberData = {
  settings: ConflictSettings;
  progress: ConflictProgress[];
  chapterProgress: ConflictChapterProgress;
  principles: ConflictPrinciple[];
  posts: ConflictPost[];
  replies: ConflictReply[];
};

export const conflictPlan = planJson as ConflictPlan;

const taskProgressIndices = new Map<string, number>();
let taskProgressIndex = 0;
for (const reading of conflictPlan.readings) {
  reading.bibleTasks.forEach((_task, index) => taskProgressIndices.set(`${reading.id}:bible:${index}`, taskProgressIndex++));
  reading.commentaryTasks.forEach((_task, index) => taskProgressIndices.set(`${reading.id}:commentary:${index}`, taskProgressIndex++));
}
export const CONFLICT_CHAPTER_TASK_COUNT = taskProgressIndex;

export function conflictTaskProgressIndex(readingId: string, kind: 'bible' | 'commentary', taskIndex: number) {
  const index = taskProgressIndices.get(`${readingId}:${kind}:${taskIndex}`);
  if (index === undefined) throw new Error(`Missing chapter progress index for ${readingId}:${kind}:${taskIndex}`);
  return index;
}

export function isConflictTaskGroupComplete(reading: ConflictReading, kind: 'bible' | 'commentary', completed: ReadonlySet<number>) {
  const tasks = kind === 'bible' ? reading.bibleTasks : reading.commentaryTasks;
  const hasAssignment = kind === 'bible' ? reading.bibleReference : reading.commentaryCitation;
  return !hasAssignment || (tasks.length > 0 && tasks.every((_task, index) => completed.has(conflictTaskProgressIndex(reading.id, kind, index))));
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isConflictReadingComplete(reading: ConflictReading, saved?: ConflictProgress, chapterCompleted?: ReadonlySet<number>) {
  if (chapterCompleted) return isConflictTaskGroupComplete(reading, 'bible', chapterCompleted)
    && isConflictTaskGroupComplete(reading, 'commentary', chapterCompleted);
  return (!reading.bibleReference || Boolean(saved?.bible_complete))
    && (!reading.commentaryCitation || Boolean(saved?.commentary_complete));
}

export async function loadConflictMemberData(userId: string): Promise<ConflictMemberData> {
  const [progressResult, chapterProgressResult, settingsResult, principlesResult, postsResult, repliesResult] = await Promise.all([
    supabase.from('conflict_reading_progress').select('*').eq('user_id', userId).eq('plan_id', CONFLICT_PLAN_ID),
    supabase.from('reading_plan_progress').select('completed_indices,last_index').eq('user_id', userId).eq('plan_id', CONFLICT_CHAPTER_PROGRESS_PLAN_ID).maybeSingle(),
    supabase.from('conflict_journey_settings').select('*').eq('user_id', userId).eq('plan_id', CONFLICT_PLAN_ID).maybeSingle(),
    supabase.from('conflict_principles').select('*').eq('user_id', userId).eq('plan_id', CONFLICT_PLAN_ID).order('principle_number'),
    supabase.from('conflict_discussion_posts').select('*').eq('plan_id', CONFLICT_PLAN_ID).order('created_at', { ascending: false }).limit(100),
    supabase.from('conflict_discussion_replies').select('*').order('created_at', { ascending: true }).limit(500),
  ]);
  const error = [progressResult, chapterProgressResult, settingsResult, principlesResult, postsResult, repliesResult].find((result) => result.error)?.error;
  if (error) throw error;

  let settings = settingsResult.data as ConflictSettings | null;
  if (!settings) {
    const created = await supabase.from('conflict_journey_settings').insert({
      user_id: userId,
      plan_id: CONFLICT_PLAN_ID,
      start_date: todayISO(),
      schedule_mode: 'pace',
      last_reading_id: conflictPlan.readings[0].id,
    }).select().single();
    if (created.error) throw created.error;
    settings = created.data as ConflictSettings;
  }

  const legacyProgress = (progressResult.data ?? []) as ConflictProgress[];
  let chapterProgress: ConflictChapterProgress;
  if (chapterProgressResult.data) {
    const savedIndices: unknown[] = Array.isArray(chapterProgressResult.data.completed_indices) ? chapterProgressResult.data.completed_indices : [];
    chapterProgress = {
      completed: Array.from(new Set<number>(savedIndices.map(Number)))
        .filter((index) => Number.isInteger(index) && index >= 0 && index < CONFLICT_CHAPTER_TASK_COUNT)
        .sort((left, right) => left - right),
      lastIndex: Math.max(0, Math.min(Number(chapterProgressResult.data.last_index ?? 0), conflictPlan.readings.length - 1)),
    };
  } else {
    const legacyMap = new Map(legacyProgress.map((row) => [row.reading_id, row]));
    const migrated = new Set<number>();
    for (const reading of conflictPlan.readings) {
      const saved = legacyMap.get(reading.id);
      if (saved?.bible_complete) reading.bibleTasks.forEach((_task, index) => migrated.add(conflictTaskProgressIndex(reading.id, 'bible', index)));
      if (saved?.commentary_complete) reading.commentaryTasks.forEach((_task, index) => migrated.add(conflictTaskProgressIndex(reading.id, 'commentary', index)));
    }
    const lastIndex = Math.max(0, conflictPlan.readings.findIndex((reading) => reading.id === settings?.last_reading_id));
    chapterProgress = await saveConflictChapterProgress(userId, { completed: Array.from(migrated), lastIndex });
  }

  const posts = (postsResult.data ?? []) as ConflictPost[];
  const postIds = new Set(posts.map((post) => post.id));
  return {
    settings,
    progress: legacyProgress,
    chapterProgress,
    principles: (principlesResult.data ?? []) as ConflictPrinciple[],
    posts,
    replies: ((repliesResult.data ?? []) as ConflictReply[]).filter((reply) => postIds.has(reply.post_id)),
  };
}

export async function saveConflictChapterProgress(userId: string, progress: ConflictChapterProgress): Promise<ConflictChapterProgress> {
  const normalized = {
    completed: Array.from(new Set(progress.completed))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < CONFLICT_CHAPTER_TASK_COUNT)
      .sort((left, right) => left - right),
    lastIndex: Math.max(0, Math.min(progress.lastIndex, conflictPlan.readings.length - 1)),
  };
  const result = await supabase.from('reading_plan_progress').upsert({
    user_id: userId,
    plan_id: CONFLICT_CHAPTER_PROGRESS_PLAN_ID,
    completed_indices: normalized.completed,
    last_index: normalized.lastIndex,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,plan_id' });
  if (result.error) throw result.error;
  return normalized;
}

export async function saveConflictProgress(userId: string, reading: ConflictReading, next: ConflictProgress) {
  const completed = isConflictReadingComplete(reading, next);
  const result = await supabase.from('conflict_reading_progress').upsert({
    user_id: userId,
    plan_id: CONFLICT_PLAN_ID,
    reading_id: reading.id,
    bible_complete: Boolean(next.bible_complete),
    commentary_complete: Boolean(next.commentary_complete),
    bible_opened_at: next.bible_opened_at ?? null,
    commentary_opened_at: next.commentary_opened_at ?? null,
    completed_at: completed ? (next.completed_at ?? new Date().toISOString()) : null,
  }, { onConflict: 'user_id,plan_id,reading_id' }).select().single();
  if (result.error) throw result.error;
  return result.data as ConflictProgress;
}

export async function saveConflictSettings(userId: string, settings: ConflictSettings) {
  const result = await supabase.from('conflict_journey_settings').upsert({
    user_id: userId,
    plan_id: CONFLICT_PLAN_ID,
    ...settings,
  }, { onConflict: 'user_id,plan_id' }).select().single();
  if (result.error) throw result.error;
  return result.data as ConflictSettings;
}

export async function createConflictPrinciple(readingId: string, body: string, crossReferences: number[]) {
  const result = await supabase.rpc('create_conflict_principle', {
    p_plan_id: CONFLICT_PLAN_ID,
    p_reading_id: readingId,
    p_body: body,
    p_cross_reference_numbers: crossReferences,
  });
  if (result.error) throw result.error;
  return (Array.isArray(result.data) ? result.data[0] : result.data) as ConflictPrinciple;
}

export async function createConflictPost(input: {
  userId: string;
  readingId: string;
  body: string;
  authorName: string;
  authorAvatarUrl?: string;
  principle?: ConflictPrinciple;
}) {
  const result = await supabase.from('conflict_discussion_posts').insert({
    user_id: input.userId,
    plan_id: CONFLICT_PLAN_ID,
    reading_id: input.readingId,
    principle_id: input.principle?.id ?? null,
    principle_number: input.principle?.principle_number ?? null,
    principle_body: input.principle?.body ?? null,
    body: input.body,
    author_name: input.authorName,
    author_avatar_url: input.authorAvatarUrl ?? null,
  }).select().single();
  if (result.error) throw result.error;
  return result.data as ConflictPost;
}

export async function createConflictReply(input: { postId: string; userId: string; body: string; authorName: string; authorAvatarUrl?: string }) {
  const result = await supabase.from('conflict_discussion_replies').insert({
    post_id: input.postId,
    user_id: input.userId,
    body: input.body,
    author_name: input.authorName,
    author_avatar_url: input.authorAvatarUrl ?? null,
  }).select().single();
  if (result.error) throw result.error;
  return result.data as ConflictReply;
}
