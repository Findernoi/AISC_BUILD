-- Phase 1: one recruitment organization, Supabase Auth, no automatic HR promotion.
-- Apply once through the Supabase migration runner, after reviewing locally.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.staff_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('hr', 'admin')),
  granted_at timestamptz not null default now()
);
revoke all on private.staff_memberships from public, anon, authenticated;

create function private.is_hr() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.staff_memberships m join auth.users u on u.id = m.user_id
    where m.user_id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
create function private.verified_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;
revoke all on function private.is_hr(), private.verified_email() from public, anon;
grant execute on function private.is_hr(), private.verified_email() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 160),
  phone text not null default '' check (length(phone) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null check (length(trim(title)) between 1 and 200),
  department text not null check (length(trim(department)) between 1 and 160),
  location text not null default '',
  employment_type text not null default 'Internship' check (employment_type in ('Internship','Part-time','Full-time')),
  description text not null default '',
  requirements text[] not null default '{}',
  min_gpa numeric(3,2) not null default 0 check (min_gpa between 0 and 4),
  english_requirement text not null default '',
  status text not null default 'active' check (status in ('active','closed')),
  hiring_period date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  job_id uuid not null references public.jobs(id),
  applicant_id uuid not null default auth.uid() references public.profiles(id),
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  contact_email text not null check (lower(contact_email) ~ '^[^@[:space:]]+@gm[.]uit[.]edu[.]vn$'),
  phone text not null default '' check (length(phone) <= 40),
  university text not null default 'UIT',
  major text not null check (major in ('KHMT','KTPM','AI')),
  gpa numeric(4,2) not null,
  gpa_scale text not null check (gpa_scale in ('4.0','10')),
  graduation_year integer not null check (graduation_year between 2000 and 2100),
  project_count integer check (project_count >= 0),
  experience_months integer check (experience_months >= 0),
  skills text[] not null default '{}',
  english_certificate jsonb not null default '{}' check (jsonb_typeof(english_certificate) = 'object'),
  achievement jsonb not null default '{}' check (jsonb_typeof(achievement) = 'object'),
  project_description text not null default '',
  source text not null default '',
  stage text not null default 'applied' check (stage in ('applied','cv_passed','interview','offer','accepted','withdrawn')),
  status text not null default 'pending' check (status in ('pending','passed','hold','rejected')),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, applicant_id),
  check (gpa >= 0 and gpa <= case when gpa_scale = '4.0' then 4 else 10 end)
);
create index applications_applicant_idx on public.applications(applicant_id);
create index applications_job_stage_idx on public.applications(job_id, stage);

