import { supabase } from '@/lib/supabase';
import { CHRONOLOGICAL_PLAN_ID } from '@/lib/chronologicalProgress';

export type ChronologicalPrinciple = {
  id: string;
  reading_id: string;
  principle_number: number;
  body: string;
  cross_reference_numbers: number[];
  created_at: string;
};

export type ChronologicalPost = {
  id: string;
  reading_id: string;
  principle_number?: number | null;
  principle_body?: string | null;
  body: string;
  author_name: string;
  author_avatar_url?: string | null;
  created_at: string;
};

export type ChronologicalReply = {
  id: string;
  post_id: string;
  body: string;
  author_name: string;
  created_at: string;
};

export type ChronologicalCommunityData = {
  principles: ChronologicalPrinciple[];
  posts: ChronologicalPost[];
  replies: ChronologicalReply[];
};

export const emptyChronologicalCommunity: ChronologicalCommunityData = {
  principles: [],
  posts: [],
  replies: [],
};

export async function loadChronologicalCommunityData(userId: string): Promise<ChronologicalCommunityData> {
  const [principlesResult, postsResult, repliesResult] = await Promise.all([
    supabase.from('conflict_principles').select('*').eq('user_id', userId).eq('plan_id', CHRONOLOGICAL_PLAN_ID).order('principle_number'),
    supabase.from('conflict_discussion_posts').select('*').eq('plan_id', CHRONOLOGICAL_PLAN_ID).order('created_at', { ascending: false }).limit(100),
    supabase.from('conflict_discussion_replies').select('*').order('created_at', { ascending: true }).limit(500),
  ]);
  const error = [principlesResult, postsResult, repliesResult].find((result) => result.error)?.error;
  if (error) throw error;

  const posts = (postsResult.data ?? []) as ChronologicalPost[];
  const postIds = new Set(posts.map((post) => post.id));
  return {
    principles: (principlesResult.data ?? []) as ChronologicalPrinciple[],
    posts,
    replies: ((repliesResult.data ?? []) as ChronologicalReply[]).filter((reply) => postIds.has(reply.post_id)),
  };
}

export async function createChronologicalPrinciple(readingId: string, body: string, crossReferences: number[]) {
  const result = await supabase.rpc('create_conflict_principle', {
    p_plan_id: CHRONOLOGICAL_PLAN_ID,
    p_reading_id: readingId,
    p_body: body,
    p_cross_reference_numbers: crossReferences,
  });
  if (result.error) throw result.error;
  return (Array.isArray(result.data) ? result.data[0] : result.data) as ChronologicalPrinciple;
}

export async function createChronologicalPost(input: {
  userId: string;
  readingId: string;
  body: string;
  authorName: string;
  authorAvatarUrl?: string;
  principle?: ChronologicalPrinciple;
}) {
  const result = await supabase.from('conflict_discussion_posts').insert({
    user_id: input.userId,
    plan_id: CHRONOLOGICAL_PLAN_ID,
    reading_id: input.readingId,
    principle_id: input.principle?.id ?? null,
    principle_number: input.principle?.principle_number ?? null,
    principle_body: input.principle?.body ?? null,
    body: input.body,
    author_name: input.authorName,
    author_avatar_url: input.authorAvatarUrl ?? null,
  }).select().single();
  if (result.error) throw result.error;
  return result.data as ChronologicalPost;
}

export async function createChronologicalReply(input: {
  postId: string;
  userId: string;
  body: string;
  authorName: string;
  authorAvatarUrl?: string;
}) {
  const result = await supabase.from('conflict_discussion_replies').insert({
    post_id: input.postId,
    user_id: input.userId,
    body: input.body,
    author_name: input.authorName,
    author_avatar_url: input.authorAvatarUrl ?? null,
  }).select().single();
  if (result.error) throw result.error;
  return result.data as ChronologicalReply;
}
