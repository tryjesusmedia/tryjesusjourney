-- Editable, uniquely numbered principle groups shared by both reading-plan pages.
-- Existing principles remain unchanged and begin as single-principle windows.

alter table public.conflict_principles
  add column if not exists group_id uuid;

create index if not exists conflict_principles_group_idx
  on public.conflict_principles (user_id, plan_id, group_id)
  where group_id is not null;

drop function if exists public.create_conflict_principle(text, text, text, integer[]);

create or replace function public.create_conflict_principle(
  p_plan_id text,
  p_reading_id text,
  p_body text,
  p_cross_reference_numbers integer[] default '{}',
  p_principle_number integer default null
)
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  chosen_number integer;
  created public.conflict_principles;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_plan_id = 'bible-conflict-ages-v1' then
    if p_reading_id !~ '^coa-[0-9]{3}$' then raise exception 'Unknown reading'; end if;
  elsif p_plan_id = 'chronological-bible-order-v3' then
    if p_reading_id !~ '^chron-[0-9]{3}-[0-9]{2}$' then raise exception 'Unknown reading'; end if;
  else
    raise exception 'Unknown reading plan';
  end if;
  if char_length(trim(p_body)) < 1 or char_length(trim(p_body)) > 2000 then
    raise exception 'Principle must be between 1 and 2000 characters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_plan_id, 0));

  select coalesce(p_principle_number, coalesce(max(principle_number), 0) + 1)
    into chosen_number
  from public.conflict_principles
  where user_id = current_user_id and plan_id = p_plan_id;

  if chosen_number is null or chosen_number < 1 then
    raise exception 'Principle number must be a whole number greater than zero';
  end if;
  if exists (
    select 1 from public.conflict_principles
    where user_id = current_user_id and plan_id = p_plan_id and principle_number = chosen_number
  ) then
    raise exception 'Principle #% is already in use', chosen_number;
  end if;
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

  insert into public.conflict_principles (
    user_id, plan_id, reading_id, principle_number, body, cross_reference_numbers
  ) values (
    current_user_id,
    p_plan_id,
    p_reading_id,
    chosen_number,
    trim(p_body),
    array(select distinct ref.number from unnest(coalesce(p_cross_reference_numbers, '{}')) as ref(number) order by ref.number)
  ) returning * into created;

  return next created;
end;
$$;

create or replace function public.update_conflict_principle(
  p_principle_id uuid,
  p_principle_number integer,
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
  existing public.conflict_principles;
  old_number integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  select * into existing
  from public.conflict_principles
  where id = p_principle_id and user_id = current_user_id;
  if not found then raise exception 'Principle not found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || existing.plan_id, 0));
  old_number := existing.principle_number;

  if p_principle_number is null or p_principle_number < 1 then
    raise exception 'Principle number must be a whole number greater than zero';
  end if;
  if char_length(trim(p_body)) < 1 or char_length(trim(p_body)) > 2000 then
    raise exception 'Principle must be between 1 and 2000 characters';
  end if;
  if exists (
    select 1 from public.conflict_principles other
    where other.user_id = current_user_id
      and other.plan_id = existing.plan_id
      and other.id <> p_principle_id
      and other.principle_number = p_principle_number
  ) then
    raise exception 'Principle #% is already in use', p_principle_number;
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_cross_reference_numbers, '{}')) as requested(number)
    where requested.number <= 0
      or not (
        requested.number = p_principle_number
        or exists (
          select 1 from public.conflict_principles other
          where other.user_id = current_user_id
            and other.plan_id = existing.plan_id
            and other.id <> p_principle_id
            and other.principle_number = requested.number
        )
      )
  ) then
    raise exception 'Every cross-reference must identify one of your existing principles';
  end if;

  if old_number <> p_principle_number then
    update public.conflict_principles principle
    set cross_reference_numbers = array(
      select distinct case when ref.number = old_number then p_principle_number else ref.number end
      from unnest(principle.cross_reference_numbers) as ref(number)
      order by 1
    )
    where principle.user_id = current_user_id
      and principle.plan_id = existing.plan_id
      and old_number = any(principle.cross_reference_numbers);
  end if;

  update public.conflict_principles
  set principle_number = p_principle_number,
      body = trim(p_body),
      cross_reference_numbers = array(
        select distinct ref.number
        from unnest(coalesce(p_cross_reference_numbers, '{}')) as ref(number)
        order by ref.number
      )
  where id = p_principle_id and user_id = current_user_id;

  return query
    select * from public.conflict_principles
    where user_id = current_user_id and plan_id = existing.plan_id
    order by principle_number;
end;
$$;

