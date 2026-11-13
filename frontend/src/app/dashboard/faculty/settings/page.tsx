"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserRound, ShieldCheck, KeyRound, Bell, Save, LoaderCircle, CheckCircle2, AlertCircle, Eye, EyeOff, RefreshCw } from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  institutional_email: string | null;
  role: string | null;
  is_active: boolean | null;
};

export default function FacultySettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function loadProfile(isRefresh = false) {
    setPageError("");
    setSuccess("");
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        setPageError("Your session could not be verified. Please sign in again.");
        setProfile(null);
        return;
      }
      const { data, error } = await supabase.from("profiles")
        .select("id, full_name, institutional_email, role, is_active")
        .eq("id", authData.user.id).maybeSingle();
      if (error) throw error;
      if (!data) {
        setPageError("Your SmartGrade profile could not be found. Please contact your administrator.");
        setProfile(null);
        return;
      }
      setProfile(data as Profile);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load your account settings.");
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void loadProfile(); }, []);

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError("");
    setSuccess("");
    if (password.length < 8) {
      setPageError("Your new password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPageError("The password confirmation does not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      setSuccess("Your password has been updated successfully.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to update your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  const roleLabel = profile?.role
    ? profile.role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Faculty";

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><div className="flex items-center gap-3 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin text-sky-600" />Loading account settings...</div></div>;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-5 sm:p-7 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><p className="text-sm font-semibold text-sky-700">Faculty Workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Account Settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Review your SmartGrade account information and manage your sign-in password.</p></div>
        <button type="button" onClick={() => void loadProfile(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
      </div>

      {pageError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{pageError}</span></div>}
      {success && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>{success}</span></div>}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><UserRound className="h-5 w-5" /></div><div><h2 className="font-semibold text-slate-900">Profile information</h2><p className="mt-0.5 text-sm text-slate-500">Your identity details registered in SmartGrade.</p></div></div>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-800">{(profile?.full_name || "F").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold text-slate-950">{profile?.full_name || "Faculty member"}</p><p className="mt-1 text-sm text-slate-500">{roleLabel}</p></div><span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${profile?.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${profile?.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />{profile?.is_active ? "Active" : "Inactive"}</span></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[["Full name", profile?.full_name || ""], ["Institutional email", profile?.institutional_email || ""], ["Account role", roleLabel], ["Account status", profile?.is_active ? "Active" : "Inactive"]].map(([label, value]) => <div key={label}><label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label><input value={value} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 outline-none" /></div>)}
            </div>
            <p className="text-xs leading-5 text-slate-500">Profile details are read-only here. Contact your SmartGrade administrator if your name, institutional email, or role needs to be corrected.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><KeyRound className="h-5 w-5" /></div><div><h2 className="font-semibold text-slate-900">Change password</h2><p className="mt-0.5 text-sm text-slate-500">Choose a strong password for your account.</p></div></div>
          <form onSubmit={handlePasswordChange} className="space-y-5 p-5 sm:p-6">
            <div><label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label><div className="relative"><input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-11 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100" placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            <div><label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label><div className="relative"><input id="confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-11 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100" placeholder="Enter the same password again" /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700">{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3.5 text-sm text-sky-900"><p className="font-medium">Password tips</p><p className="mt-1 leading-5 text-sky-800">Use at least 8 characters and avoid reusing a password from another account.</p></div>
            <button type="submit" disabled={savingPassword || !password || !confirmPassword} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">{savingPassword ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{savingPassword ? "Updating password..." : "Update password"}</button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-semibold text-slate-900">Account security</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Your access is controlled by your SmartGrade role and database permissions. Keep your sign-in credentials private, sign out when using a shared computer, and contact an administrator if you notice unexpected account activity.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-xl border border-slate-100 p-4"><ShieldCheck className="h-5 w-5 text-emerald-600" /><div><p className="text-sm font-medium text-slate-800">Role-based access</p><p className="mt-0.5 text-xs text-slate-500">Your permissions are enforced by SmartGrade.</p></div></div><div className="flex items-center gap-3 rounded-xl border border-slate-100 p-4"><Bell className="h-5 w-5 text-slate-500" /><div><p className="text-sm font-medium text-slate-800">Notifications</p><p className="mt-0.5 text-xs text-slate-500">Notification preferences are not configurable here yet.</p></div></div></div></section>
    </main>
  );
}
