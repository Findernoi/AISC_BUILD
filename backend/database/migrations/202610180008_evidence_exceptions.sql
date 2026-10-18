begin;
alter table public.evidence_checks add column claims_snapshot jsonb;
alter table public.evidence_reviews add column exception_basis text;
create trigger checks_write_lock before insert or update or delete on public.evidence_checks for each statement execute function private.round_one_write_lock();
create trigger checks_touch after insert or update on public.evidence_checks for each row execute function private.touch_application();

create function private.evidence_assessment(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f public.application_files; a public.applications; c public.evidence_checks; r public.evidence_reviews;
  basis text; claims jsonb; keys text[]; k text; matches boolean:=false; state text; explanation text;
begin
  select * into f from public.application_files where id=target;
  if f.id is null then return null; end if;
  select * into strict a from public.applications where id=f.application_id;
  select * into c from public.evidence_checks where file_id=target order by created_at desc,id desc limit 1;
  select * into r from public.evidence_reviews where file_id=target;
  claims:=jsonb_build_object('full_name',a.full_name,'declaration',f.declared_fields);
  basis:=md5(jsonb_build_object('version','evidence-exceptions-v1','file',to_jsonb(f),'claims',claims,'check',to_jsonb(c))::text);
  if f.kind='cv' then state:='not_scored';explanation:='CV không có điểm minh chứng';
  elsif f.id<>(select id from public.application_files where application_id=f.application_id and kind=f.kind order by created_at desc,id desc limit 1) then state:='obsolete';explanation:='Đã có tệp mới hơn của loại này';
  else
    keys:=case when f.kind='english' then array['full_name','credential','score'] else array['full_name','title','issuer','level'] end;
    foreach k in array array['issued_on','reference'] loop if length(coalesce(f.declared_fields->>k,''))>0 then keys:=array_append(keys,k);end if;end loop;
    if c.id is not null and c.file_sha256=f.sha256 and c.claims_snapshot=claims and c.result->>'engine'='local-ocr-rules-v2'
      and c.result->>'status'='matched' and c.result->'partial'='false'::jsonb and jsonb_typeof(c.result->'fields')='array' then
      matches:=true;
      foreach k in array keys loop
        if not exists(select 1 from jsonb_array_elements(c.result->'fields') field where field->>'key'=k and field->>'outcome'='match'
          and length(trim(coalesce(field->>'extracted','')))>0 and field->>'declared'=case when k='full_name' then a.full_name else f.declared_fields->>k end) then matches:=false;end if;
      end loop;
      if exists(select 1 from jsonb_array_elements(c.result->'fields') field where field->>'outcome' is distinct from 'match') then matches:=false;end if;
    end if;
    -- Existing manual conclusions remain valid only for the exact claims/file they reviewed.
    if r.file_id is not null and r.file_sha256=f.sha256 and r.claims_snapshot=claims and (r.exception_basis is null or r.exception_basis=basis) then
      state:=case when r.status='verified' then 'accepted' else 'rejected' end;explanation:=r.reference;
    elsif matches then state:='automatic';explanation:='Khớp thông tin tự động';
    else state:='exception';explanation:=case when c.id is null then 'Chưa có kết quả đọc; cần đọc tệp hoặc HR xử lý' when c.claims_snapshot is distinct from claims or c.result->>'engine' is distinct from 'local-ocr-rules-v2' then 'Kết quả cũ; cần đọc lại theo thông tin và quy tắc hiện tại' else 'Thông tin lệch, thiếu, không rõ hoặc chưa đọc đủ; cần HR xử lý' end;
    end if;
  end if;
  return jsonb_build_object('status',state,'basis',basis,'checkId',c.id,'reason',explanation);
end $$;
revoke all on function private.evidence_assessment(uuid) from public,anon,authenticated;
create function public.evidence_assessment(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.application_files f join public.applications a on a.id=f.application_id where f.id=target and (private.is_hr() or a.applicant_id=auth.uid())) then return null;end if;
  return private.evidence_assessment(target);
end $$;
revoke all on function public.evidence_assessment(uuid) from public,anon;
grant execute on function public.evidence_assessment(uuid) to authenticated;
create function public.evidence_exceptions() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501';end if;
  return (with latest as (
    select distinct on(application_id,kind) f.* from public.application_files f where kind in ('english','achievement') order by application_id,kind,created_at desc,id desc
  ), pending as (
    select jsonb_build_object('file',to_jsonb(f),'application',jsonb_build_object('id',a.id,'full_name',a.full_name,'major',a.major),'assessment',s.value) as row,f.created_at,f.id
    from latest f join public.applications a on a.id=f.application_id cross join lateral(select private.evidence_assessment(f.id) as value) s where s.value->>'status'='exception'
  ) select jsonb_build_object('total',(select count(*) from pending),'rows',coalesce((select jsonb_agg(p.row order by p.created_at,p.id) from (select * from pending order by created_at,id limit 200) p),'[]'::jsonb)));
end $$;
revoke all on function public.evidence_exceptions() from public,anon;
grant execute on function public.evidence_exceptions() to authenticated;
create function public.resolve_evidence_exception(target uuid, expected_basis text, outcome text, explanation text) returns void
language plpgsql security definer set search_path='' as $$
declare state jsonb; f public.application_files;
begin
  perform pg_advisory_xact_lock(170018,1);
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501';end if;
  select * into f from public.application_files where id=target;
  state:=private.evidence_assessment(target);
  if state is null or expected_basis is null or state->>'basis'<>expected_basis or state->>'status'<>'exception' then raise exception 'Stale evidence exception' using errcode='40001';end if;
  if outcome is null or outcome not in ('accept','reject') or explanation is null or length(trim(explanation)) not between 1 and 5000 then raise exception 'Invalid resolution' using errcode='22023';end if;
  insert into public.evidence_reviews(file_id,application_id,file_sha256,status,reference,exception_basis)
    values(f.id,f.application_id,f.sha256,case when outcome='accept' then 'verified' else 'rejected' end,trim(explanation),expected_basis)
    on conflict(file_id) do update set status=excluded.status,reference=excluded.reference,exception_basis=excluded.exception_basis,reviewed_by=auth.uid();
end $$;
revoke all on function public.resolve_evidence_exception(uuid,text,text,text) from public,anon;
grant execute on function public.resolve_evidence_exception(uuid,text,text,text) to authenticated;
revoke insert(file_id,application_id,file_sha256,status,reviewed_by,reference),update(status,reviewed_by,reference,reviewed_at) on public.evidence_reviews from authenticated;

alter function private.round_one_score(public.applications,public.jobs) rename to round_one_score_verified_v1;
create function private.round_one_score(a public.applications,j public.jobs) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; parts jsonb:='[]'; p jsonb; f public.application_files; state jsonb; points numeric; total numeric:=0; alerts integer:=0; maximum numeric; n numeric;
begin
  base:=private.round_one_score_verified_v1(a,j);
  for p in select value from jsonb_array_elements(base->'contributions') loop
    if p->>'key' in ('english','achievement') then
      points:=0;
      select * into f from public.application_files where application_id=a.id and kind=p->>'key' order by created_at desc,id desc limit 1;
      if f.id is not null then
        state:=private.evidence_assessment(f.id);
        if state->>'status'='exception' then alerts:=alerts+1;end if;
        if state->>'status' in ('automatic','accepted') then
          if f.kind='achievement' then points:=case f.declared_fields->>'level' when 'school' then 4 when 'national' then 7 when 'international' then 10 else 0 end;
          else
            maximum:=case f.declared_fields->>'credential' when 'IELTS' then 9 when 'TOEIC' then 990 when 'TOEFL' then 120 else null end;
            if maximum is not null and length(f.declared_fields->>'score')<10 and f.declared_fields->>'score' ~ '^[0-9]+([.][0-9]+)?$' then
              n:=(f.declared_fields->>'score')::numeric;
              if n between 0 and maximum and (case when f.declared_fields->>'credential'='IELTS' then n*2=trunc(n*2) else n=trunc(n) end) then points:=n/maximum*15;end if;
            end if;
          end if;
        end if;
      end if;
      p:=p||jsonb_build_object('value',points,'label',case when p->>'key'='english' then 'Ngoại ngữ khớp tự động / HR xử lý ngoại lệ' else 'Thành tích khớp tự động / HR xử lý ngoại lệ' end);
    end if;
    total:=total+(p->>'value')::numeric;parts:=parts||jsonb_build_array(p);
  end loop;
  return base||jsonb_build_object('total',round(least(100,greatest(0,total)),1),'contributions',parts,'evidenceAlerts',alerts);
end $$;
revoke all on function private.round_one_score(public.applications,public.jobs) from public,anon,authenticated;
create or replace function public.round_one_report(job_filter uuid default null,major_filter text default 'all') returns jsonb
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
    ) select jsonb_build_object('version','round-one-v2-evidence-exceptions','threshold',75,'total',count(*),'qualified',count(*) filter(where rank is not null),
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

create or replace function public.invite_round_one(application_ids uuid[],job_filter uuid default null,major_filter text default 'all') returns jsonb
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
    values(target,(item->'score'->>'total')::numeric,jsonb_build_object('jobId',job_filter,'major',major_filter,'applicationRevision',app.revision,'version','round-one-v2-evidence-exceptions','score',item->'score')) returning * into existing;
    update public.applications set stage='interview',status='passed' where id=target;
    output:=output||jsonb_build_array(to_jsonb(existing));
  end loop;
  return output;
end $$;
revoke all on function public.invite_round_one(uuid[],uuid,text) from public,anon;
grant execute on function public.invite_round_one(uuid[],uuid,text) to authenticated;

commit;
