
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LockKeyhole } from "lucide-react";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;

    async function verifyInvitation() {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !data.user) {
        router.replace("/login?error=invitation_session_missing");
        return;
      }

      setEmail(data.user.email ?? "");
      setLoading(false);
    }

    void verifyInvitation();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to set your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <p className="text-sm text-slate-500">Verifying your invitation...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
          <LockKeyhole size={23} />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
          Set your password
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Create a secure password for your SmartGrade faculty account.
        </p>

        <p className="mt-4 break-all rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {email}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving password..." : "Set password and continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
