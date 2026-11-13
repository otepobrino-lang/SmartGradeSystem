import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function authorizeAdmin() {
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
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie writes may be unavailable in this context.
        }
      },
    },
  });

  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) {
    return { error: "Please sign in to manage student enrollments.", status: 401 } as const;
  }

  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Enrollment administrator check failed:", profileError.message);
    return { error: "Unable to verify administrator permissions.", status: 500 } as const;
  }
  if (!profile || profile.role !== "administrator" || !profile.is_active) {
    return { error: "Only active administrators can manage student enrollments.", status: 403 } as const;
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { admin } as const;
}

export function isAuthorizationError(
  result: Awaited<ReturnType<typeof authorizeAdmin>>
): result is Extract<Awaited<ReturnType<typeof authorizeAdmin>>, { error: string }> {
  return "error" in result;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
