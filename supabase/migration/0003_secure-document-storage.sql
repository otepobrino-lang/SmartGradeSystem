
insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'smartgrade-submissions',
    'smartgrade-submissions',
    false,
    10485760,
    array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ]
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

create policy smartgrade_submissions_read
on storage.objects
for select
to authenticated
using (
    bucket_id = 'smartgrade-submissions'
    and (
        (
            (storage.foldername(name))[2] = auth.uid()::text
            and exists (
                select 1
                from public.assignments a
                where a.id::text = (storage.foldername(name))[1]
                  and public.is_enrolled_in_class(a.class_id, auth.uid())
            )
        )
        or exists (
            select 1
            from public.assignments a
            where a.id::text = (storage.foldername(name))[1]
              and public.is_class_faculty(a.class_id)
        )
        or public.current_app_role() in (
            'dean',
            'guidance',
            'registrar',
            'administrator'
        )
    )
);

create policy smartgrade_submissions_upload
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'smartgrade-submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
        select 1
        from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.is_published = true
          and public.is_enrolled_in_class(a.class_id, auth.uid())
    )
);
