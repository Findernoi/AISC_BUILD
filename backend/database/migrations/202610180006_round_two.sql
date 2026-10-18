begin;
create table public.interview_schedules (
  application_id uuid primary key references public.interview_invitations(application_id),
  starts_at timestamptz not null check (isfinite(starts_at)),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  location text not null check (length(trim(location)) between 1 and 1000),
  interviewer text not null check (length(trim(interviewer)) between 1 and 160),
  instructions text not null default '' check (length(instructions)<=5000),
  updated_by uuid not null default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.interview_schedules enable row level security;
grant select on public.interview_schedules to authenticated;
create policy schedules_read on public.interview_schedules for select to authenticated using (
  (select private.is_hr()) or exists(select 1 from public.applications a where a.id=application_id and a.applicant_id=(select auth.uid()))
);
create trigger schedule_touch after insert or update on public.interview_schedules for each row execute function private.touch_application();
create trigger schedule_write_lock before insert or update or delete on public.interview_schedules for each statement execute function private.round_one_write_lock();

-- All portal writes use one transaction and the current application revision.
create function public.save_round_two(target uuid, expected_revision bigint, kind text, payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare app public.applications; k text; n numeric;
begin
  perform pg_advisory_xact_lock(170018,1);
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501'; end if;
  select * into app from public.applications where id=target for update;
  if app.id is null or app.stage<>'interview' or app.status<>'passed' or not exists(select 1 from public.interview_invitations where application_id=target) then
    raise exception 'Application is not in interview stage' using errcode='22023';
  end if;
  if expected_revision is null or app.revision<>expected_revision then raise exception 'Stale interview revision' using errcode='40001'; end if;
  if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid payload' using errcode='22023'; end if;
  if kind='schedule' then
    if not (payload ?& array['starts_at','duration_minutes','location','interviewer','instructions']) or payload-array['starts_at','duration_minutes','location','interviewer','instructions']<>'{}'::jsonb
      or jsonb_typeof(payload->'duration_minutes')<>'number' or (payload->>'duration_minutes')::numeric<>trunc((payload->>'duration_minutes')::numeric)
      or exists(select 1 from jsonb_each(payload) e where e.key<>'duration_minutes' and jsonb_typeof(e.value)<>'string') then raise exception 'Invalid schedule' using errcode='22023'; end if;
    insert into public.interview_schedules(application_id,starts_at,duration_minutes,location,interviewer,instructions)
      values(target,(payload->>'starts_at')::timestamptz,(payload->>'duration_minutes')::integer,trim(payload->>'location'),trim(payload->>'interviewer'),trim(payload->>'instructions'))
      on conflict(application_id) do update set starts_at=excluded.starts_at,duration_minutes=excluded.duration_minutes,location=excluded.location,interviewer=excluded.interviewer,instructions=excluded.instructions,updated_by=auth.uid(),updated_at=clock_timestamp();
  elsif kind='coding' then
    if not (payload ?& array['score','notes']) or payload-array['score','notes']<>'{}'::jsonb or jsonb_typeof(payload->'score')<>'number' or jsonb_typeof(payload->'notes')<>'string' or length(payload->>'notes')>5000 then raise exception 'Invalid coding result' using errcode='22023'; end if;
    n:=(payload->>'score')::numeric;
    if n<0 or n>100 or n<>round(n,1) then raise exception 'Invalid coding score' using errcode='22023'; end if;
    insert into public.coding_evaluations(application_id,score,notes) values(target,n,trim(payload->>'notes'))
      on conflict(application_id) do update set score=excluded.score,notes=excluded.notes,reviewed_by=auth.uid(),reviewed_at=clock_timestamp();
  elsif kind='interview' then
    if not (payload ?& array['scores','evidence']) or payload-array['scores','evidence']<>'{}'::jsonb or jsonb_typeof(payload->'scores')<>'object' or jsonb_typeof(payload->'evidence')<>'object'
      or (payload->'scores')-array['technical','reasoning','learning','projects','communication']<>'{}'::jsonb or (payload->'evidence')-array['technical','reasoning','learning','projects','communication']<>'{}'::jsonb then raise exception 'Invalid interview' using errcode='22023'; end if;
    foreach k in array array['technical','reasoning','learning','projects','communication'] loop
      if jsonb_typeof(payload->'scores'->k) is distinct from 'number' or jsonb_typeof(payload->'evidence'->k) is distinct from 'string' or length(trim(payload->'evidence'->>k)) not between 1 and 3000 then raise exception 'Missing criterion' using errcode='22023'; end if;
      n:=(payload->'scores'->>k)::numeric;
      if n<1 or n>10 or n<>round(n,1) then raise exception 'Invalid criterion score' using errcode='22023'; end if;
    end loop;
    insert into public.interview_evaluations(application_id,technical,reasoning,learning,projects,communication,evidence)
      values(target,(payload->'scores'->>'technical')::numeric,(payload->'scores'->>'reasoning')::numeric,(payload->'scores'->>'learning')::numeric,(payload->'scores'->>'projects')::numeric,(payload->'scores'->>'communication')::numeric,payload->'evidence')
      on conflict(application_id) do update set technical=excluded.technical,reasoning=excluded.reasoning,learning=excluded.learning,projects=excluded.projects,communication=excluded.communication,evidence=excluded.evidence,reviewed_by=auth.uid(),reviewed_at=clock_timestamp();
  else raise exception 'Invalid operation' using errcode='22023'; end if;
end $$;
revoke all on function public.save_round_two(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.save_round_two(uuid,bigint,text,jsonb) to authenticated;
-- Prevent bypassing revision/stage checks via direct authenticated writes.
revoke insert(application_id,score,reviewed_by,notes),update(score,reviewed_by,notes,reviewed_at) on public.coding_evaluations from authenticated;
revoke insert(application_id,reviewed_by,technical,reasoning,learning,projects,communication,evidence),update(reviewed_by,technical,reasoning,learning,projects,communication,evidence,reviewed_at) on public.interview_evaluations from authenticated;
create function public.read_round_two(target uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('revision',a.revision,
    'schedule',(select to_jsonb(s) from public.interview_schedules s where s.application_id=a.id),
    'coding',(select to_jsonb(c) from public.coding_evaluations c where c.application_id=a.id),
    'interview',(select to_jsonb(i) from public.interview_evaluations i where i.application_id=a.id))
  from public.applications a where a.id=target;
$$;
revoke all on function public.read_round_two(uuid) from public,anon;
grant execute on function public.read_round_two(uuid) to authenticated;
commit;
