
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const VALID_STATUSES = ["planned", "active", "completed", "archived"] as const;
type TermStatus = (typeof VALID_STATUSES)[number];

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

async function authorizeAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return { error: "Supabase server configuration is incomplete.", status: 500 } as const;
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

  const { data: { user }, error: authError } = await session.auth.getUser();

  if (authError || !user) {
    return { error: "Please sign in to manage academic terms.", status: 401 } as const;
  }

  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Term administrator check failed:", profileError.message);
    return { error: "Unable to verify administrator permissions.", status: 500 } as const;
  }

  if (!profile || profile.role !== "administrator" || !profile.is_active) {
    return { error: "Only active administrators can manage academic terms.", status: 403 } as const;
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { admin } as const;
}

function isAuthorizationError(
  result: Awaited<ReturnType<typeof authorizeAdmin>>
): result is Extract<Awaited<ReturnType<typeof authorizeAdmin>>, { error: string }> {
  return "error" in result;
}

export async function GET() {
  try {
    const auth = await authorizeAdmin();

    if (isAuthorizationError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await auth.admin
      .from("academic_terms")
      .select("id, academic_year, term_name, starts_on, ends_on, status, created_at, updated_at")
      .order("starts_on", { ascending: false });

    if (error) {
      console.error("Academic terms query failed:", error.message);
      return NextResponse.json({ error: "Unable to load academic terms." }, { status: 500 });
    }

    return NextResponse.json(
      { terms: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Academic terms GET error:", error);
    return NextResponse.json({ error: "Unexpected error loading academic terms." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeAdmin();

    if (isAuthorizationError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let body: {
      academic_year?: unknown;
      term_name?: unknown;
      starts_on?: unknown;
      ends_on?: unknown;
      status?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid academic term data." }, { status: 400 });
    }

    const academicYear = typeof body.academic_year === "string" ? body.academic_year.trim() : "";
    const termName = typeof body.term_name === "string" ? body.term_name.trim() : "";
    const startsOn = typeof body.starts_on === "string" ? body.starts_on : "";
    const endsOn = typeof body.ends_on === "string" ? body.ends_on : "";
    const status: TermStatus = body.status === undefined ? "planned" : body.status as TermStatus;

    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      return NextResponse.json({ error: "Academic year must use the format YYYY-YYYY, e.g. 2026-2027." }, { status: 400 });
    }

    const [firstYear, secondYear] = academicYear.split("-").map(Number);
    if (secondYear !== firstYear + 1) {
      return NextResponse.json({ error: "The second year must be one year after the first." }, { status: 400 });
    }

    if (termName.length < 2 || termName.length > 100) {
      return NextResponse.json({ error: "Term name must contain 2–100 characters." }, { status: 400 });
    }

    if (!isValidDate(startsOn) || !isValidDate(endsOn)) {
      return NextResponse.json({ error: "Enter valid start and end dates." }, { status: 400 });
    }

    if (endsOn < startsOn) {
      return NextResponse.json({ error: "End date cannot be earlier than start date." }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid academic term status." }, { status: 400 });
    }

    const { data, error } = await auth.admin
      .from("academic_terms")
      .insert({
        academic_year: academicYear,
        term_name: termName,
        starts_on: startsOn,
        ends_on: endsOn,
        status,
      })
      .select("id, academic_year, term_name, starts_on, ends_on, status, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A matching academic term already exists." }, { status: 409 });
      }

      console.error("Academic term creation failed:", error.message);
      return NextResponse.json({ error: "Unable to create the academic term." }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Academic term created successfully.", term: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Academic terms POST error:", error);
    return NextResponse.json({ error: "Unexpected error creating academic term." }, { status: 500 });
  }
}