create table public.application_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  kind text not null check (kind in ('cv','english','achievement')),
  bucket text not null default 'application-documents' check (bucket = 'application-documents'),
  object_path text not null unique,
  original_name text not null check (length(original_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/png','image/jpeg')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  check (kind <> 'cv' or mime_type = 'application/pdf'),
  unique(id, application_id, sha256)
);
create index application_files_application_idx on public.application_files(application_id);

create table public.evidence_reviews (
  file_id uuid primary key,
  application_id uuid not null,
  file_sha256 text not null,
  status text not null check (status in ('verified','rejected')),
  reviewed_by uuid not null default auth.uid() references auth.users(id),
  reference text not null check (length(trim(reference)) > 0),
  reviewed_at timestamptz not null default now(),
  foreign key(file_id, application_id, file_sha256) references public.application_files(id, application_id, sha256)
);
create index evidence_reviews_application_idx on public.evidence_reviews(application_id);

create table public.interview_invitations (
  application_id uuid primary key references public.applications(id),
  invited_by uuid not null default auth.uid() references auth.users(id),
  round_one_score numeric(5,2) not null check (round_one_score between 75 and 100),
  scope jsonb not null default '{}' check (jsonb_typeof(scope) = 'object'),
  invited_at timestamptz not null default now()
);
create table public.coding_evaluations (
  application_id uuid primary key references public.interview_invitations(application_id),
  score numeric(5,2) not null check (score between 0 and 100),
  reviewed_by uuid not null default auth.uid() references auth.users(id),
  notes text not null default '',
  reviewed_at timestamptz not null default now()
);
create table public.interview_evaluations (
  application_id uuid primary key references public.interview_invitations(application_id),
  reviewed_by uuid not null default auth.uid() references auth.users(id),
  technical numeric(3,1) not null check (technical between 1 and 10),
  reasoning numeric(3,1) not null check (reasoning between 1 and 10),
  learning numeric(3,1) not null check (learning between 1 and 10),
  projects numeric(3,1) not null check (projects between 1 and 10),
  communication numeric(3,1) not null check (communication between 1 and 10),
  evidence jsonb not null check (
    jsonb_typeof(evidence) = 'object' and
    coalesce(length(trim(evidence->>'technical')),0) > 0 and
    coalesce(length(trim(evidence->>'reasoning')),0) > 0 and
    coalesce(length(trim(evidence->>'learning')),0) > 0 and
    coalesce(length(trim(evidence->>'projects')),0) > 0 and
    coalesce(length(trim(evidence->>'communication')),0) > 0
  ),
  overall_score numeric(5,2) generated always as (
    technical*3 + reasoning*2.5 + learning*1.5 + projects*1.5 + communication*1.5
  ) stored,
  reviewed_at timestamptz not null default now()
);
create table public.hiring_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id),
  application_revision bigint not null,
  result text not null check (result in ('hire','reserve','reject')),
  reason text not null check (length(trim(reason)) > 0),
  decided_by uuid not null default auth.uid() references auth.users(id),
  round_one_score numeric(5,2) not null check (round_one_score between 0 and 100),
  coding_score numeric(5,2) not null,
  interview_score numeric(5,2) not null,
  round_one_weight numeric(5,2) not null default 30 check (round_one_weight between 0 and 100),
  coding_weight numeric(5,2) not null default 30 check (coding_weight between 0 and 100),
  interview_weight numeric(5,2) not null default 40 check (interview_weight between 0 and 100),
  final_score numeric(5,2) generated always as (
    round((round_one_score*round_one_weight + coding_score*coding_weight + interview_score*interview_weight)/100,2)
  ) stored,
  decided_at timestamptz not null default clock_timestamp(),
  check (round_one_weight + coding_weight + interview_weight = 100)
);
create index hiring_decisions_application_idx on public.hiring_decisions(application_id, decided_at desc);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id),
  decision_id uuid not null references public.hiring_decisions(id),
  recipient text not null,
  subject text not null check (length(trim(subject)) between 1 and 300),
  body text not null check (length(trim(body)) > 0),
  status text not null default 'draft' check (status in ('draft','queued','sent','failed')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check ((status = 'sent') = (sent_at is not null))
);
create index email_outbox_application_idx on public.email_outbox(application_id);

create table public.workforce_snapshots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  company_code text not null,
  department text not null,
  origin_month date not null check (extract(day from origin_month) = 1),
  target_month date not null,
  is_synthetic boolean not null,
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(job_id, company_code, department, origin_month),
  check (target_month = (origin_month + interval '1 month')::date)
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  entity text not null,
  record_id text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_fields text[] not null,
  occurred_at timestamptz not null default clock_timestamp()
);

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values(new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''),160));
  return new;
end;
$$;
create trigger recruitment_profile_after_signup after insert on auth.users
for each row execute function private.create_profile();
insert into public.profiles(id, display_name)
select id, left(coalesce(raw_user_meta_data->>'full_name',''),160) from auth.users;

create function private.timestamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  if tg_table_name = 'applications' then
    if new.applicant_id <> old.applicant_id or new.job_id <> old.job_id or new.contact_email <> old.contact_email or new.created_at <> old.created_at then
      raise exception 'Application owner, position, email and creation time are immutable';
    end if;
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function private.timestamp_row();
create trigger jobs_updated before update on public.jobs for each row execute function private.timestamp_row();
create trigger applications_updated before update on public.applications for each row execute function private.timestamp_row();

create function private.touch_application() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize evaluation changes with decisions; the application trigger advances revision.
  update public.applications set updated_at = clock_timestamp() where id = new.application_id;
  return new;
end;
$$;

create function private.capture_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  app public.applications;
begin
  select * into strict app from public.applications where id = new.application_id for update;
  if app.stage not in ('interview','offer') then raise exception 'Application must be in interview or offer stage'; end if;
  if not exists(select 1 from public.jobs j where j.id = app.job_id and
    app.gpa * case when app.gpa_scale = '10' then 0.4 else 1 end >= j.min_gpa) then
    raise exception 'Application GPA is below the position requirement';
  end if;
  new.application_revision := app.revision;
  select score into new.coding_score from public.coding_evaluations where application_id = app.id;
  select overall_score into new.interview_score from public.interview_evaluations where application_id = app.id;
  if new.coding_score is null or new.interview_score is null then raise exception 'Coding and interview evaluations are required'; end if;
  new.decided_at := clock_timestamp();
  return new;
end;
$$;
create trigger hiring_decision_snapshot before insert on public.hiring_decisions for each row execute function private.capture_decision();

