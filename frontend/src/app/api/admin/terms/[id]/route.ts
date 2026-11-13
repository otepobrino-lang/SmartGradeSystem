
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

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await authorizeAdmin();

    if (isAuthorizationError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid academic term ID." }, { status: 400 });
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

    const updates: Record<string, string> = {};

    if (body.academic_year !== undefined) {
      if (typeof body.academic_year !== "string" || !/^\d{4}-\d{4}$/.test(body.academic_year.trim())) {
        return NextResponse.json({ error: "Academic year must use YYYY-YYYY format." }, { status: 400 });
      }

      const year = body.academic_year.trim().split("-").map(Number);
      if (year[1] !== year[0] + 1) {
        return NextResponse.json({ error: "The second year must be one year after the first." }, { status: 400 });
      }

      updates.academic_year = body.academic_year.trim();
    }

    if (body.term_name !== undefined) {
      if (typeof body.term_name !== "string" || body.term_name.trim().length < 2 || body.term_name.trim().length > 100) {
        return NextResponse.json({ error: "Term name must contain 2–100 characters." }, { status: 400 });
      }

      updates.term_name = body.term_name.trim();
    }

    if (body.starts_on !== undefined) {
      if (typeof body.starts_on !== "string" || !isValidDate(body.starts_on)) {
        return NextResponse.json({ error: "Enter a valid start date." }, { status: 400 });
      }

      updates.starts_on = body.starts_on;
    }

    if (body.ends_on !== undefined) {
      if (typeof body.ends_on !== "string" || !isValidDate(body.ends_on)) {
        return NextResponse.json({ error: "Enter a valid end date." }, { status: 400 });
      }

      updates.ends_on = body.ends_on;
    }

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as TermStatus)) {
        return NextResponse.json({ error: "Invalid academic term status." }, { status: 400 });
      }

      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes were provided." }, { status: 400 });
    }

    const { data: existing, error: lookupError } = await auth.admin
      .from("academic_terms")
      .select("starts_on, ends_on")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("Academic term lookup failed:", lookupError.message);
      return NextResponse.json({ error: "Unable to verify the academic term." }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Academic term not found." }, { status: 404 });
    }

    const effectiveStart = updates.starts_on ?? existing.starts_on;
    const effectiveEnd = updates.ends_on ?? existing.ends_on;

    if (effectiveEnd < effectiveStart) {
      return NextResponse.json({ error: "End date cannot be earlier than start date." }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await auth.admin
      .from("academic_terms")
      .update(updates)
      .eq("id", id)
      .select("id, academic_year, term_name, starts_on, ends_on, status, created_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error("Academic term update failed:", error.message);
      return NextResponse.json({ error: "Unable to update the academic term." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Academic term not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Academic term updated successfully.", term: data });
  } catch (error) {
    console.error("Academic terms PATCH error:", error);
    return NextResponse.json({ error: "Unexpected error updating academic term." }, { status: 500 });
  }
}
