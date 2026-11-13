
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  course_code: string;
  title: string;
};

type AcademicTerm = {
  academic_year: string;
  term_name: string;
};

type ClassRecord = {
  id: string;
  section: string;
  courses: Course | Course[] | null;
  academic_terms: AcademicTerm | AcademicTerm[] | null;
};

type GradeRecord = {
  id: string;
  class_id: string;
  term_id: string;
  final_grade: number | null;
  status: string;
  created_at: string;
  classes: ClassRecord | ClassRecord[] | null;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatGrade(value: number | null) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPublished(grade: GradeRecord) {
  return (
    grade.final_grade !== null &&
    Number.isFinite(Number(grade.final_grade)) &&
    ["approved", "published"].includes(grade.status.toLowerCase())
  );
}

export default function GradeHistoryPage() {
  const router = useRouter();
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("all");

  const loadGrades = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const supabase = createClient();
        const {
          data: authData,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, role, is_active")
          .eq("id", authData.user.id)
          .single();

        if (profileError || !profile || !profile.is_active) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (profile.role !== "student") {
          router.replace("/dashboard");
          return;
        }

        setStudentName(profile.full_name ?? "");

        const { data, error: gradeError } = await supabase
          .from("grades")
          .select(
            "id, class_id, term_id, final_grade, status, created_at, classes(id, section, courses(course_code, title), academic_terms(academic_year, term_name))"
          )
          .eq("student_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (gradeError) throw new Error(gradeError.message);

        setGrades((data ?? []) as unknown as GradeRecord[]);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load your grade history."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void loadGrades();
  }, [loadGrades]);

  const publishedGrades = useMemo(
    () => grades.filter(isPublished),
    [grades]
  );

  const terms = useMemo(() => {
    const values = new Map<string, string>();

    publishedGrades.forEach((grade) => {
      const term = firstOf(firstOf(grade.classes)?.academic_terms);

      if (term) {
        const label = `${term.academic_year} · ${term.term_name}`;
        values.set(label, label);
      }
    });

    return Array.from(values.keys()).sort((a, b) => b.localeCompare(a));
  }, [publishedGrades]);

  const filteredGrades = useMemo(() => {
    const query = search.trim().toLowerCase();

    return publishedGrades.filter((grade) => {
      const classRecord = firstOf(grade.classes);
      const course = firstOf(classRecord?.courses);
      const term = firstOf(classRecord?.academic_terms);
      const termLabel = term
        ? `${term.academic_year} · ${term.term_name}`
        : "Term unavailable";

      const matchesSearch =
        !query ||
        course?.course_code.toLowerCase().includes(query) ||
        course?.title.toLowerCase().includes(query) ||
        classRecord?.section.toLowerCase().includes(query) ||
        termLabel.toLowerCase().includes(query);

      const matchesTerm =
        selectedTerm === "all" || selectedTerm === termLabel;

      return matchesSearch && matchesTerm;
    });
  }, [publishedGrades, search, selectedTerm]);

  const averageGrade = useMemo(() => {
    if (!publishedGrades.length) return null;

    return (
      publishedGrades.reduce(
        (total, grade) => total + Number(grade.final_grade),
        0
      ) / publishedGrades.length
    );
  }, [publishedGrades]);

  const latestGrade = publishedGrades[0] ?? null;



  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <RefreshCw className="mx-auto animate-spin text-sky-700" size={26} />
          <p className="mt-4 text-sm font-medium text-slate-800">
            Loading your grade history
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Retrieving your published academic records.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 lg:px-8">
          <section>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Academic records
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Grade History
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Review your approved and published final grades across your
                  academic terms.
                </p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
                <ShieldCheck size={17} className="text-sky-700" />
                Private academic records
              </div>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <p className="font-medium">Unable to load grade history</p>
              <p className="mt-1 break-words">{error}</p>
              <button
                type="button"
                onClick={() => void loadGrades(true)}
                className="mt-3 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Published grade average
                </p>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <ChartNoAxesCombined size={20} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {averageGrade === null ? "—" : formatGrade(averageGrade)}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                {publishedGrades.length
                  ? "Average of available published final grades"
                  : "No published final grades available yet"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Published records
                </p>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <BookOpen size={20} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {publishedGrades.length}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Approved or published final grades
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Latest published grade
                </p>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 size={20} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {latestGrade ? formatGrade(latestGrade.final_grade) : "—"}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                {latestGrade
                  ? `Recorded ${formatDate(latestGrade.created_at)}`
                  : "Your latest result will appear here"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search course code, title, section, or term"
                  aria-label="Search grade records"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>
              <select
                value={selectedTerm}
                onChange={(event) => setSelectedTerm(event.target.value)}
                aria-label="Filter by academic term"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 lg:w-64"
              >
                <option value="all">All academic terms</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Showing {filteredGrades.length} of {publishedGrades.length}{" "}
                published records
              </p>
              {(search || selectedTerm !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedTerm("all");
                  }}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <h2 className="font-semibold text-slate-900">
                Published grade records
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Your approved final grades, organized by course and academic
                term.
              </p>
            </div>

            {filteredGrades.length === 0 ? (
              <div className="p-5 sm:p-6">
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-800">
                    {publishedGrades.length === 0
                      ? "No published grades yet"
                      : "No matching grade records"}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {publishedGrades.length === 0
                      ? "When your faculty approves or publishes your final grades, they will appear here."
                      : "Try another search term or select a different academic term."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-4">Course</th>
                        <th className="px-6 py-4">Section</th>
                        <th className="px-6 py-4">Academic term</th>
                        <th className="px-6 py-4">Final grade</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Date recorded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredGrades.map((grade) => {
                        const classRecord = firstOf(grade.classes);
                        const course = firstOf(classRecord?.courses);
                        const term = firstOf(classRecord?.academic_terms);

                        return (
                          <tr key={grade.id} className="hover:bg-slate-50/70">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-900">
                                {course?.title ?? "Course unavailable"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {course?.course_code ?? "No course code"}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {classRecord?.section ?? "—"}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {term
                                ? `${term.academic_year} · ${term.term_name}`
                                : "Term unavailable"}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-lg font-semibold text-slate-900">
                                {formatGrade(grade.final_grade)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 size={13} />
                                {grade.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {formatDate(grade.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                  {filteredGrades.map((grade) => {
                    const classRecord = firstOf(grade.classes);
                    const course = firstOf(classRecord?.courses);
                    const term = firstOf(classRecord?.academic_terms);

                    return (
                      <article key={grade.id} className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                              {course?.course_code ?? "Course"}
                            </p>
                            <h3 className="mt-1 font-semibold text-slate-900">
                              {course?.title ?? "Course unavailable"}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Section {classRecord?.section ?? "—"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-2xl font-semibold text-slate-900">
                              {formatGrade(grade.final_grade)}
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
                              <CheckCircle2 size={13} />
                              {grade.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                          <CalendarDays size={15} className="mt-0.5 shrink-0" />
                          <div>
                            <p>
                              {term
                                ? `${term.academic_year} · ${term.term_name}`
                                : "Term unavailable"}
                            </p>
                            <p className="mt-1">
                              Recorded {formatDate(grade.created_at)}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <section className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-sky-700" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Your academic records are private
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                This page retrieves grade records associated with your signed-in
                student account. Grades that have not been approved or published
                are excluded from this history.
              </p>
            </div>
          </section>
        </main>
      </div>
  );
}
