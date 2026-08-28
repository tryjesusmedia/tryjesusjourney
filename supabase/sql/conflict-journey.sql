-- The Bible & Conflict of the Ages Journey
-- Shared Supabase data model for tryjesusmedia.com and Try Jesus: The Journey.
-- Safe to run more than once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.conflict_journey_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  start_date date not null default current_date,
  schedule_mode text not null default 'pace' check (schedule_mode in ('pace', 'calendar')),
  last_reading_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

create table if not exists public.conflict_reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  reading_id text not null,
  bible_complete boolean not null default false,
  commentary_complete boolean not null default false,
  bible_opened_at timestamptz,
  commentary_opened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id, reading_id)
);

create table if not exists public.conflict_principles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  reading_id text not null,
  principle_number integer not null check (principle_number > 0),
  body text not null check (char_length(body) between 1 and 2000),
  cross_reference_numbers integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_id, principle_number)
);

create table if not exists public.conflict_discussion_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  reading_id text not null,
  principle_id uuid references public.conflict_principles(id) on delete set null,
  principle_number integer,
  principle_body text check (principle_body is null or char_length(principle_body) <= 2000),
  body text not null check (char_length(body) between 3 and 2000),
  author_name text not null check (char_length(author_name) between 1 and 120),
  author_avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conflict_discussion_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.conflict_discussion_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  author_name text not null check (char_length(author_name) between 1 and 120),
  author_avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conflict_progress_plan_idx
  on public.conflict_reading_progress (plan_id, reading_id);
create index if not exists conflict_principles_user_idx
  on public.conflict_principles (user_id, plan_id, principle_number);
create index if not exists conflict_posts_plan_created_idx
  on public.conflict_discussion_posts (plan_id, created_at desc);
create index if not exists conflict_replies_post_created_idx
  on public.conflict_discussion_replies (post_id, created_at);

create or replace function public.touch_conflict_journey_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Discussion identity comes from the authenticated Google profile, not editable client fields.
create or replace function public.set_conflict_discussion_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  metadata jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
begin
  new.user_id = auth.uid();
  new.author_name = left(coalesce(nullif(metadata ->> 'full_name', ''), nullif(metadata ->> 'name', ''), 'Try Jesus member'), 120);
  new.author_avatar_url = coalesce(nullif(metadata ->> 'avatar_url', ''), nullif(metadata ->> 'picture', ''));
  return new;
end;
$$;

drop trigger if exists conflict_settings_touch on public.conflict_journey_settings;
create trigger conflict_settings_touch before update on public.conflict_journey_settings
for each row execute function public.touch_conflict_journey_updated_at();
drop trigger if exists conflict_progress_touch on public.conflict_reading_progress;
create trigger conflict_progress_touch before update on public.conflict_reading_progress
for each row execute function public.touch_conflict_journey_updated_at();
drop trigger if exists conflict_principles_touch on public.conflict_principles;
create trigger conflict_principles_touch before update on public.conflict_principles
for each row execute function public.touch_conflict_journey_updated_at();
drop trigger if exists conflict_posts_touch on public.conflict_discussion_posts;
create trigger conflict_posts_touch before update on public.conflict_discussion_posts
for each row execute function public.touch_conflict_journey_updated_at();
drop trigger if exists conflict_replies_touch on public.conflict_discussion_replies;
create trigger conflict_replies_touch before update on public.conflict_discussion_replies
for each row execute function public.touch_conflict_journey_updated_at();
drop trigger if exists conflict_posts_identity on public.conflict_discussion_posts;
create trigger conflict_posts_identity before insert or update on public.conflict_discussion_posts
for each row execute function public.set_conflict_discussion_identity();
drop trigger if exists conflict_replies_identity on public.conflict_discussion_replies;
create trigger conflict_replies_identity before insert or update on public.conflict_discussion_replies
for each row execute function public.set_conflict_discussion_identity();

alter table public.conflict_journey_settings enable row level security;
alter table public.conflict_reading_progress enable row level security;
alter table public.conflict_principles enable row level security;
alter table public.conflict_discussion_posts enable row level security;
alter table public.conflict_discussion_replies enable row level security;

