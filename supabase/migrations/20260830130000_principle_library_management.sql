-- A safer, more navigable Principles library for both reading journeys.
-- Group names are repeated on members so existing UUID-only groups remain compatible.

alter table public.conflict_principles
  add column if not exists group_title text,
  add column if not exists deleted_at timestamptz;

alter table public.conflict_principles
  drop constraint if exists conflict_principles_group_title_length;
alter table public.conflict_principles
  add constraint conflict_principles_group_title_length
  check (group_title is null or char_length(group_title) <= 80);

create index if not exists conflict_principles_deleted_idx
  on public.conflict_principles (user_id, plan_id, deleted_at)
  where deleted_at is not null;

create or replace function public.move_conflict_principles(
  p_principle_ids uuid[],
  p_target_principle_id uuid default null,
  p_mode text default 'standalone',
  p_group_title text default null
)
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_ids uuid[];
  source_plan text;
  source_count integer;
  target_principle public.conflict_principles;
  destination_group uuid;
  destination_title text;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('standalone', 'existing', 'new') then raise exception 'Unknown move choice'; end if;

  select array_agg(distinct id) into cleaned_ids from unnest(coalesce(p_principle_ids, '{}')) as selected(id);
  if coalesce(cardinality(cleaned_ids), 0) = 0 then raise exception 'Choose at least one principle'; end if;

  select min(plan_id), count(*) into source_plan, source_count
  from public.conflict_principles
  where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is null;
  if source_count <> cardinality(cleaned_ids) then raise exception 'One or more principles could not be moved'; end if;
  if (select count(distinct plan_id) from public.conflict_principles where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is null) <> 1 then
    raise exception 'Selected principles must be from one reading plan';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || source_plan, 0));

  if p_mode = 'standalone' then
    update public.conflict_principles
    set group_id = null, group_title = null
    where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is null;
  elsif p_mode = 'new' then
    destination_group := gen_random_uuid();
    destination_title := nullif(trim(coalesce(p_group_title, '')), '');
    update public.conflict_principles
    set group_id = destination_group, group_title = destination_title
    where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is null;
  else
    if p_target_principle_id is null or p_target_principle_id = any(cleaned_ids) then
      raise exception 'Choose a different principle group';
    end if;
    select * into target_principle
    from public.conflict_principles
    where id = p_target_principle_id
      and user_id = current_user_id
      and plan_id = source_plan
      and deleted_at is null;
    if not found then raise exception 'The destination principle was not found'; end if;

    destination_group := coalesce(target_principle.group_id, gen_random_uuid());
    destination_title := target_principle.group_title;
    if target_principle.group_id is null then
      update public.conflict_principles
      set group_id = destination_group, group_title = destination_title
      where id = target_principle.id and user_id = current_user_id;
    end if;
    update public.conflict_principles
    set group_id = destination_group, group_title = destination_title
    where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is null;
  end if;

  return query
    select * from public.conflict_principles
    where user_id = current_user_id and plan_id = source_plan and deleted_at is null
    order by principle_number;
end;
$$;

create or replace function public.rename_conflict_principle_group(
  p_group_id uuid,
  p_title text default null
)
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  group_plan text;
  clean_title text := nullif(trim(coalesce(p_title, '')), '');
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(coalesce(clean_title, '')) > 80 then raise exception 'A group name can be up to 80 characters'; end if;
  select plan_id into group_plan from public.conflict_principles
  where group_id = p_group_id and user_id = current_user_id limit 1;
  if not found then raise exception 'Group not found'; end if;
  update public.conflict_principles set group_title = clean_title
  where group_id = p_group_id and user_id = current_user_id and plan_id = group_plan;
  return query select * from public.conflict_principles
    where user_id = current_user_id and plan_id = group_plan and deleted_at is null
    order by principle_number;
end;
$$;

create or replace function public.dissolve_conflict_principle_group(p_group_id uuid)
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  group_plan text;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select plan_id into group_plan from public.conflict_principles
  where group_id = p_group_id and user_id = current_user_id limit 1;
  if not found then raise exception 'Group not found'; end if;
  update public.conflict_principles set group_id = null, group_title = null
  where group_id = p_group_id and user_id = current_user_id and plan_id = group_plan;
  return query select * from public.conflict_principles
    where user_id = current_user_id and plan_id = group_plan and deleted_at is null
    order by principle_number;