create function private.guard_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare app public.applications;
begin
  select * into strict app from public.applications where id = new.application_id for update;
  if app.stage not in ('applied','cv_passed') or app.status = 'rejected' or not exists(
    select 1 from public.jobs j where j.id = app.job_id and j.status = 'active'
    and app.gpa * case when app.gpa_scale = '10' then 0.4 else 1 end >= j.min_gpa
  ) then raise exception 'Application is not eligible for an interview invitation'; end if;
  return new;
end;
$$;
create trigger invitation_guard before insert on public.interview_invitations for each row execute function private.guard_invitation();

create function private.guard_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  app public.applications;
  decision public.hiring_decisions;
begin
  select * into strict app from public.applications where id = new.application_id for update;
  select * into strict decision from public.hiring_decisions where id = new.decision_id;
  if decision.application_id <> app.id or lower(new.recipient) <> lower(app.contact_email) then
    raise exception 'Email decision or recipient does not match the application';
  end if;
  if new.status = 'queued' and (decision.application_revision <> app.revision or decision.id <> (
    select id from public.hiring_decisions where application_id = app.id order by decided_at desc, id desc limit 1
  )) then raise exception 'Decision is stale; HR must record a current decision'; end if;
  return new;
end;
$$;
create trigger email_outbox_guard before insert or update on public.email_outbox for each row execute function private.guard_email();

create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  current_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous_row jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  fields text[];
begin
  select coalesce(array_agg(key order by key),'{}'::text[]) into fields
  from jsonb_each(current_row) where current_row->key is distinct from previous_row->key;
  insert into public.audit_events(actor_id, entity, record_id, action, changed_fields)
  values(auth.uid(), tg_table_schema || '.' || tg_table_name, coalesce(current_row->>'id',current_row->>'application_id',current_row->>'user_id',current_row->>'file_id'),tg_op,fields);
  return coalesce(new,old);
end;
$$;

-- No public RPC may invoke these privileged trigger functions directly.
revoke all on function private.create_profile(), private.timestamp_row(), private.touch_application(), private.capture_decision(), private.guard_invitation(), private.guard_email(), private.audit_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['application_files','evidence_reviews','interview_invitations','coding_evaluations','interview_evaluations'] loop
    execute format('create trigger revision_after_change after insert or update on public.%I for each row execute function private.touch_application()',t);
  end loop;
  foreach t in array array['profiles','jobs','applications','application_files','evidence_reviews','interview_invitations','coding_evaluations','interview_evaluations','hiring_decisions','email_outbox','workforce_snapshots'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create trigger audit_after_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
  end loop;
end;
$$;
alter table public.audit_events enable row level security;
revoke all on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;
create trigger audit_memberships after insert or update or delete on private.staff_memberships for each row execute function private.audit_change();

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_hr()));
grant update(display_name, phone) on public.profiles to authenticated;
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.jobs to anon;
create policy jobs_public_read on public.jobs for select to anon using (status = 'active');
create policy jobs_read on public.jobs for select to authenticated using (status = 'active' or (select private.is_hr()));
grant insert(title,department,location,employment_type,description,requirements,min_gpa,english_requirement,status,hiring_period,created_by) on public.jobs to authenticated;
grant update(title,department,location,employment_type,description,requirements,min_gpa,english_requirement,status,hiring_period) on public.jobs to authenticated;
create policy jobs_hr_insert on public.jobs for insert to authenticated with check ((select private.is_hr()) and created_by = (select auth.uid()));
create policy jobs_hr_update on public.jobs for update to authenticated using ((select private.is_hr())) with check ((select private.is_hr()));

create policy applications_read on public.applications for select to authenticated using (applicant_id = (select auth.uid()) or (select private.is_hr()));
grant insert(job_id,applicant_id,full_name,contact_email,phone,university,major,gpa,gpa_scale,graduation_year,project_count,experience_months,skills,english_certificate,achievement,project_description,source) on public.applications to authenticated;
create policy applications_candidate_insert on public.applications for insert to authenticated with check (
  applicant_id = (select auth.uid()) and lower(contact_email) = (select private.verified_email()) and
  stage = 'applied' and status = 'pending' and revision = 1 and
  exists(select 1 from public.jobs j where j.id = job_id and j.status = 'active')
);
grant update(full_name,phone,university,major,gpa,gpa_scale,graduation_year,project_count,experience_months,skills,english_certificate,achievement,project_description,source,stage,status) on public.applications to authenticated;
create policy applications_hr_update on public.applications for update to authenticated using ((select private.is_hr())) with check ((select private.is_hr()));

