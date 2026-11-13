-- SmartGrade configurable component-based grading migration
-- Review in a staging project before applying to production.
-- Formula: for each grade component, average (assessment score / max score) * 100
-- across graded assignments of the component's assignment_type; multiply each
-- component percentage by its weight_percent / 100; sum the weighted contributions.
-- By default, every configured component must have at least one scored assessment
-- for a student before a final grade is returned.

begin;

create table if not exists public.grade_calculation_settings (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    term_id uuid not null references public.academic_terms(id) on delete cascade,
    formula_method text not null default 'weighted_category_average'
        check (formula_method in ('weighted_category_average')),
    decimal_places smallint not null default 2
        check (decimal_places between 0 and 4),
    require_all_components boolean not null default true,
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint grade_calculation_settings_class_term_unique unique (class_id, term_id)
);

create table if not exists public.assessment_scores (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references public.assignments(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete restrict,
    score numeric(8,2) not null check (score >= 0),
    feedback text,
    graded_by uuid not null references public.profiles(id) on delete restrict,
    graded_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint assessment_scores_assignment_student_unique unique (assignment_id, student_id)
);

create index if not exists assessment_scores_student_idx
    on public.assessment_scores (student_id);
create index if not exists assignments_class_type_idx
    on public.assignments (class_id, assignment_type);
create index if not exists grade_components_class_type_idx
    on public.grade_components (class_id, assignment_type);

alter table public.grade_calculation_settings enable row level security;
alter table public.assessment_scores enable row level security;

drop policy if exists grade_calculation_settings_read_class_access on public.grade_calculation_settings;
create policy grade_calculation_settings_read_class_access
on public.grade_calculation_settings
for select to authenticated
using (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'registrar', 'administrator')
    or public.is_enrolled_in_class(class_id, auth.uid())
);

drop policy if exists grade_calculation_settings_manage_faculty_or_admin on public.grade_calculation_settings;
create policy grade_calculation_settings_manage_faculty_or_admin
on public.grade_calculation_settings
for all to authenticated
using (
    public.is_class_faculty(class_id)
    or public.current_app_role() in ('dean', 'administrator')
)
with check (
    created_by = auth.uid()
    and (
        public.is_class_faculty(class_id)
        or public.current_app_role() in ('dean', 'administrator')
    )
);

drop policy if exists assessment_scores_read_authorized on public.assessment_scores;
create policy assessment_scores_read_authorized
on public.assessment_scores
for select to authenticated
using (
    student_id = auth.uid()
    or exists (
        select 1
        from public.assignments a
        where a.id = assessment_scores.assignment_id
          and public.is_class_faculty(a.class_id)
    )
    or public.current_app_role() in ('dean', 'registrar', 'administrator', 'guidance')
);

drop policy if exists assessment_scores_insert_faculty_or_admin on public.assessment_scores;
create policy assessment_scores_insert_faculty_or_admin
on public.assessment_scores
for insert to authenticated
with check (
    graded_by = auth.uid()
    and exists (
        select 1
        from public.assignments a
        join public.enrollments e on e.class_id = a.class_id
        where a.id = assessment_scores.assignment_id
          and e.student_id = assessment_scores.student_id
          and e.is_active = true
          and (
              public.is_class_faculty(a.class_id)
              or public.current_app_role() in ('dean', 'administrator')
          )
    )
);

drop policy if exists assessment_scores_update_faculty_or_admin on public.assessment_scores;
create policy assessment_scores_update_faculty_or_admin
on public.assessment_scores
for update to authenticated
using (
    exists (
        select 1 from public.assignments a
        where a.id = assessment_scores.assignment_id
          and (
              public.is_class_faculty(a.class_id)
              or public.current_app_role() in ('dean', 'administrator')
          )
    )
)
with check (
    graded_by = auth.uid()
    and exists (
        select 1
        from public.assignments a
        join public.enrollments e on e.class_id = a.class_id
        where a.id = assessment_scores.assignment_id
          and e.student_id = assessment_scores.student_id
          and e.is_active = true
          and (
              public.is_class_faculty(a.class_id)
              or public.current_app_role() in ('dean', 'administrator')
          )
    )
);

