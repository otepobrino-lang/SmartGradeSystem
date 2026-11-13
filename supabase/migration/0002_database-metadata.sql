
select
    t.table_name,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    count(p.policyname) as policy_count
from information_schema.tables t
join pg_namespace n
    on n.nspname = t.table_schema
join pg_class c
    on c.relnamespace = n.oid
   and c.relname = t.table_name
left join pg_policies p
    on p.schemaname = t.table_schema
   and p.tablename = t.table_name
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and t.table_name in (
      'departments',
      'profiles',
      'academic_terms',
      'courses',
      'classes',
      'enrollments',
      'assignments',
      'submissions',
      'grade_components',
      'grades',
      'attendance_records',
      'risk_assessments',
      'notifications',
      'audit_logs'
  )
group by t.table_name, c.relrowsecurity
order by t.table_name;
