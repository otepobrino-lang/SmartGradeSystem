
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
      error: "Please sign in to manage students.",
      status: 401,
    } as const;
  }

  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Student administrator check failed:", profileError.message);
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
      error: "Only active administrators can manage students.",
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

export async function GET() {
  try {
    const auth = await authorizeAdmin();

    if (isAuthorizationError(auth)) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const [studentsResult, departmentsResult, programsResult, enrollmentsResult] =
      await Promise.all([
        auth.admin
          .from("profiles")
          .select(
            "id, full_name, institutional_email, department_id, program_id, is_active, created_at, updated_at"
          )
          .eq("role", "student")
          .order("full_name", { ascending: true }),

        auth.admin
          .from("departments")
          .select("id, code, name, is_active")
          .order("name", { ascending: true }),

        auth.admin
          .from("programs")
          .select(
            "id, program_code, program_name, department_id, campus_name, is_active"
          )
          .order("program_name", { ascending: true }),

        auth.admin
          .from("enrollments")
          .select("student_id")
          .eq("is_active", true),
      ]);

    if (
      studentsResult.error ||
      departmentsResult.error ||
      programsResult.error ||
      enrollmentsResult.error
    ) {
      console.error("Student directory query failed:", {
        students: studentsResult.error?.message,
        departments: departmentsResult.error?.message,
        programs: programsResult.error?.message,
        enrollments: enrollmentsResult.error?.message,
      });

      return NextResponse.json(
        { error: "Unable to load student management data." },
        { status: 500 }
      );
    }

    const enrollmentCounts = new Map<string, number>();

    for (const enrollment of enrollmentsResult.data ?? []) {
      enrollmentCounts.set(
        enrollment.student_id,
        (enrollmentCounts.get(enrollment.student_id) ?? 0) + 1
      );
    }

    const students = (studentsResult.data ?? []).map((student) => ({
      ...student,
      active_enrollment_count: enrollmentCounts.get(student.id) ?? 0,
    }));

    return NextResponse.json(
      {
        students,
        departments: departmentsResult.data ?? [],
        programs: programsResult.data ?? [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Student directory GET error:", error);

    return NextResponse.json(
      { error: "Unexpected error loading students." },
      { status: 500 }
    );
  }
}
