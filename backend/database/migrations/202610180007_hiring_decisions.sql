begin;
alter table public.hiring_decisions add column source_basis text;

create function private.hiring_basis(target uuid) returns text
language sql stable security definer set search_path='' as $$
  select md5(jsonb_build_object('version','hiring-v1','application',to_jsonb(a),'job',to_jsonb(j),
    'roundOne',private.round_one_score(a,j),'invitation',to_jsonb(v),'coding',to_jsonb(c),'interview',to_jsonb(i))::text)
  from public.applications a join public.jobs j on j.id=a.job_id
  left join public.interview_invitations v on v.application_id=a.id
  left join public.coding_evaluations c on c.application_id=a.id
  left join public.interview_evaluations i on i.application_id=a.id where a.id=target;
$$;
revoke all on function private.hiring_basis(uuid) from public,anon,authenticated;

create function public.hiring_report(target uuid, weights jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare app public.applications; job public.jobs; first_score jsonb; coding_score numeric; interview_score numeric; reasons text[]:='{}'; k text; n numeric;
begin
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501'; end if;
  if weights is null or jsonb_typeof(weights)<>'object' or not(weights ?& array['roundOne','coding','interview']) or weights-array['roundOne','coding','interview']<>'{}'::jsonb then raise exception 'Invalid weights' using errcode='22023'; end if;
  foreach k in array array['roundOne','coding','interview'] loop
    if jsonb_typeof(weights->k) is distinct from 'number' then raise exception 'Invalid weights' using errcode='22023'; end if;
    n:=(weights->>k)::numeric;
    if n<0 or n>100 or n<>trunc(n) then raise exception 'Invalid weights' using errcode='22023'; end if;
  end loop;
  if (weights->>'roundOne')::numeric+(weights->>'coding')::numeric+(weights->>'interview')::numeric<>100 then raise exception 'Weights must total 100' using errcode='22023'; end if;
  select * into app from public.applications where id=target;
  if app.id is null then return null; end if;
  select * into strict job from public.jobs where id=app.job_id;
  first_score:=private.round_one_score(app,job);
  select score into coding_score from public.coding_evaluations where application_id=target;
  select overall_score into interview_score from public.interview_evaluations where application_id=target;
  if app.stage not in ('interview','offer') then reasons:=array_append(reasons,'Hồ sơ không ở giai đoạn phỏng vấn hoặc offer'); end if;
  if not exists(select 1 from public.interview_invitations where application_id=target) then reasons:=array_append(reasons,'Chưa có lời mời vòng 2'); end if;
  if app.contact_email !~* '^[^@\s]+@gm\.uit\.edu\.vn$' or app.major not in ('AI','KHMT','KTPM') then reasons:=array_append(reasons,'Email hoặc ngành học không hợp lệ'); end if;
  if job.status<>'active' then reasons:=array_append(reasons,'Vị trí đã đóng'); end if;
  if (first_score->>'gpaNormalized')::numeric<job.min_gpa then reasons:=array_append(reasons,'GPA chưa đạt mức vị trí'); end if;
  if coding_score is null then reasons:=array_append(reasons,'Chưa có điểm bài test'); end if;
  if interview_score is null then reasons:=array_append(reasons,'Chưa có phiếu phỏng vấn đầy đủ'); end if;
  return jsonb_build_object('revision',app.revision,'basis',private.hiring_basis(target),'weights',weights,
    'roundOne',(first_score->>'total')::numeric,'coding',coding_score,'interview',interview_score,'reasons',to_jsonb(reasons),
    'finalScore',case when cardinality(reasons)=0 then round(((first_score->>'total')::numeric*(weights->>'roundOne')::numeric+coding_score*(weights->>'coding')::numeric+interview_score*(weights->>'interview')::numeric)/100,2) else null end,
    'history',coalesce((select jsonb_agg(to_jsonb(d) order by d.decided_at desc,d.id desc) from public.hiring_decisions d where d.application_id=target),'[]'::jsonb));
end $$;
revoke all on function public.hiring_report(uuid,jsonb) from public,anon;
grant execute on function public.hiring_report(uuid,jsonb) to authenticated;

-- Recompute all snapshot fields even if an internal writer supplies scores.
create or replace function private.capture_decision() returns trigger
language plpgsql security definer set search_path='' as $$
declare report jsonb;
begin
  report:=public.hiring_report(new.application_id,jsonb_build_object('roundOne',new.round_one_weight,'coding',new.coding_weight,'interview',new.interview_weight));
  if report is null or report->>'finalScore' is null then raise exception 'Incomplete or ineligible application' using errcode='22023'; end if;
  new.application_revision:=(report->>'revision')::bigint;
  new.round_one_score:=(report->>'roundOne')::numeric;
  new.coding_score:=(report->>'coding')::numeric;
  new.interview_score:=(report->>'interview')::numeric;
  new.source_basis:=report->>'basis';
  new.decided_by:=auth.uid();new.decided_at:=clock_timestamp();return new;
end $$;

create function public.save_hiring_decision(target uuid, expected_basis text, weights jsonb, outcome text, explanation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare report jsonb; decision public.hiring_decisions;
begin
  perform pg_advisory_xact_lock(170018,1);
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501'; end if;
  perform 1 from public.applications where id=target for update;
  report:=public.hiring_report(target,weights);
  if report is null then raise exception 'Unknown application' using errcode='22023'; end if;
  if expected_basis is null or expected_basis<>report->>'basis' then raise exception 'Stale hiring basis' using errcode='40001'; end if;
  if report->>'finalScore' is null then raise exception 'Incomplete or ineligible application' using errcode='22023'; end if;
  if outcome is null or outcome not in ('hire','reserve','reject') or explanation is null or length(trim(explanation)) not between 1 and 5000 then raise exception 'Invalid decision' using errcode='22023'; end if;
  -- State transition and snapshot are committed together; offer is not acceptance.
  update public.applications set stage=case when outcome='hire' then 'offer' else 'interview' end,
    status=case outcome when 'hire' then 'passed' when 'reserve' then 'hold' else 'rejected' end where id=target;
  insert into public.hiring_decisions(application_id,result,reason,round_one_score,round_one_weight,coding_weight,interview_weight)
    values(target,outcome,trim(explanation),0,(weights->>'roundOne')::numeric,(weights->>'coding')::numeric,(weights->>'interview')::numeric) returning * into decision;
  return to_jsonb(decision);
end $$;
revoke all on function public.save_hiring_decision(uuid,text,jsonb,text,text) from public,anon;
grant execute on function public.save_hiring_decision(uuid,text,jsonb,text,text) to authenticated;
revoke insert(application_id,result,reason,decided_by,round_one_score,round_one_weight,coding_weight,interview_weight) on public.hiring_decisions from authenticated;
-- Evaluation writes take the same lock before touching application rows, avoiding lock inversion.
create trigger coding_write_lock before insert or update or delete on public.coding_evaluations for each statement execute function private.round_one_write_lock();
create trigger interview_write_lock before insert or update or delete on public.interview_evaluations for each statement execute function private.round_one_write_lock();
commit;
