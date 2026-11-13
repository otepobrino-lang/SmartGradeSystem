
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "The email or password is incorrect."
            : authError.message
        );
        return;
      }

      if (!data.user) {
        setError("Unable to verify your account. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setError("Your SmartGrade profile could not be found. Please contact the administrator.");
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        setError("Your account is inactive. Please contact the administrator.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-sky-700 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
          <div className="absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full border border-white/10" />
          <div className="absolute right-12 top-1/3 h-64 w-64 rounded-full bg-sky-500/30 blur-3xl" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-sky-700">
              <BookOpen size={24} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight">SmartGrade</p>
              <p className="text-sm text-sky-100">Academic Intelligence Platform</p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">
              Samar State University
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Better insights.
              <br />
              Better academic outcomes.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-sky-100">
              A centralized academic platform for grade management, student performance
              monitoring, and timely academic support.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-sm text-sky-100">Academic records</p>
                <p className="mt-2 text-lg font-semibold">Centralized</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-sm text-sky-100">Student support</p>
                <p className="mt-2 text-lg font-semibold">Data-informed</p>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-sm text-sky-200">
            Secure access for the Samar State University community
          </p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10 lg:min-h-0 lg:px-14 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-700 text-white">
                <BookOpen size={24} />
              </div>
              <div>
                <p className="text-xl font-semibold tracking-tight">SmartGrade</p>
                <p className="text-sm text-slate-500">Samar State University</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold text-sky-700">WELCOME BACK</p>
              <h2 className="text-3xl font-semibold tracking-tight">Sign in to SmartGrade</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Enter your university account credentials to continue.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@university.edu.ph"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-center text-xs leading-5 text-slate-500">
                Authorized users only. Access to academic records is governed by university
                permissions and data privacy requirements.
              </p>
            </div>

            <p className="mt-8 text-center text-xs text-slate-400">
              SmartGrade · Samar State University
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
