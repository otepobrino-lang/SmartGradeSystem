
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string;
  role: string;
  is_active: boolean;
};

const studentNavigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Courses", href: "/dashboard/courses", icon: BookOpen },
  { label: "Programs", href: "/dashboard/programs", icon: GraduationCap },
  { label: "Grade History", href: "/dashboard/grades", icon: ChartNoAxesCombined },
  { label: "Attendance", href: "/dashboard/attendance", icon: CalendarDays },
  { label: "Curriculum", href: "/dashboard/curriculum", icon: BookOpen },
  { label: "Account Settings", href: "/dashboard/settings", icon: Settings },
];

const administratorNavigation = [
  { label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
  { label: "Faculty Management", href: "/dashboard/admin/faculty", icon: Users },
  { label: "Students", href: "/dashboard/admin/students", icon: GraduationCap },
  { label: "Departments", href: "/dashboard/admin/departments", icon: ClipboardList },
  { label: "Programs", href: "/dashboard/programs", icon: BookOpen },
  { label: "Academic Terms", href: "/dashboard/admin/terms", icon: CalendarDays },
  { label: "Classes", href: "/dashboard/admin/classes", icon: ClipboardList },
  { label: "Audit Logs", href: "/dashboard/admin/audit-logs", icon: Activity },
  { label: "Account Settings", href: "/dashboard/settings", icon: Settings },
];

const facultyNavigation = [
  { label: "Overview", href: "/dashboard/faculty", icon: LayoutDashboard },
  { label: "My Classes", href: "/dashboard/faculty/classes", icon: BookOpen },
  { label: "Grade Management", href: "/dashboard/faculty/grades", icon: ChartNoAxesCombined },
  { label: "Attendance", href: "/dashboard/faculty/attendance", icon: CalendarDays },
  { label: "Account Settings", href: "/dashboard/settings", icon: Settings },
];

const deanNavigation = [
  { label: "Overview", href: "/dashboard/dean", icon: LayoutDashboard },
  { label: "Faculty", href: "/dashboard/dean/faculty", icon: Users },
  { label: "Classes", href: "/dashboard/dean/classes", icon: BookOpen },
  { label: "Academic Reports", href: "/dashboard/dean/reports", icon: ChartNoAxesCombined },
  { label: "Account Settings", href: "/dashboard/settings", icon: Settings },
];

const registrarNavigation = [
  { label: "Overview", href: "/dashboard/registrar", icon: LayoutDashboard },
  { label: "Students", href: "/dashboard/registrar/students", icon: Users },
  { label: "Enrollments", href: "/dashboard/registrar/enrollments", icon: GraduationCap },
  { label: "Classes", href: "/dashboard/registrar/classes", icon: BookOpen },
  { label: "Academic Terms", href: "/dashboard/registrar/terms", icon: CalendarDays },
  { label: "Account Settings", href: "/dashboard/settings", icon: Settings },
];

const guidanceNavigation = [
  { label: "Overview", href: "/dashboard/guidance", icon: LayoutDashboard },
  { label: "Student Support", href: "/dashboard/guidance/students", icon: Users },
  { label: "Risk Assessments", href: "/dashboard/guidance/risks", icon: Activity },
  { label: "Account Settings", href: "/dashboard/settings", icon: Settings },
];

function getNavigation(role: string) {
  switch (role) {
    case "administrator":
      return { title: "Administrator workspace", items: administratorNavigation };
    case "faculty":
      return { title: "Faculty workspace", items: facultyNavigation };
    case "dean":
      return { title: "Dean workspace", items: deanNavigation };
    case "registrar":
      return { title: "Registrar workspace", items: registrarNavigation };
    case "guidance":
      return { title: "Guidance workspace", items: guidanceNavigation };
    case "student":
      return { title: "Student workspace", items: studentNavigation };
    default:
      return { title: "Restricted workspace", items: [] };
  }
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setError("");

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      router.replace("/login");
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, role, is_active")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !data || !data.is_active) {
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    setProfile(data as Profile);
  }, [router]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        await loadProfile();
      } catch {
        if (mounted) setError("Unable to load your account information.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [loadProfile]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (pathname === "/dashboard") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <BookOpen className="mx-auto h-8 w-8 text-sky-700" />
          <p className="mt-4 text-sm font-medium text-slate-800">
            Loading your workspace
          </p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-8 w-8 text-red-600" />
          <p className="mt-3 text-sm text-slate-700">
            {error || "Unable to load your account."}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadProfile().finally(() => setLoading(false));
            }}
            className="mt-4 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const workspace = getNavigation(profile.role);

  if (workspace.items.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="mt-4 text-xl font-semibold">Access unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your account role is not configured for a workspace. Please contact
            your system administrator.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-5 rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-700 text-white">
            <BookOpen size={23} />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">SmartGrade</p>
            <p className="text-xs text-slate-500">Samar State University</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {workspace.title}
          </p>
          <nav className="space-y-1">
            {workspace.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  item.href !== "/dashboard/admin" &&
                  pathname.startsWith(`${item.href}/`)) ||
                (item.href === "/dashboard/admin" &&
                  pathname.startsWith("/dashboard/admin"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-sky-50 text-sky-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-600" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
                {initials(profile.full_name || "User")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {profile.full_name}
                </p>
                <p className="mt-0.5 text-xs capitalize text-slate-500">
                  {profile.role}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={21} />
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-900">SmartGrade</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {workspace.title}
            </p>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
