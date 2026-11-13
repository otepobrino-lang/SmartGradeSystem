create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create type public.app_role as enum ('faculty', 'dean', 'guidance', 'registrar', 'student', 'administrator');
create type public.term_status as enum ('planned', 'active', 'completed', 'archived');
create type public.assignment_type as enum ('summative', 'laboratory', 'project', 'quiz', 'exam', 'other');
create type public.grade_status as enum ('draft', 'submitted', 'approved', 'published', 'returned');
create type public.attendance_status as enum ('present', 'late', 'absent', 'excused');
create type public.risk_level as enum ('low', 'moderate', 'high', 'critical');
create type public.review_status as enum ('pending', 'reviewed', 'dismissed', 'action_required');

create table public.departments (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null unique,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    institutional_email text unique,
    role public.app_role not null default 'student',
    department_id uuid references public.departments(id) on delete set null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.academic_terms (
    id uuid primary key default gen_random_uuid(),
    academic_year text not null,
    term_name text not null,
    starts_on date not null,
    ends_on date not null,
    status public.term_status not null default 'planned',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint academic_terms_date_check check (ends_on >= starts_on),
    constraint academic_terms_unique unique (academic_year, term_name)
);

create table public.courses (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null references public.departments(id) on delete restrict,
    course_code text not null,
    title text not null,
    description text,
    units numeric(4,1) not null default 3,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint courses_units_check check (units > 0),
    constraint courses_code_department_unique unique (department_id, course_code)
);

create table public.classes (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete restrict,
    term_id uuid not null references public.academic_terms(id) on delete restrict,
    faculty_id uuid not null references public.profiles(id) on delete restrict,
    section text not null,
    room text,
    schedule_text text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint classes_section_unique unique (course_id, term_id, section)
);

create table public.enrollments (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete restrict,
    enrolled_at timestamptz not null default now(),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint enrollments_class_student_unique unique (class_id, student_id)
);

create table public.assignments (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    created_by uuid not null references public.profiles(id) on delete restrict,
    title text not null,
    description text,
    assignment_type public.assignment_type not null,
    max_score numeric(8,2) not null,
    due_at timestamptz,
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint assignments_max_score_check check (max_score > 0)
);

create table public.submissions (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references public.assignments(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete restrict,
    storage_path text,
    extracted_text text,
    submitted_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint submissions_assignment_student_unique unique (assignment_id, student_id)
);

create table public.grade_components (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    name text not null,
    assignment_type public.assignment_type not null,
    weight_percent numeric(5,2) not null,
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint grade_components_weight_check check (weight_percent > 0 and weight_percent <= 100),
    constraint grade_components_class_name_unique unique (class_id, name)
);

create table public.grades (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete restrict,
    term_id uuid not null references public.academic_terms(id) on delete restrict,
    raw_score numeric(8,2),
    final_grade numeric(5,2),
    status public.grade_status not null default 'draft',
    faculty_notes text,
    approved_by uuid references public.profiles(id) on delete set null,
    approved_at timestamptz,
    published_at timestamptz,
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint grades_score_nonnegative check (raw_score is null or raw_score >= 0),
    constraint grades_final_range check (final_grade is null or (final_grade >= 0 and final_grade <= 100)),
    constraint grades_class_student_term_unique unique (class_id, student_id, term_id)
);

create table public.attendance_records (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete restrict,
    recorded_by uuid not null references public.profiles(id) on delete restrict,
    session_date date not null,
    status public.attendance_status not null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint attendance_class_student_date_unique unique (class_id, student_id, session_date)
);

create table public.risk_assessments (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.profiles(id) on delete restrict,
    class_id uuid references public.classes(id) on delete cascade,
    assessed_by uuid references public.profiles(id) on delete set null,
    risk_level public.risk_level not null,
    review_status public.review_status not null default 'pending',
    indicators jsonb not null default '[]'::jsonb,
    recommendations jsonb not null default '[]'::jsonb,
    model_id text,
    source_window_start date,
    source_window_end date,
    reviewed_by uuid references public.profiles(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint risk_assessments_date_check check (
        source_window_start is null or source_window_end is null or source_window_end >= source_window_start
    )
);

create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    body text not null,
    category text not null,
    related_record_id uuid,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.profiles(id) on delete set null,
    action text not null,
    entity_type text not null,
    entity_id uuid,
    details jsonb not null default '{}'::jsonb,
    request_id text,
    created_at timestamptz not null default now()
);

create index profiles_department_idx on public.profiles(department_id);
create index classes_faculty_term_idx on public.classes(faculty_id, term_id);
create index classes_course_term_idx on public.classes(course_id, term_id);
create index enrollments_student_idx on public.enrollments(student_id, is_active);
create index assignments_class_due_idx on public.assignments(class_id, due_at);
create index submissions_student_idx on public.submissions(student_id, submitted_at desc);
create index grades_student_term_idx on public.grades(student_id, term_id);
create index attendance_student_date_idx on public.attendance_records(student_id, session_date desc);
create index risk_assessments_student_created_idx on public.risk_assessments(student_id, created_at desc);
create index risk_assessments_status_level_idx on public.risk_assessments(review_status, risk_level);
create index notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
    select p.role
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
    limit 1
$$;

create function public.is_class_faculty(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.classes c
        where c.id = target_class_id
          and c.faculty_id = auth.uid()
    )
$$;

create function public.is_enrolled_in_class(target_class_id uuid, target_student_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments e
        where e.class_id = target_class_id
          and e.student_id = target_student_id
          and e.is_active = true
    )
$$;

create function public.is_academic_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(public.current_app_role() in ('dean', 'guidance', 'registrar', 'administrator'), false)
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_class_faculty(uuid) from public;
revoke all on function public.is_enrolled_in_class(uuid, uuid) from public;
revoke all on function public.is_academic_staff() from public;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_class_faculty(uuid) to authenticated;
grant execute on function public.is_enrolled_in_class(uuid, uuid) to authenticated;
grant execute on function public.is_academic_staff() to authenticated;

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'departments', 'profiles', 'academic_terms', 'courses', 'classes',
        'enrollments', 'assignments', 'submissions', 'grade_components',
        'grades', 'attendance_records', 'risk_assessments', 'notifications', 'audit_logs'
    ]
    loop
        execute format('alter table public.%I enable row level security', table_name);
    end loop;
end;
$$;

create policy departments_read_authenticated on public.departments
for select to authenticated
using (is_active = true or public.current_app_role() in ('dean', 'registrar', 'administrator'));

create policy departments_manage_administrators on public.departments
for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');

create policy profiles_read_self_or_authorized_staff on public.profiles
for select to authenticated
using (
    id = auth.uid()
    or public.current_app_role() in ('dean', 'registrar', 'administrator')
    or (public.current_app_role() = 'guidance' and role = 'student')
    or (public.current_app_role() = 'faculty' and exists (
        select 1
        from public.enrollments e
        join public.classes c on c.id = e.class_id
        where e.student_id = profiles.id
          and c.faculty_id = auth.uid()
          and e.is_active = true
    ))
);

create policy profiles_update_self_nonprivileged on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create function public.prevent_self_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() = old.id and public.current_app_role() <> 'administrator' then
        if new.role is distinct from old.role
            or new.is_active is distinct from old.is_active
            or new.department_id is distinct from old.department_id then
            raise exception 'Profile privilege fields cannot be changed by the account owner';
        end if;
    end if;
    return new;
end;
$$;

create trigger profiles_prevent_self_privilege_changes
before update on public.profiles
for each row execute function public.prevent_self_privilege_changes();

revoke all on function public.prevent_self_privilege_changes() from public;

create policy profiles_manage_administrators on public.profiles
for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');

create policy academic_terms_read_authenticated on public.academic_terms
for select to authenticated
using (true);

create policy academic_terms_manage_authorized on public.academic_terms
for all to authenticated
using (public.current_app_role() in ('dean', 'registrar', 'administrator'))
with check (public.current_app_role() in ('dean', 'registrar', 'administrator'));

create policy courses_read_authenticated on public.courses
for select to authenticated
using (true);

create policy courses_manage_authorized on public.courses
for all to authenticated
using (public.current_app_role() in ('dean', 'registrar', 'administrator'))
with check (public.current_app_role() in ('dean', 'registrar', 'administrator'));

create policy classes_read_authorized on public.classes
for select to authenticated
using (
    faculty_id = auth.uid()
    or public.current_app_role() in ('dean', 'registrar', 'administrator')
    or public.is_enrolled_in_class(id, auth.uid())
    or (public.current_app_role() = 'guidance' and true)
);

create policy classes_manage_authorized on public.classes
for all to authenticated
using (public.current_app_role() in ('dean', 'registrar', 'administrator'))
with check (public.current_app_role() in ('dean', 'registrar', 'administrator'));

create policy enrollments_read_authorized on public.enrollments
for select to authenticated
using (
    student_id = auth.uid()
    or public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'registrar', 'administrator')
    or public.current_app_role() = 'guidance'
);

