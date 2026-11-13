
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function authorizeAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return {
      error: "Supabase server configuration is incomplete.",
      status: 500,
    } as const;
  }

  const cookieStore = await cookies();

  const session = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Cookie updates may be unavailable in this context.
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await session.auth.getUser();

  if (authError || !user) {
    return {
      error: "Please sign in to manage classes.",
      status: 401,
    } as const;
  }

  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Class administrator check failed:", profileError.message);

    return {
      error: "Unable to verify administrator permissions.",
      status: 500,
    } as const;
  }

  if (
    !profile ||
    profile.role !== "administrator" ||
    !profile.is_active
  ) {
    return {
      error: "Only active administrators can manage classes.",
      status: 403,
    } as const;
  }

  const admin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { admin } as const;
}

function isAuthorizationError(
  result: Awaited<ReturnType<typeof authorizeAdmin>>
): result is { error: string; status: number } {
  return "error" in result;
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function parseClassBody(body: Record<string, unknown>) {
  const courseId = body.course_id;
  const termId = body.term_id;
  const facultyId = body.faculty_id;
  const section =
    typeof body.section === "string" ? body.section.trim() : "";

  const room =
    typeof body.room === "string" ? body.room.trim() : "";

  const scheduleText =
    typeof body.schedule_text === "string"
      ? body.schedule_text.trim()
      : "";

  if (
    !validUuid(courseId) ||
    !validUuid(termId) ||
    !validUuid(facultyId)
  ) {
    return {
      error: "Select a valid course, academic term, and faculty member.",
    } as const;
  }

  if (section.length < 1 || section.length > 50) {
    return {
      error: "Section is required and must not exceed 50 characters.",
    } as const;
  }

  if (room.length > 100) {
    return {
      error: "Room must not exceed 100 characters.",
    } as const;
  }

  if (scheduleText.length > 250) {
    return {
      error: "Schedule must not exceed 250 characters.",
    } as const;
  }

  if (
    body.is_active !== undefined &&
    typeof body.is_active !== "boolean"
  ) {
    return { error: "Invalid class status." } as const;
  }

  return {
    value: {
      course_id: courseId,
      term_id: termId,
      faculty_id: facultyId,
      section,
      room: room || null,
      schedule_text: scheduleText || null,
      ...(body.is_active !== undefined
        ? { is_active: body.is_active }
        : {}),
    },
  } as const;
}

async function validateAssignments(
  admin: Awaited<ReturnType<typeof createClient>>,
  values: {
    course_id: string;
    term_id: string;
    faculty_id: string;
  }
) {
  const [courseResult, termResult, facultyResult] = await Promise.all([
    admin
      .from("courses")
      .select("id")
      .eq("id", values.course_id)
      .eq("is_active", true)
      .maybeSingle(),

    admin
      .from("academic_terms")
      .select("id")
      .eq("id", values.term_id)
      .neq("status", "archived")
      .maybeSingle(),

    admin
      .from("profiles")
      .select("id")
      .eq("id", values.faculty_id)
      .eq("role", "faculty")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (courseResult.error || termResult.error || facultyResult.error) {
    return {
      error: "Unable to validate class assignments.",
      status: 500,
    };
  }

  if (!courseResult.data) {
    return {
      error: "Select an active course.",
      status: 400,
    };
  }

  if (!termResult.data) {
    return {
      error: "Select a valid, non-archived academic term.",
      status: 400,
    };
  }

  if (!facultyResult.data) {
    return {
      error: "Select an active faculty profile.",
      status: 400,
    };
  }

  return null;
}

export async function GET() {
  try {
    const auth = await authorizeAdmin();

    if (isAuthorizationError(auth)) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const [classesResult, coursesResult, termsResult, facultyResult] =
      await Promise.all([
        auth.admin
          .from("classes")
          .select(
            "id, course_id, term_id, faculty_id, section, room, schedule_text, is_active, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),

        auth.admin
          .from("courses")
          .select("id, course_code, title, department_id, is_active")
          .eq("is_active", true)
          .order("course_code"),

        auth.admin
          .from("academic_terms")
          .select("id, academic_year, term_name, starts_on, ends_on, status")
          .neq("status", "archived")
          .order("starts_on", { ascending: false }),

        auth.admin
          .from("profiles")
          .select("id, full_name, institutional_email, department_id")
          .eq("role", "faculty")
          .eq("is_active", true)
          .order("full_name"),
      ]);

    if (
      classesResult.error ||
      coursesResult.error ||
      termsResult.error ||
      facultyResult.error
    ) {
      console.error("Classes query failed:", {
        classes: classesResult.error?.message,
        courses: coursesResult.error?.message,
        terms: termsResult.error?.message,
        faculty: facultyResult.error?.message,
      });

      return NextResponse.json(
        { error: "Unable to load classes and assignment options." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        classes: classesResult.data ?? [],
        courses: coursesResult.data ?? [],
        terms: termsResult.data ?? [],
        faculty: facultyResult.data ?? [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Classes GET error:", error);

    return NextResponse.json(
      { error: "Unexpected error loading classes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeAdmin();

    if (isAuthorizationError(auth)) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid class data." },
        { status: 400 }
      );
    }

    const parsed = parseClassBody(body as Record<string, unknown>);

    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      );
    }

    const assignmentError = await validateAssignments(
      auth.admin,
      parsed.value
    );

    if (assignmentError) {
      return NextResponse.json(
        { error: assignmentError.error },
        { status: assignmentError.status }
      );
    }

    const { data, error } = await auth.admin
      .from("classes")
      .insert(parsed.value)
      .select(
        "id, course_id, term_id, faculty_id, section, room, schedule_text, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("Class creation failed:", error.message);

      return NextResponse.json(
        { error: "Unable to create the class. Please check the assigned values." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Class created successfully.", class: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Classes POST error:", error);

    return NextResponse.json(
      { error: "Unexpected error creating the class." },
      { status: 500 }
    );
  }
}