end;
$$;

create or replace function public.soft_delete_conflict_principles(p_principle_ids uuid[])
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_ids uuid[];
  source_plan text;
  source_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select array_agg(distinct id) into cleaned_ids from unnest(coalesce(p_principle_ids, '{}')) as selected(id);
  if coalesce(cardinality(cleaned_ids), 0) = 0 then raise exception 'Choose at least one principle'; end if;
  select min(plan_id), count(*) into source_plan, source_count from public.conflict_principles
  where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is null;
  if source_count <> cardinality(cleaned_ids) then raise exception 'One or more principles could not be deleted'; end if;
  if (select count(distinct plan_id) from public.conflict_principles where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is null) <> 1 then
    raise exception 'Selected principles must be from one reading plan';
  end if;
  update public.conflict_principles set deleted_at = now()
  where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is null;
  return query select * from public.conflict_principles
    where user_id = current_user_id and plan_id = source_plan and deleted_at is null
    order by principle_number;
end;
$$;

create or replace function public.restore_conflict_principles(p_principle_ids uuid[])
returns setof public.conflict_principles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_ids uuid[];
  source_plan text;
  source_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select array_agg(distinct id) into cleaned_ids from unnest(coalesce(p_principle_ids, '{}')) as selected(id);
  if coalesce(cardinality(cleaned_ids), 0) = 0 then raise exception 'Choose at least one principle'; end if;
  select min(plan_id), count(*) into source_plan, source_count from public.conflict_principles
  where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is not null;
  if source_count <> cardinality(cleaned_ids) then raise exception 'One or more principles could not be restored'; end if;
  if (select count(distinct plan_id) from public.conflict_principles where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is not null) <> 1 then
    raise exception 'Selected principles must be from one reading plan';
  end if;
  update public.conflict_principles set deleted_at = null
  where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is not null;
  return query select * from public.conflict_principles
    where user_id = current_user_id and plan_id = source_plan and deleted_at is null
    order by principle_number;
end;
$$;

