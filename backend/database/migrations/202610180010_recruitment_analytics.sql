begin;
create function public.recruitment_analytics(job_filter uuid, target_month date, as_of date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_hr() then raise exception 'HR access required' using errcode='42501';end if;
  if target_month is null or as_of is null or not isfinite(target_month) or not isfinite(as_of)
    or target_month<>date_trunc('month',target_month)::date or target_month not between date '2000-01-01' and date '2100-12-01' or as_of not between date '2000-01-01' and date '2100-12-31' then raise exception 'Invalid analytics dates' using errcode='22023';end if;
  return (with scoped_jobs as (
    select id,title from public.jobs where job_filter is null or id=job_filter
  ), pool as (
    select a.*,o.id as offer_id,o.status as offer_status,o.start_date,
      coalesce(private.offer_actionable(o),false) as pending_valid,
      coalesce(o.status='accepted' and a.stage='accepted' and a.status='passed' and o.decision_id=d.id and d.result='hire',false) as accepted_valid,
      exists(select 1 from public.interview_invitations where application_id=a.id) as invited,
      exists(select 1 from public.coding_evaluations where application_id=a.id) and exists(select 1 from public.interview_evaluations where application_id=a.id) as evaluated,
      exists(select 1 from public.hiring_decisions where application_id=a.id and result='hire') as selected,
      exists(select 1 from public.recruitment_offers where application_id=a.id) as issued
    from public.applications a join scoped_jobs j on j.id=a.job_id
    left join lateral(select * from public.recruitment_offers where application_id=a.id order by issued_at desc,id desc limit 1) o on true
    left join lateral(select * from public.hiring_decisions where application_id=a.id order by decided_at desc,id desc limit 1) d on true
  ), month_pool as (
    select * from pool where start_date>=target_month and start_date<(target_month+interval '1 month')::date
  ), month_series as (
    select (target_month+n*interval '1 month')::date as month from generate_series(0,5) n
  ), monthly as (
    select m.month,count(*) filter(where p.accepted_valid and p.start_date>=as_of) as accepted,
      count(*) filter(where p.offer_status='pending' and p.pending_valid and p.start_date>=as_of) as pending
    from month_series m left join pool p on p.start_date>=m.month and p.start_date<(m.month+interval '1 month')::date group by m.month
  ), per_job as (
    select j.id,j.title,count(p.id) as applications,
      count(*) filter(where p.offer_status='pending' and p.pending_valid) as pending,
      count(*) filter(where p.offer_status='accepted') as accepted,count(*) filter(where p.offer_status='declined') as declined,
      count(*) filter(where p.accepted_valid and p.start_date>=greatest(target_month,as_of) and p.start_date<(target_month+interval '1 month')::date) as upcoming_accepted,
      count(*) filter(where p.offer_status='pending' and p.pending_valid and p.start_date>=greatest(target_month,as_of) and p.start_date<(target_month+interval '1 month')::date) as upcoming_pending
    from scoped_jobs j left join pool p on p.job_id=j.id group by j.id,j.title
  ) select jsonb_build_object('version','recruitment-analytics-v1','month',to_char(target_month,'YYYY-MM'),'asOf',to_char(as_of,'YYYY-MM-DD'),'computedAt',current_timestamp,'jobCount',(select count(*) from scoped_jobs),
    'applications',(select count(*) from pool),
    'workflow',(select jsonb_build_object('applied',count(*),'invited',count(*) filter(where invited),'evaluated',count(*) filter(where evaluated),'selected',count(*) filter(where selected),'issued',count(*) filter(where issued),'accepted',count(*) filter(where offer_status='accepted')) from pool),
    'offers',(select jsonb_build_object('pending',count(*) filter(where offer_status='pending' and pending_valid),'stalePending',count(*) filter(where offer_status='pending' and not pending_valid),'accepted',count(*) filter(where offer_status='accepted'),'declined',count(*) filter(where offer_status='declined'),
      'supersededRecords',(select count(*) from public.recruitment_offers o join pool a on a.id=o.application_id where o.status='superseded')) from pool),
    'starts',(select jsonb_build_object('accepted',count(*) filter(where accepted_valid),'upcomingAccepted',count(*) filter(where accepted_valid and start_date>=as_of),
      'upcomingPending',count(*) filter(where offer_status='pending' and pending_valid and start_date>=as_of),
      'pastAccepted',count(*) filter(where accepted_valid and start_date<as_of),'pastPending',count(*) filter(where offer_status='pending' and pending_valid and start_date<as_of),
      'expectedPending',count(*) filter(where offer_status='pending' and pending_valid and start_date>=as_of)*0.75,
      'expectedUpcoming',count(*) filter(where accepted_valid and start_date>=as_of)+count(*) filter(where offer_status='pending' and pending_valid and start_date>=as_of)*0.75) from month_pool),
    'months',(select jsonb_agg(jsonb_build_object('month',to_char(month,'YYYY-MM'),'accepted',accepted,'pending',pending,'expected',accepted+pending*0.75) order by month) from monthly),
    'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'applications',applications,'pending',pending,'accepted',accepted,'declined',declined,'upcomingAccepted',upcoming_accepted,'upcomingPending',upcoming_pending) order by title,id) from (select * from per_job order by title,id limit 200) visible),'[]'::jsonb)
  ));
end $$;
revoke all on function public.recruitment_analytics(uuid,date,date) from public,anon;
grant execute on function public.recruitment_analytics(uuid,date,date) to authenticated;
commit;
