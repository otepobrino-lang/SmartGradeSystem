
SELECT
    e.id AS enrollment_id,
    e.student_id,
    e.class_id,
    e.is_active,
    c.section,
    co.course_code,
    co.title AS course_title
FROM public.enrollments e
LEFT JOIN public.classes c
    ON c.id = e.class_id
LEFT JOIN public.courses co
    ON co.id = c.course_id
ORDER BY e.created_at DESC
LIMIT 20;
