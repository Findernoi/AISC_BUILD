begin;

-- Bind manual evidence reviews to the declared facts/name at review time.
-- Old rows remain unbound and cannot supply a bonus until reviewed again.
alter table public.evidence_reviews add column claims_snapshot jsonb;
create function private.snapshot_review_claims() returns trigger
language plpgsql security definer set search_path='' as $$
declare app_name text; declaration jsonb;
begin
  select a.full_name,f.declared_fields into strict app_name,declaration
    from public.application_files f join public.applications a on a.id=f.application_id
    where f.id=new.file_id and f.application_id=new.application_id and f.sha256=new.file_sha256;
  new.claims_snapshot:=jsonb_build_object('full_name',app_name,'declaration',declaration);
  new.reviewed_at:=clock_timestamp();
  return new;
end $$;
revoke all on function private.snapshot_review_claims() from public,anon,authenticated;
create trigger evidence_review_claims before insert or update on public.evidence_reviews
for each row execute function private.snapshot_review_claims();

-- Serialize ranking-relevant mutations with interview selection, before row locks.
create function private.round_one_write_lock() returns trigger language plpgsql set search_path='' as $$
begin perform pg_advisory_xact_lock(170018,1); return null; end $$;
revoke all on function private.round_one_write_lock() from public,anon,authenticated;
do $$ declare tab text; begin
  foreach tab in array array['jobs','applications','application_files','evidence_reviews','interview_invitations'] loop
    execute format('create trigger round_one_write_lock before insert or update or delete on public.%I for each statement execute function private.round_one_write_lock()',tab);
  end loop;
end $$;

create trigger round_one_membership_lock before insert or update or delete on private.staff_memberships
for each statement execute function private.round_one_write_lock();

create function private.round_one_score(a public.applications,j public.jobs) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  gpa_value numeric; skills_value numeric; projects_value numeric; english_value numeric:=0; achievement_value numeric:=0;
  bonus numeric; total_value numeric; english_file public.application_files; achievement_file public.application_files;
  max_cert numeric; cert_score numeric; proof boolean; alert_count integer;
begin
  gpa_value:=a.gpa*case when a.gpa_scale='10' then 0.4 else 1 end;
  select case when cardinality(j.requirements)>0 then count(*)::numeric/cardinality(j.requirements)*30 else 0 end into skills_value
  from unnest(j.requirements) requirement where length(trim(requirement))>0 and exists(
    select 1 from unnest(a.skills) skill,regexp_split_to_table(requirement,'\s*/\s*') part
    where length(trim(skill))>0 and length(trim(part))>0 and
      (position(lower(trim(skill)) in lower(trim(part)))>0 or position(lower(trim(part)) in lower(trim(skill)))>0)
  );
  projects_value:=least(15,greatest(0,coalesce(a.project_count,0))::numeric*5)+least(5,greatest(0,coalesce(a.experience_months,0))::numeric/6*5);
  bonus:=case when gpa_value>=3.6 then 3 else 0 end;
  select * into english_file from public.application_files f where f.application_id=a.id and f.kind='english' order by f.created_at desc,f.id desc limit 1;
  if english_file.id is not null then
    select exists(select 1 from public.evidence_reviews r where r.file_id=english_file.id and r.application_id=a.id
      and r.file_sha256=english_file.sha256 and r.status='verified' and length(trim(r.reference))>0
      and r.claims_snapshot=jsonb_build_object('full_name',a.full_name,'declaration',english_file.declared_fields)) into proof;
    max_cert:=case english_file.declared_fields->>'credential' when 'IELTS' then 9 when 'TOEIC' then 990 when 'TOEFL' then 120 when 'VSTEP' then 6 else null end;
    if proof and max_cert is not null and length(english_file.declared_fields->>'score')<10 and (english_file.declared_fields->>'score') ~ '^[0-9]+([.][0-9]+)?$' then
      cert_score:=(english_file.declared_fields->>'score')::numeric;
      if cert_score between 0 and max_cert then english_value:=cert_score/max_cert*15; end if;
    end if;
  end if;
  select * into achievement_file from public.application_files f where f.application_id=a.id and f.kind='achievement' order by f.created_at desc,f.id desc limit 1;
  if achievement_file.id is not null then
    select exists(select 1 from public.evidence_reviews r where r.file_id=achievement_file.id and r.application_id=a.id
      and r.file_sha256=achievement_file.sha256 and r.status='verified' and length(trim(r.reference))>0
      and r.claims_snapshot=jsonb_build_object('full_name',a.full_name,'declaration',achievement_file.declared_fields)) into proof;
    if proof then achievement_value:=case achievement_file.declared_fields->>'level' when 'school' then 4 when 'national' then 7 when 'international' then 10 else 0 end; end if;
  end if;
  select count(*) into alert_count from (
    select distinct on(f.kind) f.id,f.sha256 from public.application_files f where f.application_id=a.id order by f.kind,f.created_at desc,f.id desc
  ) latest left join lateral(select c.* from public.evidence_checks c where c.file_id=latest.id order by c.created_at desc,c.id desc limit 1) c on true
  where c.id is null or c.file_sha256<>latest.sha256 or c.result->>'status'<>'matched'
    or not coalesce(c.result->'fields' @> jsonb_build_array(jsonb_build_object('key','full_name','declared',a.full_name)),false);
  total_value:=round(least(100,greatest(0,gpa_value/4*25+skills_value+projects_value+english_value+achievement_value+bonus)),1);
  return jsonb_build_object('total',total_value,'gpaNormalized',gpa_value,'evidenceAlerts',alert_count,'contributions',jsonb_build_array(
    jsonb_build_object('key','gpa','label','GPA tự khai','value',gpa_value/4*25,'max',25),
    jsonb_build_object('key','skills','label','Kỹ năng khớp vị trí','value',skills_value,'max',30),
    jsonb_build_object('key','projects','label','Dự án và kinh nghiệm tự khai','value',projects_value,'max',20),
    jsonb_build_object('key','english','label','Ngoại ngữ có minh chứng đã xác minh','value',english_value,'max',15),
    jsonb_build_object('key','achievement','label','Thành tích đã xác minh','value',achievement_value,'max',10),
    jsonb_build_object('key','gpaBonus','label','Điểm cộng GPA từ 3.6 trở lên','value',bonus,'max',3)
  ));
