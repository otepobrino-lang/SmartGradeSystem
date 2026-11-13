"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying your invitation...");

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      const supabase = createClient();
      const nextParam = searchParams.get("next");
      const next =
        nextParam?.startsWith("/") && !nextParam.startsWith("//")
          ? nextParam
          : "/dashboard";

      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const tokenType = hashParams.get("type");
        const authError =
          hashParams.get("error_description") ??
          hashParams.get("error");

        if (authError) {
          throw new Error("This invitation link is invalid or has expired. Ask your administrator to send a new invitation.");
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw new Error("We couldn't verify this invitation. The link may have expired; ask your administrator to send a new one.");
          }

          if (tokenType && tokenType !== "invite" && tokenType !== "recovery" && tokenType !== "signup" && tokenType !== "magiclink" && tokenType !== "email") {
            throw new Error("This link is not a supported account verification link.");
          }

          window.history.replaceState(
            window.history.state,
            document.title,
            window.location.pathname + window.location.search
          );

          if (!cancelled) router.replace(next);
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw new Error("We couldn't verify this invitation. The link may have expired; ask your administrator to send a new one.");
          }

          if (!cancelled) router.replace(next);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
          if (!cancelled) router.replace(next);
          return;
        }

        throw new Error("The invitation link does not contain a valid authentication session. Ask your administrator to send a new invitation.");
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to verify your invitation. Please request a new invitation."
          );
        }
      }
    }

    void completeAuth();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          SmartGrade account verification
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600" role="status">
          {message}
        </p>
      </section>
    </main>
  );
}

function AuthCallbackFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          SmartGrade account verification
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600" role="status">
          Preparing your verification...
        </p>
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
