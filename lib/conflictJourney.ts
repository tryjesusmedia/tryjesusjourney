import { supabase } from '@/lib/supabase';
import planJson from '@/data/conflictPlan.json';

export const CONFLICT_PLAN_ID = 'bible-conflict-ages-v1';

export type ConflictReading = {
  id: string;
  day: number;
  code: string;
  title: string;
  bibleReference: string;
  bibleUrl: string | null;
  commentaryBook: string;
  commentaryCode: string;
  commentaryCitation: string;
  commentaryUrl: string;
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
  principles: ConflictPrinciple[];
  posts: ConflictPost[];
  replies: ConflictReply[];
};

export const conflictPlan = planJson as ConflictPlan;

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isConflictReadingComplete(reading: ConflictReading, saved?: ConflictProgress) {
  return (!reading.bibleReference || Boolean(saved?.bible_complete))
    && (!reading.commentaryCitation || Boolean(saved?.commentary_complete));
}

export async function loadConflictMemberData(userId: string): Promise<ConflictMemberData> {
  const [progressResult, settingsResult, principlesResult, postsResult, repliesResult] = await Promise.all([
    supabase.from('conflict_reading_progress').select('*').eq('user_id', userId).eq('plan_id', CONFLICT_PLAN_ID),
    supabase.from('conflict_journey_settings').select('*').eq('user_id', userId).eq('plan_id', CONFLICT_PLAN_ID).maybeSingle(),
    supabase.from('conflict_principles').select('*').eq('user_id', userId).eq('plan_id', CONFLICT_PLAN_ID).order('principle_number'),
    supabase.from('conflict_discussion_posts').select('*').eq('plan_id', CONFLICT_PLAN_ID).order('created_at', { ascending: false }).limit(100),
    supabase.from('conflict_discussion_replies').select('*').order('created_at', { ascending: true }).limit(500),
  ]);
  const error = [progressResult, settingsResult, principlesResult, postsResult, repliesResult].find((result) => result.error)?.error;
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

  const posts = (postsResult.data ?? []) as ConflictPost[];
  const postIds = new Set(posts.map((post) => post.id));
  return {
    settings,
    progress: (progressResult.data ?? []) as ConflictProgress[],
    principles: (principlesResult.data ?? []) as ConflictPrinciple[],
    posts,
    replies: ((repliesResult.data ?? []) as ConflictReply[]).filter((reply) => postIds.has(reply.post_id)),
  };
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