create or replace function public.validate_assessment_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    assignment_max numeric(8,2);
    assignment_class uuid;
begin
    select a.max_score, a.class_id
      into assignment_max, assignment_class
    from public.assignments a
    where a.id = new.assignment_id;

    if assignment_max is null then
        raise exception 'Assignment does not exist or has no maximum score';
    end if;

    if new.score > assignment_max then
        raise exception 'Score (%) cannot exceed assignment maximum (%)', new.score, assignment_max;
    end if;

    if not exists (
        select 1 from public.enrollments e
        where e.class_id = assignment_class
          and e.student_id = new.student_id
          and e.is_active = true
    ) then
        raise exception 'Student must have an active enrollment in the assignment class';
    end if;

    new.updated_at := now();
    if tg_op = 'INSERT' then
        new.graded_at := coalesce(new.graded_at, now());
    else
        new.graded_at := now();
    end if;
    return new;
end;
$$;

drop trigger if exists assessment_scores_validate on public.assessment_scores;
create trigger assessment_scores_validate
before insert or update on public.assessment_scores
for each row execute function public.validate_assessment_score();

create or replace function public.calculate_student_final_grade(
    p_class_id uuid,
    p_student_id uuid,
    p_term_id uuid
)
returns numeric
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
    settings_row public.grade_calculation_settings%rowtype;
    total_weight numeric(7,2);
    missing_components integer;
    calculated_grade numeric;
begin
    if not (
        public.is_class_faculty(p_class_id)
        or public.current_app_role() in ('dean', 'administrator')
    ) then
        raise exception 'Not authorized to calculate grades for this class';
    end if;

    if not exists (
        select 1 from public.enrollments e
        where e.class_id = p_class_id
          and e.student_id = p_student_id
          and e.is_active = true
    ) then
        raise exception 'Student is not actively enrolled in this class';
    end if;

    if not exists (
        select 1 from public.classes c
        where c.id = p_class_id and c.term_id = p_term_id
    ) then
        raise exception 'The selected academic term does not match this class';
    end if;

    select * into settings_row
    from public.grade_calculation_settings s
    where s.class_id = p_class_id and s.term_id = p_term_id;

    if not found then
        raise exception 'Configure grading settings for this class and academic term first';
    end if;

    select coalesce(sum(gc.weight_percent), 0)
      into total_weight
    from public.grade_components gc
    where gc.class_id = p_class_id;

    if total_weight <> 100 then
        raise exception 'Grade component weights must total exactly 100%%; current total is %', total_weight;
    end if;

    select count(*)
      into missing_components
    from public.grade_components gc
    where gc.class_id = p_class_id
      and not exists (
          select 1
          from public.assignments a
          join public.assessment_scores s on s.assignment_id = a.id
          where a.class_id = p_class_id
            and a.assignment_type = gc.assignment_type
            and s.student_id = p_student_id
      );

    if settings_row.require_all_components and missing_components > 0 then
        return null;
    end if;

    select round(
        sum(
            gc.weight_percent * coalesce(component_result.average_percent, 0) / 100.0
        ),
        settings_row.decimal_places
    )
    into calculated_grade
    from public.grade_components gc
    left join lateral (
        select avg((s.score / nullif(a.max_score, 0)) * 100.0) as average_percent
        from public.assignments a
        join public.assessment_scores s on s.assignment_id = a.id
        where a.class_id = p_class_id
          and a.assignment_type = gc.assignment_type
          and s.student_id = p_student_id
    ) component_result on true
    where gc.class_id = p_class_id;

    return calculated_grade;
end;
$$;

revoke all on function public.validate_assessment_score() from public;
revoke all on function public.calculate_student_final_grade(uuid, uuid, uuid) from public;
grant execute on function public.calculate_student_final_grade(uuid, uuid, uuid) to authenticated;

commit;
