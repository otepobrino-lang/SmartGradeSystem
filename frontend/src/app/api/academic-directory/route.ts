
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is incomplete." },
        { status: 500 }
      );
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
          } catch {}
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await sessionClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to view the academic directory." },
        { status: 401 }
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: departments, error: departmentError } = await admin
      .from("departments")
      .select("id, code, name, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (departmentError) {
      console.error("Academic directory departments:", departmentError.message);
      return NextResponse.json(
        { error: "Unable to load academic departments." },
        { status: 500 }
      );
    }

    const departmentIds = (departments ?? []).map((department) => department.id);

    let programs: {
      id: string;
      program_code: string;
      program_name: string;
      department_id: string | null;
      campus_name: string;
      is_active: boolean;
    }[] = [];

    if (departmentIds.length > 0) {
      const { data, error: programError } = await admin
        .from("programs")
        .select(
          "id, program_code, program_name, department_id, campus_name, is_active"
        )
        .eq("is_active", true)
        .in("department_id", departmentIds)
        .order("program_name", { ascending: true });

      if (programError) {
        console.error("Academic directory programs:", programError.message);
        return NextResponse.json(
          { error: "Unable to load academic programs." },
          { status: 500 }
        );
      }

      programs = data ?? [];
    }

    const departmentById = new Map(
      (departments ?? []).map((department) => [department.id, department])
    );

    return NextResponse.json(
      {
        departments: departments ?? [],
        programs: programs.map((program) => ({
          ...program,
          department: departmentById.get(program.department_id ?? "") ?? null,
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Academic directory GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while loading the academic directory." },
      { status: 500 }
    );
  }
}