end $$;
revoke all on function private.round_one_score(public.applications,public.jobs) from public,anon,authenticated;

create function public.round_one_report(job_filter uuid default null,major_filter text default 'all') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501'; end if;
  if major_filter not in ('all','AI','KHMT','KTPM') or major_filter is null then raise exception 'Invalid major filter' using errcode='22023'; end if;
  return (
    with scored as (
      select a.*,j.title as job_title,j.status as job_status,j.min_gpa,private.round_one_score(a,j) as score,
        (select to_jsonb(i) from public.interview_invitations i where i.application_id=a.id) as invitation
      from public.applications a join public.jobs j on j.id=a.job_id
      where (job_filter is null or a.job_id=job_filter) and (major_filter='all' or a.major=major_filter)
    ), explained as (
      select s.*,array_remove(array[
        case when s.contact_email !~* '^[^@[:space:]]+@gm[.]uit[.]edu[.]vn$' then 'Email ứng viên chưa đúng miền UIT' end,
        case when s.job_status<>'active' then 'Vị trí đã đóng' end,
        case when s.status='rejected' then 'Hồ sơ đã bị từ chối' end,
        case when s.stage not in ('applied','cv_passed','interview') then 'Hồ sơ không còn ở giai đoạn xét vòng 1' end,
        case when (s.score->>'gpaNormalized')::numeric<s.min_gpa then 'GPA chưa đạt mức tối thiểu của vị trí' end,
        case when (s.score->>'total')::numeric<75 then 'Điểm vòng 1 chưa đạt 75' end
      ],null) as reasons from scored s
    ), ranked as (
      select id,row_number() over(order by (score->>'total')::numeric desc,id) as rank from explained where cardinality(reasons)=0
    ), entries as (
      select e.*,r.rank from explained e left join ranked r using(id)
    ) select jsonb_build_object('version','round-one-v1','threshold',75,'total',count(*),'qualified',count(*) filter(where rank is not null),
      'rows',coalesce((select jsonb_agg(payload order by eligible desc,total_score desc,id) from (
        select x.id,x.rank is not null as eligible,(x.score->>'total')::numeric as total_score,
          jsonb_build_object('application',jsonb_build_object('id',x.id,'job_id',x.job_id,'full_name',x.full_name,'contact_email',x.contact_email,'major',x.major,'stage',x.stage,'status',x.status,'revision',x.revision),
            'jobTitle',x.job_title,'score',x.score,'reasons',to_jsonb(x.reasons),'rank',x.rank,
            'inTopTen',coalesce(x.rank<=10,false),'invitation',x.invitation) as payload
        from entries x order by eligible desc,total_score desc,x.id limit 200
      ) visible),'[]'::jsonb)) from entries
  );
end $$;
revoke all on function public.round_one_report(uuid,text) from public,anon;
grant execute on function public.round_one_report(uuid,text) to authenticated;

create function public.invite_round_one(application_ids uuid[],job_filter uuid default null,major_filter text default 'all') returns jsonb
language plpgsql security definer set search_path='' as $$
declare report jsonb; target uuid; item jsonb; app public.applications; existing public.interview_invitations; output jsonb:='[]';
begin
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501'; end if;
  if cardinality(application_ids) is null or cardinality(application_ids) not between 1 and 10 or
    (select count(distinct id) from unnest(application_ids) id)<>cardinality(application_ids) then
    raise exception 'Select 1 to 10 unique applications' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(170018,1);
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501'; end if;
  report:=public.round_one_report(job_filter,major_filter);
  foreach target in array application_ids loop
    select * into app from public.applications where id=target;
    if app.id is null or (job_filter is not null and app.job_id<>job_filter) or (major_filter<>'all' and app.major<>major_filter) then
      raise exception 'Application outside scope' using errcode='22023';
    end if;
    select * into existing from public.interview_invitations where application_id=target;
    if existing.application_id is not null then output:=output||jsonb_build_array(to_jsonb(existing));continue;end if;
    select value into item from jsonb_array_elements(report->'rows') where value->'application'->>'id'=target::text and (value->>'inTopTen')::boolean;
    if item is null or app.stage not in ('applied','cv_passed') then
      raise exception 'Selection is stale or outside current top ten' using errcode='40001';
    end if;
    insert into public.interview_invitations(application_id,round_one_score,scope)
    values(target,(item->'score'->>'total')::numeric,jsonb_build_object('jobId',job_filter,'major',major_filter,'applicationRevision',app.revision,'version','round-one-v1','score',item->'score')) returning * into existing;
    update public.applications set stage='interview',status='passed' where id=target;
    output:=output||jsonb_build_array(to_jsonb(existing));
  end loop;
  return output;
end $$;
revoke all on function public.invite_round_one(uuid[],uuid,text) from public,anon;
grant execute on function public.invite_round_one(uuid[],uuid,text) to authenticated;
-- Only the RPC can create invitations with recomputed scores and a validated top-ten scope.
revoke insert(application_id,invited_by,round_one_score,scope) on public.interview_invitations from authenticated;
commit;
