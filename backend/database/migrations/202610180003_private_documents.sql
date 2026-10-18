-- Supabase only: local mode stores bytes outside the public web root.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('application-documents','application-documents',false,10485760,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id='application-documents' and public) then
    raise exception 'application-documents must be private; review existing bucket before proceeding';
  end if;
end $$;
-- Restrictive policy also blocks access through a pre-existing permissive policy.
-- The server authorizes via user-scoped application_files RLS before using storage service credentials.
create policy recruitment_documents_server_only on storage.objects
as restrictive for all to anon, authenticated
using(bucket_id <> 'application-documents')
with check(bucket_id <> 'application-documents');
commit;
