begin;
create table public.recruitment_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id),
  decision_id uuid not null references public.hiring_decisions(id),
  position_title text not null check(length(trim(position_title)) between 1 and 200),
  start_date date not null check(isfinite(start_date) and start_date between date '0001-01-01' and date '9999-12-31'),
  content text not null check(length(trim(content)) between 1 and 10000),
  status text not null default 'pending' check(status in ('pending','superseded','accepted','declined')),
  revision bigint not null default 1,
  issued_by uuid not null default auth.uid() references auth.users(id),
  issued_at timestamptz not null default clock_timestamp(),
  responded_by uuid references auth.users(id),responded_at timestamptz,
  response_note text not null default '' check(length(response_note)<=2000),
  check((status in ('accepted','declined'))=(responded_by is not null and responded_at is not null))
);
create unique index offers_one_pending on public.recruitment_offers(application_id) where status='pending';
create index offers_application_history on public.recruitment_offers(application_id,issued_at desc,id desc);
alter table public.recruitment_offers enable row level security;
revoke all on public.recruitment_offers from public,anon,authenticated;
grant select on public.recruitment_offers to authenticated;
create policy offers_read on public.recruitment_offers for select to authenticated using(
  (select private.is_hr()) or exists(select 1 from public.applications a where a.id=application_id and a.applicant_id=(select auth.uid()))
);
create trigger offers_lock before insert or update or delete on public.recruitment_offers for each statement execute function private.round_one_write_lock();
create trigger offers_audit after insert or update or delete on public.recruitment_offers for each row execute function private.audit_change();
create function private.offer_actionable(o public.recruitment_offers) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(o.status='pending' and a.stage='offer' and a.status='passed' and j.status='active'
    and d.id=o.decision_id and d.result='hire' and d.source_basis=private.hiring_basis(a.id),false)
  from public.applications a join public.jobs j on j.id=a.job_id
  left join lateral(select * from public.hiring_decisions where application_id=a.id order by decided_at desc,id desc limit 1) d on true
  where a.id=o.application_id;
$$;
revoke all on function private.offer_actionable(public.recruitment_offers) from public,anon,authenticated;
create function public.read_offers() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(row order by issued_at desc,id desc),'[]'::jsonb) from (
    select o.id,o.issued_at,to_jsonb(o)||jsonb_build_object('candidate_name',a.full_name,'actionable',private.offer_actionable(o)) as row
    from public.recruitment_offers o join public.applications a on a.id=o.application_id
    where private.is_hr() or a.applicant_id=auth.uid() order by o.issued_at desc,o.id desc limit 200
  ) visible;
$$;
revoke all on function public.read_offers() from public,anon;
grant execute on function public.read_offers() to authenticated;
create function public.issue_offer(target uuid, expected_decision uuid, expected_basis text, expected_offer uuid, position_title text, start_date date, content text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.applications; d public.hiring_decisions; new_id uuid;
begin
  perform pg_advisory_xact_lock(170018,1);
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501';end if;
  select * into a from public.applications where id=target for update;
  select * into d from public.hiring_decisions where application_id=target order by decided_at desc,id desc limit 1;
  if a.id is null or a.stage<>'offer' or a.status<>'passed' or d.result is distinct from 'hire' then raise exception 'Selected hiring decision required' using errcode='22023';end if;
  if expected_decision is null or expected_basis is null or expected_decision<>d.id or expected_basis<>private.hiring_basis(target) or d.source_basis is distinct from private.hiring_basis(target) then raise exception 'Stale offer decision' using errcode='40001';end if;
  if not exists(select 1 from public.jobs where id=a.job_id and status='active') then raise exception 'Position is closed' using errcode='22023';end if;
  if position_title is null or length(trim(position_title)) not between 1 and 200 or start_date is null or content is null or length(trim(content)) not between 1 and 10000 then raise exception 'Invalid offer' using errcode='22023';end if;
  if (select id from public.recruitment_offers where application_id=target and status='pending') is distinct from expected_offer then raise exception 'Stale pending offer' using errcode='40001';end if;
  update public.recruitment_offers set status='superseded',revision=revision+1 where application_id=target and status='pending';
  insert into public.recruitment_offers(application_id,decision_id,position_title,start_date,content)
    values(target,expected_decision,trim(position_title),start_date,trim(content)) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.issue_offer(uuid,uuid,text,uuid,text,date,text) from public,anon;
grant execute on function public.issue_offer(uuid,uuid,text,uuid,text,date,text) to authenticated;
create function public.respond_offer(target uuid, expected_revision bigint, outcome text, note text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.recruitment_offers; a public.applications;
begin
  perform pg_advisory_xact_lock(170018,1);
  if auth.uid() is null or private.is_hr() then raise exception 'Candidate access required' using errcode='42501';end if;
  select * into o from public.recruitment_offers where id=target for update;
  select * into a from public.applications where id=o.application_id for update;
  if a.applicant_id is distinct from auth.uid() then raise exception 'Offer owner required' using errcode='42501';end if;
  if expected_revision is null or o.revision<>expected_revision or not private.offer_actionable(o) then raise exception 'Stale or inactive offer' using errcode='40001';end if;
  if outcome is null or outcome not in ('accepted','declined') or note is null or length(note)>2000 then raise exception 'Invalid response' using errcode='22023';end if;
  update public.recruitment_offers set status=outcome,revision=revision+1,responded_by=auth.uid(),responded_at=clock_timestamp(),response_note=trim(note) where id=target;
  update public.applications set stage=case when outcome='accepted' then 'accepted' else 'withdrawn' end,
    status=case when outcome='accepted' then 'passed' else 'rejected' end where id=a.id;
end $$;
revoke all on function public.respond_offer(uuid,bigint,text,text) from public,anon;
grant execute on function public.respond_offer(uuid,bigint,text,text) to authenticated;
create function private.supersede_decision_offers() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.recruitment_offers set status='superseded',revision=revision+1 where application_id=new.application_id and status='pending';return new;
end $$;
revoke all on function private.supersede_decision_offers() from public,anon,authenticated;
create trigger decision_supersedes_offers after insert on public.hiring_decisions for each row execute function private.supersede_decision_offers();
commit;