create or replace function public.move_conflict_principle(
  p_principle_id uuid,
  p_target_principle_id uuid default null,
  p_standalone boolean default false
)
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  source_principle public.conflict_principles;
  target_principle public.conflict_principles;
  destination_group uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  select * into source_principle
  from public.conflict_principles
  where id = p_principle_id and user_id = current_user_id;
  if not found then raise exception 'Principle not found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || source_principle.plan_id, 0));

  if coalesce(p_standalone, false) then
    update public.conflict_principles set group_id = null
    where id = p_principle_id and user_id = current_user_id;
  else
    if p_target_principle_id is null or p_target_principle_id = p_principle_id then
      raise exception 'Choose a different principle group';
    end if;
    select * into target_principle
    from public.conflict_principles
    where id = p_target_principle_id
      and user_id = current_user_id
      and plan_id = source_principle.plan_id;
    if not found then raise exception 'The destination principle was not found'; end if;

    destination_group := coalesce(target_principle.group_id, gen_random_uuid());
    if target_principle.group_id is null then
      update public.conflict_principles set group_id = destination_group
      where id = target_principle.id and user_id = current_user_id;
    end if;
    update public.conflict_principles set group_id = destination_group
    where id = source_principle.id and user_id = current_user_id;
  end if;

  return query
    select * from public.conflict_principles
    where user_id = current_user_id and plan_id = source_principle.plan_id
    order by principle_number;
end;
$$;

create or replace function public.bulk_update_conflict_principles(
  p_plan_id text,
  p_updates jsonb
)
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  temporary_offset integer;
  expected_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_plan_id not in ('bible-conflict-ages-v1', 'chronological-bible-order-v3') then
    raise exception 'Unknown reading plan';
  end if;
  if jsonb_typeof(p_updates) <> 'array' then raise exception 'Spreadsheet updates must be a list'; end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_plan_id, 0));

  drop table if exists pg_temp.tjm_principle_updates;
  create temporary table pg_temp.tjm_principle_updates (
    id uuid primary key,
    old_number integer,
    new_number integer not null,
    body text not null
  ) on commit drop;

  insert into pg_temp.tjm_principle_updates (id, new_number, body)
  select (item ->> 'id')::uuid,
         (item ->> 'principle_number')::integer,
         trim(item ->> 'body')
  from jsonb_array_elements(p_updates) as item;

  select count(*) into expected_count
  from public.conflict_principles
  where user_id = current_user_id and plan_id = p_plan_id;

  if (select count(*) from pg_temp.tjm_principle_updates) <> expected_count then
    raise exception 'The spreadsheet must contain every saved principle exactly once';
  end if;
  if exists (
    select 1 from pg_temp.tjm_principle_updates updates
    left join public.conflict_principles principle
      on principle.id = updates.id
      and principle.user_id = current_user_id
      and principle.plan_id = p_plan_id
    where principle.id is null
  ) then
    raise exception 'The spreadsheet contains a principle from another account or reading plan';
  end if;
  if exists (
    select 1 from pg_temp.tjm_principle_updates
    where new_number < 1 or char_length(body) < 1 or char_length(body) > 2000
  ) then
    raise exception 'Every row needs a positive whole number and a principle of 1 to 2000 characters';
  end if;
  if exists (
    select new_number from pg_temp.tjm_principle_updates
    group by new_number having count(*) > 1
  ) then
    raise exception 'Every principle number must be unique';
  end if;

  update pg_temp.tjm_principle_updates updates
  set old_number = principle.principle_number
  from public.conflict_principles principle
  where principle.id = updates.id
    and principle.user_id = current_user_id
    and principle.plan_id = p_plan_id;

  update public.conflict_principles principle
  set cross_reference_numbers = array(
    select distinct coalesce(updates.new_number, ref.number)
    from unnest(principle.cross_reference_numbers) as ref(number)
    left join pg_temp.tjm_principle_updates updates on updates.old_number = ref.number
    order by 1
  )
  where principle.user_id = current_user_id and principle.plan_id = p_plan_id;

  select coalesce(max(principle_number), 0)
       + coalesce((select max(new_number) from pg_temp.tjm_principle_updates), 0)
       + 1000
    into temporary_offset
  from public.conflict_principles
  where user_id = current_user_id and plan_id = p_plan_id;

  update public.conflict_principles principle
  set principle_number = updates.old_number + temporary_offset
  from pg_temp.tjm_principle_updates updates
  where principle.id = updates.id
    and principle.user_id = current_user_id
    and principle.plan_id = p_plan_id;

  update public.conflict_principles principle
  set principle_number = updates.new_number,
      body = updates.body
  from pg_temp.tjm_principle_updates updates
  where principle.id = updates.id
    and principle.user_id = current_user_id
    and principle.plan_id = p_plan_id;

  return query
    select * from public.conflict_principles
    where user_id = current_user_id and plan_id = p_plan_id
    order by principle_number;
end;
$$;

revoke all on function public.create_conflict_principle(text, text, text, integer[], integer) from public, anon;
revoke all on function public.update_conflict_principle(uuid, integer, text, integer[]) from public, anon;
revoke all on function public.move_conflict_principle(uuid, uuid, boolean) from public, anon;
revoke all on function public.bulk_update_conflict_principles(text, jsonb) from public, anon;

grant execute on function public.create_conflict_principle(text, text, text, integer[], integer) to authenticated;
grant execute on function public.update_conflict_principle(uuid, integer, text, integer[]) to authenticated;
grant execute on function public.move_conflict_principle(uuid, uuid, boolean) to authenticated;
grant execute on function public.bulk_update_conflict_principles(text, jsonb) to authenticated;
