
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Counts = {
  profiles: number;
  students: number;
  faculty: number;
  departments: number;
  programs: number;
  courses: number;
  classes: number;
  activeTerms: number;
};

const initialCounts: Counts = {
  profiles: 0,
  students: 0,
  faculty: 0,
  departments: 0,
  programs: 0,
  courses: 0,
  classes: 0,
  activeTerms: 0,
};

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {value.toLocaleString()}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <Icon size={21} />
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export default function AdministratorDashboardPage() {
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCounts = useCallback(async (refresh = false) => {
    setError("");
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        window.location.assign("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", authData.user.id)
        .single();

      if (
        profileError ||
        !profile ||
        !profile.is_active ||
        profile.role !== "administrator"
      ) {
        setError("You are not authorized to access the administrator dashboard.");
        return;
      }

      const [
        profilesResult,
        studentsResult,
        facultyResult,
        departmentsResult,
        programsResult,
        coursesResult,
        classesResult,
        termsResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").eq("is_active", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "faculty").eq("is_active", true),
        supabase.from("departments").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("programs").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("academic_terms").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      const results = [
        profilesResult,
        studentsResult,
        facultyResult,
        departmentsResult,
        programsResult,
        coursesResult,
        classesResult,
        termsResult,
      ];

      const failedResult = results.find((result) => result.error);

      if (failedResult?.error) {
        throw new Error(
          `Unable to load all system statistics: ${failedResult.error.message}`
        );
      }

      setCounts({
        profiles: profilesResult.count ?? 0,
        students: studentsResult.count ?? 0,
        faculty: facultyResult.count ?? 0,
        departments: departmentsResult.count ?? 0,
        programs: programsResult.count ?? 0,
        courses: coursesResult.count ?? 0,
        classes: classesResult.count ?? 0,
        activeTerms: termsResult.count ?? 0,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load administrator statistics."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const metrics = [
    {
      label: "Active students",
      value: counts.students,
      description: "Active student profiles",
      icon: GraduationCap,
    },
    {
      label: "Active faculty",
      value: counts.faculty,
      description: "Active faculty profiles",
      icon: Users,
    },
    {
      label: "Departments",
      value: counts.departments,
      description: "Active academic departments",
      icon: BookOpen,
    },
    {
      label: "Programs",
      value: counts.programs,
      description: "Active academic programs",
      icon: GraduationCap,
    },
    {
      label: "Courses",
      value: counts.courses,
      description: "Active course records",
      icon: BookOpen,
    },
    {
      label: "Active classes",
      value: counts.classes,
      description: "Class sections marked active",
      icon: CalendarDays,
    },
    {
      label: "Active academic terms",
      value: counts.activeTerms,
      description: "Terms currently marked active",
      icon: CalendarDays,
    },
    {
      label: "User profiles",
      value: counts.profiles,
      description: "Profiles visible to your account",
      icon: ShieldCheck,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
            System administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Administrator Overview
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Monitor SmartGrade academic records, user accounts, and system setup.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCounts(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh statistics"}
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading system statistics...
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Management shortcuts
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Open an administration section to manage academic operations.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: "Faculty Management",
              description: "Add faculty accounts and assign departments.",
              href: "/dashboard/admin/faculty",
              icon: Users,
            },
            {
              title: "Programs Catalog",
              description: "Review active university programs.",
              href: "/dashboard/programs",
              icon: GraduationCap,
            },
            {
              title: "Curriculum",
              description: "Review program curriculum and course mappings.",
              href: "/dashboard/curriculum",
              icon: BookOpen,
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <item.icon size={21} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-sky-700"
                />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">
              System setup status
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Statistics reflect the records your current authenticated account
              is allowed to read under Supabase Row Level Security. A zero count
              can mean there are no records yet or that the current account
              cannot read those records.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
