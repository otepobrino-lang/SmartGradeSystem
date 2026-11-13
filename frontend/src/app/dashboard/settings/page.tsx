
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserRound,
  LockKeyhole,
  ShieldCheck,
  Save,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string;
  role: string;
  is_active: boolean;
};

export default function AccountSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      setEmail(authData.user.email ?? "");

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role, is_active")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !data || !data.is_active) {
        setError("Unable to load your active account profile.");
        return;
      }

      const accountProfile = data as Profile;
      setProfile(accountProfile);
      setFullName(accountProfile.full_name ?? "");
    } catch {
      setError("Something went wrong while loading your account.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const trimmedName = fullName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 120) {
      setError("Your name must be between 2 and 120 characters.");
      return;
    }

    setSavingProfile(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName })
        .eq("id", authData.user.id)
        .select("full_name, role, is_active")
        .single();

      if (updateError || !data) {
        setError(
          updateError?.message ||
            "Your profile could not be updated. Check your account permissions."
        );
        return;
      }

      const updatedProfile = data as Profile;
      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name);
      setMessage("Your profile was updated successfully.");
    } catch {
      setError("Something went wrong while saving your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) {
        setError(passwordError.message);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setMessage("Your password was changed successfully.");
    } catch {
      setError("Something went wrong while changing your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin text-sky-700" />
          Loading account settings...
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-6 sm:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6">
          <AlertCircle className="mb-3 h-6 w-6 text-red-600" />
          <h1 className="text-lg font-semibold text-slate-900">
            Account unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {error || "Your account information could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => void loadAccount()}
            className="mt-5 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-sky-700">
            Account Management
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Account Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage your profile information and keep your account secure.
          </p>
        </div>

        {(message || error) && (
          <div
            role="status"
            className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <span>{error || message}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.5fr]">
          <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <UserRound className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              Your Account
            </h2>
            <p className="mt-1 break-all text-sm text-slate-500">{email}</p>

            <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Account role
                </p>
                <p className="mt-1 text-sm font-medium capitalize text-slate-800">
                  {profile.role.replace(/_/g, " ")}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Account status
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-slate-800">
                    Active
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                Your role and account status are managed by SmartGrade and
                cannot be changed here.
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Profile Information
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update your account name.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label
                    htmlFor="account-email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Email address
                  </label>
                  <input
                    id="account-email"
                    type="email"
                    value={email}
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Your sign-in email is managed through your authentication
                    account.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="full-name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Full name
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    minLength={2}
                    maxLength={120}
                    required
                    autoComplete="name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingProfile ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Change Password
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose a strong password with at least 8 characters.
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    placeholder="Enter your new password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    placeholder="Confirm your new password"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPassword && (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    )}
                    {savingPassword ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
