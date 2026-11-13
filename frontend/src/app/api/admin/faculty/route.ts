
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";


type ApiError = {
  error: string;
  status: number;
};

type AuthorizationResult =
  | { admin: SupabaseClient }
  | ApiError;

type Department = {
  id: string;
  code: string;
  name: string;
};

type FacultyProfile = {
  id: string;
  full_name: string;
  institutional_email: string | null;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
};

function respondWithError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isApiError(
  result: AuthorizationResult
): result is ApiError {
  return "error" in result;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function safeErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unexpected server error occurred.";
}

async function authorizeAdministrator(): Promise<AuthorizationResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Faculty API server configuration is incomplete.");

    return {
      error: "The server is missing required Supabase configuration.",
      status: 500,
    };
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Cookie writes may be unavailable in some server contexts.
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Please sign in before managing faculty accounts.",
      status: 401,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "Administrator profile verification failed:",
      profileError.message
    );

    return {
      error: "Unable to verify your account permissions.",
      status: 500,
    };
  }

  if (!profile || !profile.is_active) {
    return {
      error: "Your account does not have an active profile.",
      status: 403,
    };
  }

  if (profile.role !== "administrator") {
    return {
      error: "Only administrators can manage faculty accounts.",
      status: 403,
    };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { admin };
}

async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string
) {
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(
        "Unable to verify whether the email is already registered in Supabase Auth."
      );
    }

    const existingUser = data.users.find(
      (user) => user.email && normalizeEmail(user.email) === email
    );

    if (existingUser) {
      return existingUser;
    }

    if (data.users.length < perPage) {
      return null;
    }
  }

  throw new Error(
    "The Auth directory is too large to verify safely. Please try again or contact the system administrator."
  );
}

async function findProfileByEmail(
  admin: SupabaseClient,
  email: string
) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, role, institutional_email")
    .ilike("institutional_email", email)
    .limit(2);

  if (error) {
    console.error("Existing profile lookup failed:", error.message);
    throw new Error("Unable to check existing profile records.");
  }

  if ((data ?? []).length > 1) {
    throw new Error(
      "Multiple profiles use this email address. Resolve the duplicate records before inviting this person."
    );
  }

  return data?.[0] ?? null;
}

