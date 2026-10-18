begin;
alter table public.application_files add column declared_fields jsonb not null default '{}' check(jsonb_typeof(declared_fields)='object');
grant insert(declared_fields) on public.application_files to authenticated;
create table public.evidence_checks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null,
  application_id uuid not null,
  file_sha256 text not null,
  claims_hash text not null check(claims_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  result jsonb not null check(jsonb_typeof(result)='object' and result ?& array['status','issuer_verified'] and result->>'status' in ('matched','mismatch','unclear','unreadable') and result->'issuer_verified'='false'::jsonb),
  foreign key(file_id,application_id,file_sha256) references public.application_files(id,application_id,sha256)
);
create index evidence_checks_file_idx on public.evidence_checks(file_id,created_at desc);
alter table public.evidence_checks enable row level security;
revoke all on public.evidence_checks from public,anon,authenticated;
grant select on public.evidence_checks to authenticated;
grant select,insert on public.evidence_checks to service_role;
create policy checks_read on public.evidence_checks for select to authenticated using (
  (select private.is_hr()) or exists(select 1 from public.applications a where a.id=application_id and a.applicant_id=(select auth.uid()))
);
-- Automated extraction is advisory: no score/state/review triggers and no client write grants.
commit;
