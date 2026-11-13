
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
): result is Extract<Awaited<ReturnType<typeof authorizeAdmin>>, { error: string }> {
  return "error" in result;
}

function isUuid(value: string) {
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

    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "Invalid student ID." },
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
        { error: "Invalid student profile data." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    // Only these profile fields can be updated.
    // The role and profile ID can never be changed through this endpoint.
    if ("full_name" in input) {
      if (typeof input.full_name !== "string") {
        return NextResponse.json(
          { error: "Full name must be text." },
          { status: 400 }
        );
      }

      const fullName = input.full_name.trim();

      if (fullName.length < 2 || fullName.length > 150) {
        return NextResponse.json(
          { error: "Full name must contain 2–150 characters." },
          { status: 400 }
        );
      }

      updates.full_name = fullName;
    }

    if ("institutional_email" in input) {
      if (
        input.institutional_email !== null &&
        typeof input.institutional_email !== "string"
      ) {
        return NextResponse.json(
          { error: "Institutional email must be text or empty." },
          { status: 400 }
        );
      }

      const email =
        typeof input.institutional_email === "string"
          ? input.institutional_email.trim().toLowerCase()
          : "";

      if (
        email.length > 254 ||
        (email !== "" &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      ) {
        return NextResponse.json(
          { error: "Enter a valid institutional email address." },
          { status: 400 }
        );
      }

      updates.institutional_email = email || null;
    }

    if ("department_id" in input) {
      if (
        input.department_id !== null &&
        input.department_id !== "" &&
        (typeof input.department_id !== "string" ||
          !isUuid(input.department_id))
      ) {
        return NextResponse.json(
          { error: "Select a valid department." },
          { status: 400 }
        );
      }

      const departmentId =
        typeof input.department_id === "string"
          ? input.department_id || null
          : null;

      if (departmentId) {
        const { data: department, error } = await auth.admin
          .from("departments")
          .select("id")
          .eq("id", departmentId)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          console.error("Department validation failed:", error.message);

          return NextResponse.json(
            { error: "Unable to validate the department." },
            { status: 500 }
          );
        }

        if (!department) {
          return NextResponse.json(
            { error: "Select an active department." },
            { status: 400 }
          );
        }
      }

      updates.department_id = departmentId;
    }

    if ("program_id" in input) {
      if (
        input.program_id !== null &&
        input.program_id !== "" &&
        (typeof input.program_id !== "string" ||
          !isUuid(input.program_id))
      ) {
        return NextResponse.json(
          { error: "Select a valid program." },
          { status: 400 }
        );
      }

      const programId =
        typeof input.program_id === "string"
          ? input.program_id || null
          : null;

      if (programId) {
        const { data: program, error } = await auth.admin
          .from("programs")
          .select("id, department_id")
          .eq("id", programId)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          console.error("Program validation failed:", error.message);

          return NextResponse.json(
            { error: "Unable to validate the program." },
            { status: 500 }
          );
        }

        if (!program) {
          return NextResponse.json(
            { error: "Select an active program." },
            { status: 400 }
          );
        }

        // Use the submitted department if supplied, otherwise the student's
        // current department. Do not permit a mismatched assignment.
        let departmentId: string | null | undefined;

        if ("department_id" in updates) {
          departmentId = updates.department_id as string | null;
        } else {
          const { data: currentProfile, error: currentError } =
            await auth.admin
              .from("profiles")
              .select("department_id")
              .eq("id", id)
              .eq("role", "student")
              .maybeSingle();

          if (currentError) {
            console.error(
              "Student department lookup failed:",
              currentError.message
            );

            return NextResponse.json(
              { error: "Unable to validate the student's department." },
              { status: 500 }
            );
          }

          departmentId = currentProfile?.department_id;
        }

        if (
          program.department_id &&
          departmentId !== program.department_id
        ) {
          return NextResponse.json(
            {
              error:
                "The selected program belongs to a different department. Select the matching department first.",
            },
            { status: 400 }
          );
        }
      }

      updates.program_id = programId;
    }

    if ("is_active" in input) {
      if (typeof input.is_active !== "boolean") {
        return NextResponse.json(
          { error: "Account status must be true or false." },
          { status: 400 }
        );
      }

      updates.is_active = input.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No supported changes were provided." },
        { status: 400 }
      );
    }

    // Verify the target exists and is a student before updating it.
    const { data: target, error: targetError } = await auth.admin
      .from("profiles")
      .select("id, role")
      .eq("id", id)
      .maybeSingle();

    if (targetError) {
      console.error("Student lookup failed:", targetError.message);

      return NextResponse.json(
        { error: "Unable to find the student profile." },
        { status: 500 }
      );
    }

    if (!target || target.role !== "student") {
      return NextResponse.json(
        { error: "Student profile not found." },
        { status: 404 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await auth.admin
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .eq("role", "student")
      .select(
        "id, full_name, institutional_email, department_id, program_id, is_active, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      console.error("Student profile update failed:", error.message);

      return NextResponse.json(
        { error: "Unable to update the student profile." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Student profile was not updated." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Student profile updated successfully.",
      student: data,
    });
  } catch (error) {
    console.error("Student PATCH error:", error);

    return NextResponse.json(
      { error: "Unexpected error updating the student profile." },
      { status: 500 }
    );
  }
}
