-- Private photos for the memories page. The first path segment is the auth user ID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('yomi-memories', 'yomi-memories', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "yomi_memories_read_own" on storage.objects
for select to authenticated
using (bucket_id = 'yomi-memories' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "yomi_memories_upload_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'yomi-memories' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "yomi_memories_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'yomi-memories' and (storage.foldername(name))[1] = (select auth.uid())::text);
