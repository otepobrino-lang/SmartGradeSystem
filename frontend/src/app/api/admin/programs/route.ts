
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ProgramInput = {
  id?: string;
  program_code?: string;
  program_name?: string;
  department_id?: string | null;
  campus_name?: string;
  is_active?: boolean;
};

async function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return { error: "Supabase server configuration is incomplete.", status: 500 } as const;
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
    return { error: "Please sign in to manage programs.", status: 401 } as const;
  }

  const { data: profile, error: profileError } = await sessionClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Program permission check failed:", profileError.message);
    return { error: "Unable to verify administrator permissions.", status: 500 } as const;
  }

  if (!profile || !profile.is_active || profile.role !== "administrator") {
    return { error: "Only active administrators can manage programs.", status: 403 } as const;
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { admin } as const;
}

function isErrorResult(
  result: Awaited<ReturnType<typeof getAdminClient>>
): result is { error: string; status: number } {
  return "error" in result;
}

function normalize(input: ProgramInput) {
  return {
    programCode: typeof input.program_code === "string"
      ? input.program_code.trim().toUpperCase()
      : "",
    programName: typeof input.program_name === "string"
      ? input.program_name.trim().replace(/\s+/g, " ")
      : "",
    departmentId: typeof input.department_id === "string"
      ? input.department_id.trim()
      : "",
    campusName: typeof input.campus_name === "string"
      ? input.campus_name.trim().replace(/\s+/g, " ")
      : "",
  };
}

function validate(
  programCode: string,
  programName: string,
  departmentId: string,
  campusName: string
) {
  if (!/^[A-Z0-9_-]{2,30}$/.test(programCode)) {
    return "Program code must be 2–30 letters, numbers, hyphens, or underscores.";
  }

  if (programName.length < 2 || programName.length > 200) {
    return "Program name must contain 2–200 characters.";
  }

  if (!campusName || campusName.length > 150) {
    return "Campus name is required and must not exceed 150 characters.";
  }

  if (
    departmentId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentId)
  ) {
    return "Select a valid department.";
  }

  return null;
}

async function validateDepartment(
  admin: ReturnType<typeof createClient>,
  departmentId: string
) {
  if (!departmentId) return { data: null, error: null };

  return admin
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("is_active", true)
    .maybeSingle();
}

// GET: List existing programs and their parent departments.
export async function GET() {
  try {
    const authorization = await getAdminClient();

    if (isErrorResult(authorization)) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status }
      );
    }

    const { admin } = authorization;

    const [
      { data: programs, error: programError },
      { data: departments, error: departmentError },
    ] = await Promise.all([
      admin
        .from("programs")
        .select("id, program_code, program_name, department_id, campus_name, is_active")
        .order("program_name", { ascending: true }),
      admin
        .from("departments")
        .select("id, code, name, is_active")
        .order("name", { ascending: true }),
    ]);

    if (programError || departmentError) {
      console.error("Program directory query failed:", {
        programs: programError?.message,
        departments: departmentError?.message,
      });

      return NextResponse.json(
        { error: "Unable to load programs and departments." },
        { status: 500 }
      );
    }

    const departmentMap = new Map(
      (departments ?? []).map((department) => [department.id, department])
    );

    const result = (programs ?? []).map((program) => ({
      ...program,
      department: program.department_id
        ? departmentMap.get(program.department_id) ?? null
        : null,
    }));

    return NextResponse.json(
      { programs: result, departments: departments ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Program GET error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while loading programs." },
      { status: 500 }
    );
  }
}

// POST: Create a program.
export async function POST(request: Request) {
  try {
    const authorization = await getAdminClient();

    if (isErrorResult(authorization)) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status }
      );
    }

    let body: ProgramInput;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid program data." }, { status: 400 });
    }

    const { programCode, programName, departmentId, campusName } = normalize(body);
    const validationError = validate(programCode, programName, departmentId, campusName);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data: department, error: departmentError } =
      await validateDepartment(authorization.admin, departmentId);

    if (departmentError) {
      console.error("Department validation failed:", departmentError.message);
      return NextResponse.json({ error: "Unable to verify the selected department." }, { status: 500 });
    }

    if (departmentId && !department) {
      return NextResponse.json(
        { error: "The selected department is inactive or does not exist." },
        { status: 400 }
      );
    }

    const { data, error } = await authorization.admin
      .from("programs")
      .insert({
        program_code: programCode,
        program_name: programName,
        department_id: departmentId || null,
        campus_name: campusName,
        is_active: true,
      })
      .select("id, program_code, program_name, department_id, campus_name, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A program with a duplicate code or name already exists." },
          { status: 409 }
        );
      }

      console.error("Program creation failed:", error.message);
      return NextResponse.json(
        { error: "Unable to create the program. Check the database constraints." },
        { status: 500 }
      );
    }

    const { data: departmentDetails } = departmentId
      ? await authorization.admin
          .from("departments")
          .select("id, code, name, is_active")
          .eq("id", departmentId)
          .maybeSingle()
      : { data: null };

    return NextResponse.json(
      {
        message: "Program created successfully.",
        program: { ...data, department: departmentDetails },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Program POST error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while creating the program." },
      { status: 500 }
    );
  }
}

// PATCH: Edit program details or change active status.
export async function PATCH(request: Request) {
  try {
    const authorization = await getAdminClient();

    if (isErrorResult(authorization)) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status }
      );
    }

    let body: ProgramInput;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid program data." }, { status: 400 });
    }

    if (
      typeof body.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
    ) {
      return NextResponse.json({ error: "A valid program ID is required." }, { status: 400 });
    }

    const updates: Record<string, string | boolean | null> = {};

    if (
      body.program_code !== undefined ||
      body.program_name !== undefined ||
      body.department_id !== undefined ||
      body.campus_name !== undefined
    ) {
      const { programCode, programName, departmentId, campusName } = normalize(body);
      const validationError = validate(programCode, programName, departmentId, campusName);

      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const { data: department, error: departmentError } =
        await validateDepartment(authorization.admin, departmentId);

      if (departmentError) {
        console.error("Department validation failed:", departmentError.message);
        return NextResponse.json({ error: "Unable to verify the selected department." }, { status: 500 });
      }

      if (departmentId && !department) {
        return NextResponse.json(
          { error: "The selected department is inactive or does not exist." },
          { status: 400 }
        );
      }

      updates.program_code = programCode;
      updates.program_name = programName;
      updates.department_id = departmentId || null;
      updates.campus_name = campusName;
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== "boolean") {
        return NextResponse.json({ error: "Program status must be true or false." }, { status: 400 });
      }

      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No program changes were provided." }, { status: 400 });
    }

    const { data, error } = await authorization.admin
      .from("programs")
      .update(updates)
      .eq("id", body.id)
      .select("id, program_code, program_name, department_id, campus_name, is_active")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A program with a duplicate code or name already exists." },
          { status: 409 }
        );
      }

      console.error("Program update failed:", error.message);
      return NextResponse.json({ error: "Unable to update the program." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 });
    }

    const { data: departmentDetails } = data.department_id
      ? await authorization.admin
          .from("departments")
          .select("id, code, name, is_active")
          .eq("id", data.department_id)
          .maybeSingle()
      : { data: null };

    return NextResponse.json({
      message: "Program updated successfully.",
      program: { ...data, department: departmentDetails },
    });
  } catch (error) {
    console.error("Program PATCH error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while updating the program." },
      { status: 500 }
    );
  }
}
