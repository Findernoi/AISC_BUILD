begin;
-- Return only the calling account's role; membership remains private.
create function public.recruitment_role() returns text
language sql stable security invoker set search_path = '' as $$
  select case when private.is_hr() then 'hr' else 'candidate' end;
$$;
revoke all on function public.recruitment_role() from public, anon;
grant execute on function public.recruitment_role() to authenticated;
commit;