export async function GET() {
  try {
    const authorization = await authorizeAdministrator();

    if (isApiError(authorization)) {
      return respondWithError(
        authorization.error,
        authorization.status
      );
    }

    const { admin } = authorization;

    const [
      { data: faculty, error: facultyError },
      { data: departments, error: departmentsError },
      { data: allDepartments, error: allDepartmentsError },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "id, full_name, institutional_email, department_id, is_active, created_at"
        )
        .eq("role", "faculty")
        .order("full_name", { ascending: true }),
      admin
        .from("departments")
        .select("id, code, name")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      admin
        .from("departments")
        .select("id, code, name")
        .order("name", { ascending: true }),
    ]);

    if (facultyError) {
      console.error("Faculty directory query failed:", facultyError.message);
      return respondWithError("Unable to load faculty accounts.", 500);
    }

    if (departmentsError || allDepartmentsError) {
      console.error(
        "Department directory query failed:",
        departmentsError?.message ?? allDepartmentsError?.message
      );

      return respondWithError("Unable to load departments.", 500);
    }

    const departmentMap = new Map<string, Department>(
      (allDepartments ?? []).map((department) => [
        department.id,
        department,
      ])
    );

    const result = (faculty ?? []).map((person) => ({
      ...person,
      department: person.department_id
        ? departmentMap.get(person.department_id) ?? null
        : null,
    }));

    return NextResponse.json(
      {
        faculty: result,
        departments: departments ?? [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Faculty GET endpoint failed:", safeErrorMessage(error));

    return respondWithError(
      "An unexpected error occurred while loading faculty accounts.",
      500
    );
  }
}

export async function POST(request: Request) {
  let invitedUserId: string | null = null;
  let adminClient: SupabaseClient | null = null;

  try {
    const authorization = await authorizeAdministrator();

    if (isApiError(authorization)) {
      return respondWithError(
        authorization.error,
        authorization.status
      );
    }

    const { admin } = authorization;
    adminClient = admin;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return respondWithError("The request body must be valid JSON.", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return respondWithError("Invalid request body.", 400);
    }

    const input = body as Record<string, unknown>;

    const fullName =
      typeof input.full_name === "string"
        ? input.full_name.trim().replace(/\s+/g, " ")
        : "";

    const email =
      typeof input.email === "string"
        ? normalizeEmail(input.email)
        : "";

    const departmentId =
      typeof input.department_id === "string" &&
      input.department_id.trim()
        ? input.department_id.trim()
        : null;

    if (fullName.length < 2 || fullName.length > 150) {
      return respondWithError(
        "Enter a full name between 2 and 150 characters.",
        400
      );
    }

    if (!isValidEmail(email)) {
      return respondWithError("Enter a valid email address.", 400);
    }

    if (departmentId && !isValidUuid(departmentId)) {
      return respondWithError("Choose a valid department.", 400);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!siteUrl) {
      return respondWithError(
        "NEXT_PUBLIC_SITE_URL is not configured on the server.",
        500
      );
    }

    let parsedSiteUrl: URL;

    try {
      parsedSiteUrl = new URL(siteUrl);
    } catch {
      return respondWithError(
        "NEXT_PUBLIC_SITE_URL is not a valid URL.",
        500
      );
    }

    if (
      !["http:", "https:"].includes(parsedSiteUrl.protocol) ||
      (process.env.NODE_ENV === "production" &&
        parsedSiteUrl.protocol !== "https:")
    ) {
      return respondWithError(
        "Configure a valid site URL. Production URLs must use HTTPS.",
        500
      );
    }

    if (departmentId) {
      const { data: department, error: departmentError } = await admin
        .from("departments")
        .select("id")
        .eq("id", departmentId)
        .eq("is_active", true)
        .maybeSingle();

      if (departmentError) {
        console.error(
          "Department validation failed:",
          departmentError.message
        );

        return respondWithError(
          "Unable to verify the selected department.",
          500
        );
      }

      if (!department) {
        return respondWithError(
          "The selected department is unavailable or inactive.",
          400
        );
      }
    }

    const existingProfile = await findProfileByEmail(admin, email);

    if (existingProfile) {
      return respondWithError(
        existingProfile.role === "faculty"
          ? "A faculty profile with this email already exists."
          : "This email is already associated with another profile. Resolve the existing account before inviting it as faculty.",
        409
      );
    }

    const existingAuthUser = await findAuthUserByEmail(admin, email);

    if (existingAuthUser) {
      return respondWithError(
        "This email already exists in Supabase Auth. Do not create a duplicate invitation. Review the existing account and profile first.",
        409
      );
    }

    const redirectTo = new URL(
      "/auth/callback?next=/auth/set-password",
      parsedSiteUrl
    ).toString();

    const { data: invitation, error: invitationError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          full_name: fullName,
        },
      });

    if (invitationError || !invitation.user) {
      console.error(
        "Faculty invitation failed:",
        invitationError?.message ?? "No user was returned."
      );

      return respondWithError(
        "Supabase could not send the faculty invitation. Verify your Auth email configuration and that this email is not already registered.",
        400
      );
    }

    invitedUserId = invitation.user.id;

    const profilePayload = {
      id: invitation.user.id,
      full_name: fullName,
      institutional_email: email,
      role: "faculty",
      department_id: departmentId,
      is_active: true,
    };

    // This UUID belongs to the newly invited Auth user.
    // An upsert also supports a profile created by an Auth trigger.
    const { data: savedProfile, error: profileError } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select(
        "id, full_name, institutional_email, department_id, is_active, created_at"
      )
      .single();

    if (profileError || !savedProfile) {
      console.error(
        "Faculty profile provisioning failed:",
        profileError?.message ?? "No profile was returned."
      );

      // Remove only the profile and Auth user created for this invitation.
      const { error: profileCleanupError } = await admin
        .from("profiles")
        .delete()
        .eq("id", invitation.user.id);

      if (profileCleanupError) {
        console.error(
          "Invited profile cleanup failed:",
          profileCleanupError.message
        );
      }

      const { error: authCleanupError } =
        await admin.auth.admin.deleteUser(invitation.user.id);

      if (authCleanupError) {
        console.error(
          "Invited Auth user cleanup failed:",
          authCleanupError.message
        );
      }

      invitedUserId = null;

      return respondWithError(
        "The invitation was created, but the faculty profile could not be saved. The server attempted cleanup. Check server logs and Supabase Auth before retrying to avoid duplicate accounts.",
        500
      );
    }

    invitedUserId = null;

    let department: Department | null = null;

    if (departmentId) {
      const { data: departmentData, error: departmentLookupError } =
        await admin
          .from("departments")
          .select("id, code, name")
          .eq("id", departmentId)
          .maybeSingle();

      if (departmentLookupError) {
        console.error(
          "Department response lookup failed:",
          departmentLookupError.message
        );
      } else {
        department = departmentData;
      }
    }

    const response: {
      message: string;
      faculty: FacultyProfile & { department: Department | null };
    } = {
      message: "Faculty invitation created successfully.",
      faculty: {
        ...savedProfile,
        department,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Faculty POST endpoint failed:", safeErrorMessage(error));

    // If an unexpected error occurs after invitation creation, do not
    // silently delete accounts here. Preserve the ID in logs for review.
    if (invitedUserId) {
      console.error(
        "A faculty invitation may require manual review. Auth user ID:",
        invitedUserId
      );
    }

    return respondWithError(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while inviting faculty.",
      500
    );
  }
}