create policy enrollments_manage_authorized on public.enrollments
for all to authenticated
using (public.current_app_role() in ('dean', 'registrar', 'administrator'))
with check (public.current_app_role() in ('dean', 'registrar', 'administrator'));

create policy assignments_read_authorized on public.assignments
for select to authenticated
using (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'registrar', 'administrator', 'guidance')
    or (is_published = true and public.is_enrolled_in_class(class_id, auth.uid()))
);

create policy assignments_manage_faculty_or_admin on public.assignments
for all to authenticated
using (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'administrator')
)
with check (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'administrator')
);

create policy submissions_read_authorized on public.submissions
for select to authenticated
using (
    student_id = auth.uid()
    or exists (
        select 1 from public.assignments a
        where a.id = submissions.assignment_id
          and public.is_class_faculty(a.class_id)
    )
    or public.current_app_role() in ('dean', 'registrar', 'administrator', 'guidance')
);

create policy submissions_insert_student on public.submissions
for insert to authenticated
with check (
    student_id = auth.uid()
    and exists (
        select 1 from public.assignments a
        where a.id = assignment_id
          and a.is_published = true
          and public.is_enrolled_in_class(a.class_id, auth.uid())
    )
);

create policy submissions_manage_faculty_or_admin on public.submissions
for update to authenticated
using (
    exists (
        select 1 from public.assignments a
        where a.id = submissions.assignment_id
          and public.is_class_faculty(a.class_id)
    )
    or public.current_app_role() in ('dean', 'administrator')
)
with check (
    exists (
        select 1 from public.assignments a
        where a.id = submissions.assignment_id
          and public.is_class_faculty(a.class_id)
    )
    or public.current_app_role() in ('dean', 'administrator')
);

