-- Keep spreadsheet imports lint-safe by deriving each update set directly from JSON.

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

  select count(*) into expected_count
  from public.conflict_principles
  where user_id = current_user_id and plan_id = p_plan_id;

  if jsonb_array_length(p_updates) <> expected_count then
    raise exception 'The spreadsheet must contain every saved principle exactly once';
  end if;
  if exists (
    with updates as (
      select (item ->> 'id')::uuid as id
      from jsonb_array_elements(p_updates) as item
    )
    select id from updates group by id having count(*) > 1
  ) then
    raise exception 'The spreadsheet contains a duplicated principle row';
  end if;
  if exists (
    with updates as (
      select (item ->> 'id')::uuid as id
      from jsonb_array_elements(p_updates) as item
    )
    select 1 from updates
    left join public.conflict_principles principle
      on principle.id = updates.id
      and principle.user_id = current_user_id
      and principle.plan_id = p_plan_id
    where principle.id is null
  ) then
    raise exception 'The spreadsheet contains a principle from another account or reading plan';
  end if;
  if exists (
    with updates as (
      select (item ->> 'principle_number')::integer as new_number,
             trim(item ->> 'body') as body
      from jsonb_array_elements(p_updates) as item
    )
    select 1 from updates
    where new_number < 1 or char_length(body) < 1 or char_length(body) > 2000
  ) then
    raise exception 'Every row needs a positive whole number and a principle of 1 to 2000 characters';
  end if;
  if exists (
    with updates as (
      select (item ->> 'principle_number')::integer as new_number
      from jsonb_array_elements(p_updates) as item
    )
    select new_number from updates group by new_number having count(*) > 1
  ) then
    raise exception 'Every principle number must be unique';
  end if;

  update public.conflict_principles principle
  set cross_reference_numbers = array(
    select distinct coalesce(number_changes.new_number, ref.number)
    from unnest(principle.cross_reference_numbers) as ref(number)
    left join (
      select saved.principle_number as old_number,
             (item ->> 'principle_number')::integer as new_number
      from jsonb_array_elements(p_updates) as item
      join public.conflict_principles saved on saved.id = (item ->> 'id')::uuid
      where saved.user_id = current_user_id and saved.plan_id = p_plan_id
    ) as number_changes on number_changes.old_number = ref.number
    order by 1
  )
  where principle.user_id = current_user_id and principle.plan_id = p_plan_id;

  select coalesce(max(principle_number), 0)
       + coalesce((select max((item ->> 'principle_number')::integer) from jsonb_array_elements(p_updates) as item), 0)
       + 1000
    into temporary_offset
  from public.conflict_principles
  where user_id = current_user_id and plan_id = p_plan_id;

  update public.conflict_principles principle
  set principle_number = principle.principle_number + temporary_offset
  from jsonb_array_elements(p_updates) as item
  where principle.id = (item ->> 'id')::uuid
    and principle.user_id = current_user_id
    and principle.plan_id = p_plan_id;

  update public.conflict_principles principle
  set principle_number = (item ->> 'principle_number')::integer,
      body = trim(item ->> 'body')
  from jsonb_array_elements(p_updates) as item
  where principle.id = (item ->> 'id')::uuid
    and principle.user_id = current_user_id
    and principle.plan_id = p_plan_id;

  return query
    select * from public.conflict_principles
    where user_id = current_user_id and plan_id = p_plan_id
    order by principle_number;
end;
$$;

revoke all on function public.bulk_update_conflict_principles(text, jsonb) from public, anon;
grant execute on function public.bulk_update_conflict_principles(text, jsonb) to authenticated;
