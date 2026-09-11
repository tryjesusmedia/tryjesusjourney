-- Make mobile note creation retry-safe while remaining compatible with the
-- website's existing create_conflict_principle calls.

begin;

alter table public.conflict_principles
  add column if not exists client_mutation_id uuid;

create unique index if not exists conflict_principles_client_mutation_idx
  on public.conflict_principles (user_id, plan_id, client_mutation_id)
  where client_mutation_id is not null;

drop function if exists public.create_conflict_principle(text, text, text, integer[]);
drop function if exists public.create_conflict_principle(text, text, text, integer[], integer);
drop function if exists public.create_conflict_principle(text, text, text, integer[], integer, uuid);

create function public.create_conflict_principle(
  p_plan_id text,
  p_reading_id text,
  p_body text,
  p_cross_reference_numbers integer[] default '{}',
  p_principle_number integer default null,
  p_client_mutation_id uuid default null
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

  if p_client_mutation_id is not null then
    select * into created
    from public.conflict_principles
    where user_id = current_user_id
      and plan_id = p_plan_id
      and client_mutation_id = p_client_mutation_id;
    if found then
      if created.reading_id is distinct from p_reading_id
        or created.body is distinct from trim(p_body)
        or created.cross_reference_numbers is distinct from array(
          select distinct ref.number
          from unnest(coalesce(p_cross_reference_numbers, '{}')) as ref(number)
          order by ref.number
        )
        or (p_principle_number is not null and created.principle_number is distinct from p_principle_number)
      then
        raise exception 'Client mutation ID was already used for a different principle';
      end if;
      return next created;
      return;
    end if;
  end if;

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
    user_id, plan_id, reading_id, principle_number, body, cross_reference_numbers, client_mutation_id
  ) values (
    current_user_id,
    p_plan_id,
    p_reading_id,
    chosen_number,
    trim(p_body),
    array(select distinct ref.number from unnest(coalesce(p_cross_reference_numbers, '{}')) as ref(number) order by ref.number),
    p_client_mutation_id
  ) returning * into created;

  return next created;
end;
$$;

revoke all on function public.create_conflict_principle(text, text, text, integer[], integer, uuid) from public, anon;
grant execute on function public.create_conflict_principle(text, text, text, integer[], integer, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