create or replace function public.hard_delete_conflict_principles(p_principle_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_ids uuid[];
  source_plan text;
  removed_numbers integer[];
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select array_agg(distinct id) into cleaned_ids from unnest(coalesce(p_principle_ids, '{}')) as selected(id);
  if coalesce(cardinality(cleaned_ids), 0) = 0 then raise exception 'Choose at least one principle'; end if;
  select min(plan_id), array_agg(principle_number) into source_plan, removed_numbers
  from public.conflict_principles
  where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is not null;
  if coalesce(cardinality(removed_numbers), 0) <> cardinality(cleaned_ids) then
    raise exception 'Only Recently Deleted principles can be deleted forever';
  end if;
  delete from public.conflict_principles
  where id = any(cleaned_ids) and user_id = current_user_id and deleted_at is not null;
  update public.conflict_principles principle
  set cross_reference_numbers = array(
    select ref.number from unnest(principle.cross_reference_numbers) as ref(number)
    where not (ref.number = any(removed_numbers)) order by ref.number
  )
  where principle.user_id = current_user_id and principle.plan_id = source_plan
    and principle.cross_reference_numbers && removed_numbers;
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
  if p_plan_id not in ('bible-conflict-ages-v1', 'chronological-bible-order-v3') then raise exception 'Unknown reading plan'; end if;
  if jsonb_typeof(p_updates) <> 'array' then raise exception 'Spreadsheet updates must be a list'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_plan_id, 0));

  select count(*) into expected_count from public.conflict_principles
  where user_id = current_user_id and plan_id = p_plan_id and deleted_at is null;
  if jsonb_array_length(p_updates) <> expected_count then raise exception 'The spreadsheet must contain every active saved principle exactly once'; end if;
  if exists (
    with updates as (select (item ->> 'id')::uuid as id from jsonb_array_elements(p_updates) as item)
    select id from updates group by id having count(*) > 1
  ) then raise exception 'The spreadsheet contains a duplicated principle row'; end if;
  if exists (
    with updates as (select (item ->> 'id')::uuid as id from jsonb_array_elements(p_updates) as item)
    select 1 from updates left join public.conflict_principles principle
      on principle.id = updates.id and principle.user_id = current_user_id and principle.plan_id = p_plan_id and principle.deleted_at is null
    where principle.id is null
  ) then raise exception 'The spreadsheet contains a principle from another account, reading plan, or Recently Deleted'; end if;
  if exists (
    with updates as (select (item ->> 'principle_number')::integer as new_number, trim(item ->> 'body') as body from jsonb_array_elements(p_updates) as item)
    select 1 from updates where new_number < 1 or char_length(body) < 1 or char_length(body) > 2000
  ) then raise exception 'Every row needs a positive whole number and a principle of 1 to 2000 characters'; end if;
  if exists (
    with updates as (select (item ->> 'principle_number')::integer as new_number from jsonb_array_elements(p_updates) as item)
    select new_number from updates group by new_number having count(*) > 1
  ) then raise exception 'Every principle number must be unique'; end if;
  if exists (
    with updates as (select (item ->> 'principle_number')::integer as new_number from jsonb_array_elements(p_updates) as item)
    select 1 from updates join public.conflict_principles deleted
      on deleted.user_id = current_user_id and deleted.plan_id = p_plan_id and deleted.deleted_at is not null and deleted.principle_number = updates.new_number
  ) then raise exception 'A spreadsheet number is reserved by a principle in Recently Deleted'; end if;

  update public.conflict_principles principle
  set cross_reference_numbers = array(
    select distinct coalesce(number_changes.new_number, ref.number)
    from unnest(principle.cross_reference_numbers) as ref(number)
    left join (
      select saved.principle_number as old_number, (item ->> 'principle_number')::integer as new_number
      from jsonb_array_elements(p_updates) as item
      join public.conflict_principles saved on saved.id = (item ->> 'id')::uuid
      where saved.user_id = current_user_id and saved.plan_id = p_plan_id and saved.deleted_at is null
    ) as number_changes on number_changes.old_number = ref.number order by 1
  )
  where principle.user_id = current_user_id and principle.plan_id = p_plan_id;

  select coalesce(max(principle_number), 0)
       + coalesce((select max((item ->> 'principle_number')::integer) from jsonb_array_elements(p_updates) as item), 0) + 1000
    into temporary_offset from public.conflict_principles
    where user_id = current_user_id and plan_id = p_plan_id;

  update public.conflict_principles principle
  set principle_number = principle.principle_number + temporary_offset
  from jsonb_array_elements(p_updates) as item
  where principle.id = (item ->> 'id')::uuid and principle.user_id = current_user_id
    and principle.plan_id = p_plan_id and principle.deleted_at is null;

  update public.conflict_principles principle
  set principle_number = (item ->> 'principle_number')::integer, body = trim(item ->> 'body')
  from jsonb_array_elements(p_updates) as item
  where principle.id = (item ->> 'id')::uuid and principle.user_id = current_user_id
    and principle.plan_id = p_plan_id and principle.deleted_at is null;

  return query select * from public.conflict_principles
    where user_id = current_user_id and plan_id = p_plan_id and deleted_at is null
    order by principle_number;
end;
$$;

revoke all on function public.move_conflict_principles(uuid[], uuid, text, text) from public, anon;
revoke all on function public.rename_conflict_principle_group(uuid, text) from public, anon;
revoke all on function public.dissolve_conflict_principle_group(uuid) from public, anon;
revoke all on function public.soft_delete_conflict_principles(uuid[]) from public, anon;
revoke all on function public.restore_conflict_principles(uuid[]) from public, anon;
revoke all on function public.hard_delete_conflict_principles(uuid[]) from public, anon;
revoke all on function public.bulk_update_conflict_principles(text, jsonb) from public, anon;

grant execute on function public.move_conflict_principles(uuid[], uuid, text, text) to authenticated;
grant execute on function public.rename_conflict_principle_group(uuid, text) to authenticated;
grant execute on function public.dissolve_conflict_principle_group(uuid) to authenticated;
grant execute on function public.soft_delete_conflict_principles(uuid[]) to authenticated;
grant execute on function public.restore_conflict_principles(uuid[]) to authenticated;
grant execute on function public.hard_delete_conflict_principles(uuid[]) to authenticated;
grant execute on function public.bulk_update_conflict_principles(text, jsonb) to authenticated;
