
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type DepartmentInput = {
  id?: string;
  code?: string;
  name?: string;
  is_active?: boolean;
};

async function getAdminClient() {
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

  const sessionClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Cookie writes may be unavailable in this context.
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser();

  if (authError || !user) {
    return {
      error: "Please sign in to manage departments.",
      status: 401,
    } as const;
  }

  const { data: profile, error: profileError } = await sessionClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Department permission check failed:", profileError.message);
    return {
      error: "Unable to verify administrator permissions.",
      status: 500,
    } as const;
  }

  if (
    !profile ||
    !profile.is_active ||
    profile.role !== "administrator"
  ) {
    return {
      error: "Only active administrators can manage departments.",
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

function isErrorResult(
  result: Awaited<ReturnType<typeof getAdminClient>>
): result is { error: string; status: number } {
  return "error" in result;
}

function normalizeDepartment(input: DepartmentInput) {
  return {
    code: typeof input.code === "string"
      ? input.code.trim().toUpperCase()
      : "",
    name: typeof input.name === "string"
      ? input.name.trim().replace(/\s+/g, " ")
      : "",
  };
}

function validateDepartment(code: string, name: string) {
  if (!/^[A-Z0-9_-]{2,15}$/.test(code)) {
    return "Department code must contain 2–15 letters, numbers, hyphens, or underscores.";
  }

  if (name.length < 2 || name.length > 150) {
    return "Department name must contain 2–150 characters.";
  }

  return null;
}

// GET: List all departments, including inactive ones.
export async function GET() {
  try {
    const authorization = await getAdminClient();

    if (isErrorResult(authorization)) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status }
      );
    }

    const { data, error } = await authorization.admin
      .from("departments")
      .select("id, code, name, is_active")
      .order("name", { ascending: true });

    if (error) {
      console.error("Department list failed:", error.message);
      return NextResponse.json(
        { error: "Unable to load departments." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { departments: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Department GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while loading departments." },
      { status: 500 }
    );
  }
}

// POST: Create a department.
export async function POST(request: Request) {
  try {
    const authorization = await getAdminClient();

    if (isErrorResult(authorization)) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status }
      );
    }

    let body: DepartmentInput;

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
        { error: "Invalid department data." },
        { status: 400 }
      );
    }

    const { code, name } = normalizeDepartment(body);
    const validationError = validateDepartment(code, name);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const { data, error } = await authorization.admin
      .from("departments")
      .insert({ code, name, is_active: true })
      .select("id, code, name, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A department with this code or name already exists." },
          { status: 409 }
        );
      }

      console.error("Department creation failed:", error.message);
      return NextResponse.json(
        { error: "Unable to create department. Check the database schema and constraints." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Department created successfully.", department: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Department POST error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while creating the department." },
      { status: 500 }
    );
  }
}

// PATCH: Edit a department or change its active status.
export async function PATCH(request: Request) {
  try {
    const authorization = await getAdminClient();

    if (isErrorResult(authorization)) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status }
      );
    }

    let body: DepartmentInput;

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
        { error: "Invalid department data." },
        { status: 400 }
      );
    }

    if (
      typeof body.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
    ) {
      return NextResponse.json(
        { error: "A valid department ID is required." },
        { status: 400 }
      );
    }

    const updates: Record<string, string | boolean> = {};

    if (body.code !== undefined || body.name !== undefined) {
      const { code, name } = normalizeDepartment(body);

      if (body.code === undefined || body.name === undefined) {
        return NextResponse.json(
          { error: "Both department code and name are required when editing details." },
          { status: 400 }
        );
      }

      const validationError = validateDepartment(code, name);

      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }

      updates.code = code;
      updates.name = name;
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== "boolean") {
        return NextResponse.json(
          { error: "Department status must be true or false." },
          { status: 400 }
        );
      }

      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No department changes were provided." },
        { status: 400 }
      );
    }

    const { data, error } = await authorization.admin
      .from("departments")
      .update(updates)
      .eq("id", body.id)
      .select("id, code, name, is_active")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A department with this code or name already exists." },
          { status: 409 }
        );
      }

      console.error("Department update failed:", error.message);
      return NextResponse.json(
        { error: "Unable to update department." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Department not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Department updated successfully.",
      department: data,
    });
  } catch (error) {
    console.error("Department PATCH error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while updating the department." },
      { status: 500 }
    );
  }
}
