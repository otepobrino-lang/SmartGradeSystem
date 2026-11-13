
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

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeAdmin();

    if (isAuthorizationError(auth)) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await context.params;

    if (!validUuid(id)) {
      return NextResponse.json(
        { error: "Invalid class ID." },
        { status: 400 }
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

    const input = body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if ("course_id" in input) {
      if (
        typeof input.course_id !== "string" ||
        !validUuid(input.course_id)
      ) {
        return NextResponse.json(
          { error: "Select a valid course." },
          { status: 400 }
        );
      }

      updates.course_id = input.course_id;
    }

    if ("term_id" in input) {
      if (
        typeof input.term_id !== "string" ||
        !validUuid(input.term_id)
      ) {
        return NextResponse.json(
          { error: "Select a valid academic term." },
          { status: 400 }
        );
      }

      updates.term_id = input.term_id;
    }

    if ("faculty_id" in input) {
      if (
        typeof input.faculty_id !== "string" ||
        !validUuid(input.faculty_id)
      ) {
        return NextResponse.json(
          { error: "Select a valid faculty member." },
          { status: 400 }
        );
      }

      updates.faculty_id = input.faculty_id;
    }

    if ("section" in input) {
      if (typeof input.section !== "string") {
        return NextResponse.json(
          { error: "Invalid section." },
          { status: 400 }
        );
      }

      const section = input.section.trim();

      if (!section || section.length > 50) {
        return NextResponse.json(
          { error: "Section is required and must not exceed 50 characters." },
          { status: 400 }
        );
      }

      updates.section = section;
    }

    if ("room" in input) {
      if (input.room !== null && typeof input.room !== "string") {
        return NextResponse.json(
          { error: "Invalid room." },
          { status: 400 }
        );
      }

      const room =
        typeof input.room === "string" ? input.room.trim() : "";

      if (room.length > 100) {
        return NextResponse.json(
          { error: "Room must not exceed 100 characters." },
          { status: 400 }
        );
      }

      updates.room = room || null;
    }

    if ("schedule_text" in input) {
      if (
        input.schedule_text !== null &&
        typeof input.schedule_text !== "string"
      ) {
        return NextResponse.json(
          { error: "Invalid schedule." },
          { status: 400 }
        );
      }

      const schedule =
        typeof input.schedule_text === "string"
          ? input.schedule_text.trim()
          : "";

      if (schedule.length > 250) {
        return NextResponse.json(
          { error: "Schedule must not exceed 250 characters." },
          { status: 400 }
        );
      }

      updates.schedule_text = schedule || null;
    }

    if ("is_active" in input) {
      if (typeof input.is_active !== "boolean") {
        return NextResponse.json(
          { error: "Invalid class status." },
          { status: 400 }
        );
      }

      updates.is_active = input.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid changes were provided." },
        { status: 400 }
      );
    }

    // Read current values so that partial updates can be validated.
    const { data: current, error: currentError } = await auth.admin
      .from("classes")
      .select("id, course_id, term_id, faculty_id")
      .eq("id", id)
      .maybeSingle();

    if (currentError) {
      console.error("Class lookup failed:", currentError.message);

      return NextResponse.json(
        { error: "Unable to find the class." },
        { status: 500 }
      );
    }

    if (!current) {
      return NextResponse.json(
        { error: "Class not found." },
        { status: 404 }
      );
    }

    const assignment = {
      course_id: (updates.course_id ?? current.course_id) as string,
      term_id: (updates.term_id ?? current.term_id) as string,
      faculty_id: (updates.faculty_id ?? current.faculty_id) as string,
    };

    const [courseResult, termResult, facultyResult] = await Promise.all([
      auth.admin
        .from("courses")
        .select("id")
        .eq("id", assignment.course_id)
        .eq("is_active", true)
        .maybeSingle(),

      auth.admin
        .from("academic_terms")
        .select("id")
        .eq("id", assignment.term_id)
        .neq("status", "archived")
        .maybeSingle(),

      auth.admin
        .from("profiles")
        .select("id")
        .eq("id", assignment.faculty_id)
        .eq("role", "faculty")
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    if (courseResult.error || termResult.error || facultyResult.error) {
      console.error("Class assignment validation failed:", {
        course: courseResult.error?.message,
        term: termResult.error?.message,
        faculty: facultyResult.error?.message,
      });

      return NextResponse.json(
        { error: "Unable to validate class assignments." },
        { status: 500 }
      );
    }

    if (!courseResult.data) {
      return NextResponse.json(
        { error: "The assigned course must be active." },
        { status: 400 }
      );
    }

    if (!termResult.data) {
      return NextResponse.json(
        { error: "The academic term is invalid or archived." },
        { status: 400 }
      );
    }

    if (!facultyResult.data) {
      return NextResponse.json(
        { error: "The assigned faculty member must be active." },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await auth.admin
      .from("classes")
      .update(updates)
      .eq("id", id)
      .select(
        "id, course_id, term_id, faculty_id, section, room, schedule_text, is_active, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      console.error("Class update failed:", error.message);

      return NextResponse.json(
        { error: "Unable to update the class." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Class not found or could not be updated." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Class updated successfully.",
      class: data,
    });
  } catch (error) {
    console.error("Classes PATCH error:", error);

    return NextResponse.json(
      { error: "Unexpected error updating the class." },
      { status: 500 }
    );
  }
}
