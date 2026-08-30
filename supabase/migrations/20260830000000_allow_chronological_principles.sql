-- Let the existing atomically numbered principles system serve both reading journeys.
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

  if p_plan_id = 'bible-conflict-ages-v1' then
    if p_reading_id !~ '^coa-[0-9]{3}$' then
      raise exception 'Unknown reading';
    end if;
  elsif p_plan_id = 'chronological-bible-order-v3' then
    if p_reading_id !~ '^chron-[0-9]{3}-[0-9]{2}$' then
      raise exception 'Unknown reading';
    end if;
  else
    raise exception 'Unknown reading plan';
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
