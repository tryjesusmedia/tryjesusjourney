-- Try Jesus: The Journey native app upgrade
-- Adds the chronological reading-plan sync and Ask Pastor Kal organized knowledge system.

create table if not exists public.reading_plan_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  completed_indices integer[] not null default '{}',
  last_index integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

alter table public.reading_plan_progress enable row level security;

drop policy if exists "Users can read their reading plan" on public.reading_plan_progress;
create policy "Users can read their reading plan"
on public.reading_plan_progress for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their reading plan" on public.reading_plan_progress;
create policy "Users can create their reading plan"
on public.reading_plan_progress for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their reading plan" on public.reading_plan_progress;
create policy "Users can update their reading plan"
on public.reading_plan_progress for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Organized Ask Pastor Kal knowledge source catalog.
create table if not exists public.pastor_kal_sources (
  id bigint generated always as identity primary key,
  collection text not null default 'Try Jesus Media',
  title text not null,
  source_type text not null default 'bible_guide',
  source_url text,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Knowledge is deliberately separated into source / category / topic / chunk so
-- the mobile app can use the same organized retrieval pattern as the website chatbot.
create table if not exists public.pastor_kal_knowledge (
  id bigint generated always as identity primary key,
  source_id bigint references public.pastor_kal_sources(id) on delete set null,
  collection text not null default 'Bible Guides',
  category text not null default 'General',
  topic text not null,
  question text,
  content text not null,
  scripture_refs text[] not null default '{}',
  keywords text[] not null default '{}',
  priority integer not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(collection, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(topic, '') || ' ' ||
      coalesce(question, '') || ' ' ||
      coalesce(content, '') || ' ' ||
      coalesce(array_to_string(scripture_refs, ' '), '') || ' ' ||
      coalesce(array_to_string(keywords, ' '), '')
    )
  ) stored
);

create index if not exists pastor_kal_knowledge_search_idx
on public.pastor_kal_knowledge using gin(search_document);

create index if not exists pastor_kal_knowledge_topic_idx
on public.pastor_kal_knowledge(category, topic, priority desc, sort_order);

-- No direct public read policy is intentionally created for the knowledge base.
-- The server-side Edge Function retrieves it using the project's secret key.
alter table public.pastor_kal_sources enable row level security;
alter table public.pastor_kal_knowledge enable row level security;

create or replace function public.search_pastor_kal_knowledge(
  search_query text,
  match_count integer default 8
)
returns table (
  id bigint,
  source_id bigint,
  collection text,
  category text,
  topic text,
  question text,
  content text,
  scripture_refs text[],
  keywords text[],
  source_title text,
  source_url text,
  score real
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('english', search_query) as query
  )
  select
    k.id,
    k.source_id,
    k.collection,
    k.category,
    k.topic,
    k.question,
    k.content,
    k.scripture_refs,
    k.keywords,
    s.title as source_title,
    s.source_url,
    (
      ts_rank_cd(k.search_document, q.query) +
      (greatest(k.priority, 0)::real * 0.01)
    )::real as score
  from public.pastor_kal_knowledge k
  left join public.pastor_kal_sources s on s.id = k.source_id
  cross join q
  where k.active = true
    and (s.active is distinct from false)
    and k.search_document @@ q.query
  order by score desc, k.priority desc, k.sort_order asc
  limit greatest(1, least(match_count, 20));
$$;

-- Signed-in users can sync their Ask Pastor Kal history.
create table if not exists public.pastor_kal_chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.pastor_kal_chat_messages enable row level security;

drop policy if exists "Users can read their Pastor Kal chat" on public.pastor_kal_chat_messages;
create policy "Users can read their Pastor Kal chat"
on public.pastor_kal_chat_messages for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their Pastor Kal chat" on public.pastor_kal_chat_messages;
create policy "Users can create their Pastor Kal chat"
on public.pastor_kal_chat_messages for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their Pastor Kal chat" on public.pastor_kal_chat_messages;
create policy "Users can delete their Pastor Kal chat"
on public.pastor_kal_chat_messages for delete
using (auth.uid() = user_id);

-- Keep retrieval server-side. The Edge Function's secret/service role can execute it;
-- normal mobile clients cannot query the private knowledge database directly.
revoke all on function public.search_pastor_kal_knowledge(text, integer) from public;
revoke all on function public.search_pastor_kal_knowledge(text, integer) from anon;
revoke all on function public.search_pastor_kal_knowledge(text, integer) from authenticated;
grant execute on function public.search_pastor_kal_knowledge(text, integer) to service_role;
