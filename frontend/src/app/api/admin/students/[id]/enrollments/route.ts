import { NextResponse } from "next/server";
import { authorizeAdmin, isAuthorizationError, isUuid } from "@/lib/authorize-admin";

type RouteContext = { params: Promise<{ id: string }> };

async function getStudent(admin: Awaited<ReturnType<typeof authorizeAdmin>> extends infer _T ? any : never, id: string) {
  return admin.from("profiles")
    .select("id, full_name, institutional_email, department_id, program_id, is_active")
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await authorizeAdmin();
    if (isAuthorizationError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });

    const { data: studentProfile, error: studentError } = await getStudent(auth.admin, id);
    if (studentError) {
      console.error("Enrollment student lookup failed:", studentError.message);
      return NextResponse.json({ error: "Unable to load student profile." }, { status: 500 });
    }
    if (!studentProfile) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });

    const [departmentResult, programResult, enrollmentResult, classResult] = await Promise.all([
      studentProfile.department_id
        ? auth.admin.from("departments").select("name").eq("id", studentProfile.department_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      studentProfile.program_id
        ? auth.admin.from("programs").select("program_name").eq("id", studentProfile.program_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      auth.admin.from("enrollments")
        .select("id, class_id, student_id, enrolled_at, is_active")
        .eq("student_id", id)
        .order("created_at", { ascending: false }),
      auth.admin.from("classes")
        .select("id, course_id, term_id, faculty_id, section, room, schedule_text, is_active")
        .eq("is_active", true),
    ]);

    if (departmentResult.error || programResult.error || enrollmentResult.error || classResult.error) {
      console.error("Enrollment data query failed:", {
        department: departmentResult.error?.message,
        program: programResult.error?.message,
        enrollments: enrollmentResult.error?.message,
        classes: classResult.error?.message,
      });
      return NextResponse.json({ error: "Unable to load enrollment data." }, { status: 500 });
    }

    const allEnrollments = enrollmentResult.data ?? [];
    const classes = classResult.data ?? [];
    const classIds = new Set(classes.map((item) => item.id));
    const enrollmentClassIds = new Set(
      allEnrollments.filter((item) => item.is_active).map((item) => item.class_id)
    );

    const referencedClassIds = [...new Set([
      ...allEnrollments.map((item) => item.class_id),
      ...classes.map((item) => item.id),
    ])];

    const classRows = referencedClassIds.length
      ? await auth.admin.from("classes")
          .select("id, course_id, term_id, faculty_id, section, room, schedule_text, is_active")
          .in("id", referencedClassIds)
      : { data: [], error: null };

    if (classRows.error) {
      console.error("Enrollment class details failed:", classRows.error.message);
      return NextResponse.json({ error: "Unable to load class details." }, { status: 500 });
    }

    const classData = classRows.data ?? [];
    const courseIds = [...new Set(classData.map((item) => item.course_id))];
    const termIds = [...new Set(classData.map((item) => item.term_id))];
    const facultyIds = [...new Set(classData.map((item) => item.faculty_id))];

    const [coursesResult, termsResult, facultyResult] = await Promise.all([
      courseIds.length ? auth.admin.from("courses").select("id, course_code, title").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
      termIds.length ? auth.admin.from("academic_terms").select("id, academic_year, term_name").in("id", termIds) : Promise.resolve({ data: [], error: null }),
      facultyIds.length ? auth.admin.from("profiles").select("id, full_name").in("id", facultyIds) : Promise.resolve({ data: [], error: null }),
    ]);

    if (coursesResult.error || termsResult.error || facultyResult.error) {
      console.error("Enrollment lookup details failed:", {
        courses: coursesResult.error?.message,
        terms: termsResult.error?.message,
        faculty: facultyResult.error?.message,
      });
      return NextResponse.json({ error: "Unable to load course, term, or faculty details." }, { status: 500 });
    }

    const courses = new Map((coursesResult.data ?? []).map((item) => [item.id, item]));
    const terms = new Map((termsResult.data ?? []).map((item) => [item.id, item]));
    const faculty = new Map((facultyResult.data ?? []).map((item) => [item.id, item]));
    const classMap = new Map(classData.map((item) => {
      const course = courses.get(item.course_id);
      const term = terms.get(item.term_id);
      const teacher = faculty.get(item.faculty_id);
      return [item.id, {
        id: item.id,
        course_code: course?.course_code ?? "Unknown course",
        course_title: course?.title ?? "Course details unavailable",
        section: item.section,
        room: item.room,
        schedule_text: item.schedule_text,
        term_name: term?.term_name ?? "Unknown term",
        academic_year: term?.academic_year ?? "",
        faculty_name: teacher?.full_name ?? "",
        is_active: item.is_active,
      }];
    }));

    const enrollments = allEnrollments.map((enrollment) => {
      const classInfo = classMap.get(enrollment.class_id);
      return {
        ...enrollment,
        course_code: classInfo?.course_code ?? "Unknown course",
        course_title: classInfo?.course_title ?? "Course details unavailable",
        section: classInfo?.section ?? "—",
        room: classInfo?.room ?? null,
        schedule_text: classInfo?.schedule_text ?? null,
        term_name: classInfo?.term_name ?? "Unknown term",
        academic_year: classInfo?.academic_year ?? "",
        faculty_name: classInfo?.faculty_name ?? "",
      };
    });

    const availableClasses = classData
      .filter((item) => item.is_active && !enrollmentClassIds.has(item.id))
      .map((item) => {
        const info = classMap.get(item.id);
        return info ? {
          id: item.id,
          course_code: info.course_code,
          course_title: info.course_title,
          section: info.section,
          room: info.room,
          schedule_text: info.schedule_text,
          term_name: info.term_name,
          academic_year: info.academic_year,
          faculty_name: info.faculty_name,
        } : null;
      })
      .filter(Boolean);

    return NextResponse.json({
      student: {
        id: studentProfile.id,
        full_name: studentProfile.full_name,
        institutional_email: studentProfile.institutional_email,
        is_active: studentProfile.is_active,
        department_name: departmentResult.data?.name ?? null,
        program_name: programResult.data?.program_name ?? null,
      },
      enrollments,
      availableClasses,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Student enrollments GET error:", error);
    return NextResponse.json({ error: "Unexpected error loading enrollments." }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorizeAdmin();
    if (isAuthorizationError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid enrollment data." }, { status: 400 });
    }
    const classId = (body as Record<string, unknown>).class_id;
    if (typeof classId !== "string" || !isUuid(classId)) {
      return NextResponse.json({ error: "Select a valid class." }, { status: 400 });
    }

    const { data: student, error: studentError } = await auth.admin
      .from("profiles").select("id, is_active").eq("id", id).eq("role", "student").maybeSingle();
    if (studentError) {
      console.error("Enrollment student check failed:", studentError.message);
      return NextResponse.json({ error: "Unable to verify student." }, { status: 500 });
    }
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    if (!student.is_active) return NextResponse.json({ error: "Reactivate the student account before enrolling them." }, { status: 400 });

    const { data: classRecord, error: classError } = await auth.admin
      .from("classes").select("id, is_active").eq("id", classId).maybeSingle();
    if (classError) {
      console.error("Enrollment class check failed:", classError.message);
      return NextResponse.json({ error: "Unable to verify class." }, { status: 500 });
    }
    if (!classRecord || !classRecord.is_active) {
      return NextResponse.json({ error: "Select an active class offering." }, { status: 400 });
    }

    const { data: existing, error: existingError } = await auth.admin
      .from("enrollments").select("id, is_active")
      .eq("student_id", id).eq("class_id", classId)
      .maybeSingle();

    if (existingError) {
      console.error("Duplicate enrollment check failed:", existingError.message);
      return NextResponse.json({ error: "Unable to check existing enrollment." }, { status: 500 });
    }

    if (existing?.is_active) {
      return NextResponse.json({ error: "This student is already actively enrolled in that class." }, { status: 409 });
    }

    if (existing && !existing.is_active) {
      const { data, error } = await auth.admin.from("enrollments")
        .update({ is_active: true, enrolled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", existing.id).select("id").single();
      if (error) {
        console.error("Enrollment reactivation failed:", error.message);
        return NextResponse.json({ error: "Unable to reactivate existing enrollment." }, { status: 500 });
      }
      return NextResponse.json({ message: "Existing enrollment reactivated successfully.", enrollment: data });
    }

    const { data, error } = await auth.admin.from("enrollments")
      .insert({ student_id: id, class_id: classId, is_active: true })
      .select("id, student_id, class_id, enrolled_at, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This student is already enrolled in that class." }, { status: 409 });
      }
      console.error("Enrollment creation failed:", error.message);
      return NextResponse.json({ error: "Unable to create enrollment." }, { status: 500 });
    }

    return NextResponse.json({ message: "Student enrolled successfully.", enrollment: data }, { status: 201 });
  } catch (error) {
    console.error("Student enrollments POST error:", error);
    return NextResponse.json({ error: "Unexpected error creating enrollment." }, { status: 500 });
  }
}