drop policy if exists "Members manage own conflict settings" on public.conflict_journey_settings;
create policy "Members manage own conflict settings" on public.conflict_journey_settings
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Members manage own conflict progress" on public.conflict_reading_progress;
create policy "Members manage own conflict progress" on public.conflict_reading_progress
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Members read own conflict principles" on public.conflict_principles;
create policy "Members read own conflict principles" on public.conflict_principles
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Members update own conflict principles" on public.conflict_principles;
create policy "Members update own conflict principles" on public.conflict_principles
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Members delete own conflict principles" on public.conflict_principles;
create policy "Members delete own conflict principles" on public.conflict_principles
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Members read conflict discussion posts" on public.conflict_discussion_posts;
create policy "Members read conflict discussion posts" on public.conflict_discussion_posts
for select to authenticated using (true);
drop policy if exists "Members create own conflict discussion posts" on public.conflict_discussion_posts;
create policy "Members create own conflict discussion posts" on public.conflict_discussion_posts
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Members update own conflict discussion posts" on public.conflict_discussion_posts;
create policy "Members update own conflict discussion posts" on public.conflict_discussion_posts
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Members delete own conflict discussion posts" on public.conflict_discussion_posts;
create policy "Members delete own conflict discussion posts" on public.conflict_discussion_posts
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Members read conflict discussion replies" on public.conflict_discussion_replies;
create policy "Members read conflict discussion replies" on public.conflict_discussion_replies
for select to authenticated using (true);
drop policy if exists "Members create own conflict discussion replies" on public.conflict_discussion_replies;
create policy "Members create own conflict discussion replies" on public.conflict_discussion_replies
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Members update own conflict discussion replies" on public.conflict_discussion_replies;
create policy "Members update own conflict discussion replies" on public.conflict_discussion_replies
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Members delete own conflict discussion replies" on public.conflict_discussion_replies;
create policy "Members delete own conflict discussion replies" on public.conflict_discussion_replies
for delete to authenticated using (auth.uid() = user_id);

-- Allocates a user's permanent principle numbers atomically across web and mobile.
create or replace function public.create_conflict_principle(
  p_plan_id text,
  p_reading_id text,
  p_body text,
  p_cross_reference_numbers integer[] default '{}'
)
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  next_number integer;
  created public.conflict_principles;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_plan_id <> 'bible-conflict-ages-v1' then
    raise exception 'Unknown reading plan';
  end if;
  if p_reading_id !~ '^coa-[0-9]{3}$' then
    raise exception 'Unknown reading';
  end if;
  if char_length(trim(p_body)) < 1 or char_length(trim(p_body)) > 2000 then
    raise exception 'Principle must be between 1 and 2000 characters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_plan_id, 0));

  if exists (
    select 1
    from unnest(coalesce(p_cross_reference_numbers, '{}')) as requested(number)
    where requested.number <= 0
      or not exists (
        select 1 from public.conflict_principles existing
        where existing.user_id = current_user_id
          and existing.plan_id = p_plan_id
          and existing.principle_number = requested.number
      )
  ) then
    raise exception 'Every cross-reference must identify one of your existing principles';
  end if;

  select coalesce(max(principle_number), 0) + 1 into next_number
  from public.conflict_principles
  where user_id = current_user_id and plan_id = p_plan_id;

  insert into public.conflict_principles (
    user_id, plan_id, reading_id, principle_number, body, cross_reference_numbers
  ) values (
    current_user_id,
    p_plan_id,
    p_reading_id,
    next_number,
    trim(p_body),
    array(select distinct ref.number from unnest(coalesce(p_cross_reference_numbers, '{}')) as ref(number) order by ref.number)
  ) returning * into created;

  return next created;
end;
$$;

revoke all on function public.create_conflict_principle(text, text, text, integer[]) from public;
revoke all on function public.create_conflict_principle(text, text, text, integer[]) from anon;
grant execute on function public.create_conflict_principle(text, text, text, integer[]) to authenticated;

grant select, insert, update, delete on public.conflict_journey_settings to authenticated;
grant select, insert, update, delete on public.conflict_reading_progress to authenticated;
grant select, update, delete on public.conflict_principles to authenticated;
grant select, insert, update, delete on public.conflict_discussion_posts to authenticated;
grant select, insert, update, delete on public.conflict_discussion_replies to authenticated;