grant insert(application_id,uploaded_by,kind,object_path,original_name,mime_type,byte_size,sha256) on public.application_files to authenticated;
create policy files_read on public.application_files for select to authenticated using ((select private.is_hr()) or exists(select 1 from public.applications a where a.id = application_id and a.applicant_id = (select auth.uid())));
create policy files_candidate_insert on public.application_files for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and exists(select 1 from public.applications a
    where a.id = application_id and a.applicant_id = (select auth.uid()) and a.stage not in ('accepted','withdrawn')
    and split_part(object_path,'/',1) = a.applicant_id::text and split_part(object_path,'/',2) = a.id::text
    and length(split_part(object_path,'/',3)) > 0)
);

grant insert(file_id,application_id,file_sha256,status,reviewed_by,reference) on public.evidence_reviews to authenticated;
grant update(status,reviewed_by,reference,reviewed_at) on public.evidence_reviews to authenticated;
create policy reviews_read on public.evidence_reviews for select to authenticated using ((select private.is_hr()) or exists(select 1 from public.applications a where a.id = application_id and a.applicant_id = (select auth.uid())));
create policy reviews_hr_insert on public.evidence_reviews for insert to authenticated with check ((select private.is_hr()) and reviewed_by = (select auth.uid()));
create policy reviews_hr_update on public.evidence_reviews for update to authenticated using ((select private.is_hr())) with check ((select private.is_hr()) and reviewed_by = (select auth.uid()));

grant insert(application_id,invited_by,round_one_score,scope) on public.interview_invitations to authenticated;
create policy invitations_read on public.interview_invitations for select to authenticated using ((select private.is_hr()) or exists(select 1 from public.applications a where a.id = application_id and a.applicant_id = (select auth.uid())));
create policy invitations_hr_insert on public.interview_invitations for insert to authenticated with check ((select private.is_hr()) and invited_by = (select auth.uid()));

grant insert(application_id,score,reviewed_by,notes) on public.coding_evaluations to authenticated;
grant update(score,reviewed_by,notes,reviewed_at) on public.coding_evaluations to authenticated;
create policy coding_hr_read on public.coding_evaluations for select to authenticated using ((select private.is_hr()));
create policy coding_hr_insert on public.coding_evaluations for insert to authenticated with check ((select private.is_hr()) and reviewed_by = (select auth.uid()));
create policy coding_hr_update on public.coding_evaluations for update to authenticated using ((select private.is_hr())) with check ((select private.is_hr()) and reviewed_by = (select auth.uid()));

grant insert(application_id,reviewed_by,technical,reasoning,learning,projects,communication,evidence) on public.interview_evaluations to authenticated;
grant update(reviewed_by,technical,reasoning,learning,projects,communication,evidence,reviewed_at) on public.interview_evaluations to authenticated;
create policy interview_hr_read on public.interview_evaluations for select to authenticated using ((select private.is_hr()));
create policy interview_hr_insert on public.interview_evaluations for insert to authenticated with check ((select private.is_hr()) and reviewed_by = (select auth.uid()));
create policy interview_hr_update on public.interview_evaluations for update to authenticated using ((select private.is_hr())) with check ((select private.is_hr()) and reviewed_by = (select auth.uid()));

grant insert(application_id,result,reason,decided_by,round_one_score,round_one_weight,coding_weight,interview_weight) on public.hiring_decisions to authenticated;
create policy decisions_hr_read on public.hiring_decisions for select to authenticated using ((select private.is_hr()));
create policy decisions_hr_insert on public.hiring_decisions for insert to authenticated with check ((select private.is_hr()) and decided_by = (select auth.uid()));

grant insert(application_id,decision_id,recipient,subject,body,created_by) on public.email_outbox to authenticated;
grant update(recipient,subject,body,status) on public.email_outbox to authenticated;
create policy email_read on public.email_outbox for select to authenticated using ((select private.is_hr()) or (status = 'sent' and exists(select 1 from public.applications a where a.id = application_id and a.applicant_id = (select auth.uid()))));
create policy email_hr_insert on public.email_outbox for insert to authenticated with check ((select private.is_hr()) and created_by = (select auth.uid()) and status = 'draft' and sent_at is null);
create policy email_hr_update on public.email_outbox for update to authenticated using ((select private.is_hr()) and status in ('draft','queued')) with check ((select private.is_hr()) and status in ('draft','queued') and sent_at is null);

grant insert(job_id,company_code,department,origin_month,target_month,is_synthetic,inputs,created_by) on public.workforce_snapshots to authenticated;
create policy workforce_hr_read on public.workforce_snapshots for select to authenticated using ((select private.is_hr()));
create policy workforce_hr_insert on public.workforce_snapshots for insert to authenticated with check ((select private.is_hr()) and created_by = (select auth.uid()));
create policy audit_hr_read on public.audit_events for select to authenticated using ((select private.is_hr()));

commit;