create policy grade_components_read_class_access on public.grade_components
for select to authenticated
using (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'registrar', 'administrator')
    or public.is_enrolled_in_class(class_id, auth.uid())
);

create policy grade_components_manage_faculty_or_admin on public.grade_components
for all to authenticated
using (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'administrator')
)
with check (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'administrator')
);

create policy grades_read_authorized on public.grades
for select to authenticated
using (
    student_id = auth.uid()
    or public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'registrar', 'administrator')
    or public.current_app_role() = 'guidance'
);

create policy grades_insert_faculty_or_admin on public.grades
for insert to authenticated
with check (
    created_by = auth.uid()
    and (
        public.is_class_faculty(class_id)
        or public.current_app_role() in ('dean', 'administrator')
    )
);

create policy grades_update_faculty_or_admin on public.grades
for update to authenticated
using (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'administrator')
)
with check (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'administrator')
);

create policy attendance_read_authorized on public.attendance_records
for select to authenticated
using (
    student_id = auth.uid()
    or public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'registrar', 'administrator', 'guidance')
);

create policy attendance_manage_faculty_or_admin on public.attendance_records
for all to authenticated
using (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'administrator')
)
with check (
    recorded_by = auth.uid()
    and (
        public.is_class_faculty(class_id)
        or public.current_app_role() in ('dean', 'administrator')
    )
);

create policy risk_assessments_read_authorized on public.risk_assessments
for select to authenticated
using (
    public.current_app_role() in ('dean', 'guidance', 'administrator')
    or (student_id = auth.uid() and review_status = 'reviewed')
    or (public.current_app_role() = 'faculty' and class_id is not null and public.is_class_faculty(class_id))
);

create policy risk_assessments_manage_authorized on public.risk_assessments
for all to authenticated
using (public.current_app_role() in ('dean', 'guidance', 'administrator'))
with check (public.current_app_role() in ('dean', 'guidance', 'administrator'));

create policy notifications_read_own on public.notifications
for select to authenticated
using (recipient_id = auth.uid());

create policy notifications_update_own on public.notifications
for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy notifications_insert_authorized on public.notifications
for insert to authenticated
with check (
    public.current_app_role() in ('faculty', 'dean', 'guidance', 'registrar', 'administrator')
);

create policy audit_logs_read_authorized on public.audit_logs
for select to authenticated
using (public.current_app_role() in ('dean', 'registrar', 'administrator'));

create policy audit_logs_insert_authenticated on public.audit_logs
for insert to authenticated
with check (actor_id = auth.uid() or actor_id is null);

create trigger departments_set_updated_at before update on public.departments for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger academic_terms_set_updated_at before update on public.academic_terms for each row execute function public.set_updated_at();
create trigger courses_set_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger classes_set_updated_at before update on public.classes for each row execute function public.set_updated_at();
create trigger enrollments_set_updated_at before update on public.enrollments for each row execute function public.set_updated_at();
create trigger assignments_set_updated_at before update on public.assignments for each row execute function public.set_updated_at();
create trigger submissions_set_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger grade_components_set_updated_at before update on public.grade_components for each row execute function public.set_updated_at();
create trigger grades_set_updated_at before update on public.grades for each row execute function public.set_updated_at();
create trigger attendance_records_set_updated_at before update on public.attendance_records for each row execute function public.set_updated_at();
create trigger risk_assessments_set_updated_at before update on public.risk_assessments for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, full_name, institutional_email, role)
    values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'New User'),
        new.email,
        'student'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

revoke all on function public.handle_new_auth_user() from public;

grant select on public.departments, public.profiles, public.academic_terms, public.courses, public.classes, public.enrollments, public.assignments, public.submissions, public.grade_components, public.grades, public.attendance_records, public.risk_assessments, public.notifications, public.audit_logs to authenticated;
grant insert, update, delete on public.departments, public.academic_terms, public.courses, public.classes, public.enrollments, public.assignments, public.submissions, public.grade_components, public.grades, public.attendance_records, public.risk_assessments, public.notifications, public.audit_logs to authenticated;
grant update on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
