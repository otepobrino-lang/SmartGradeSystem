
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  Search,
  ShieldCheck,
  UserRound,
  AlertCircle,
  ClipboardCheck,
  CalendarCheck,
  CircleX
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  course_code: string;
  title: string;
};

type Term = {
  academic_year: string;
  term_name: string;
};

type ClassRecord = {
  id: string;
  section: string;
  courses: Course | Course[] | null;
  academic_terms: Term | Term[] | null;
};

type AttendanceRecord = {
  id: string;
  class_id: string;
  student_id: string;
  session_date: string;
  status: string;
  notes: string | null;
  classes: ClassRecord | ClassRecord[] | null;
};

type Profile = {
  full_name: string;
  role: string;
  is_active: boolean;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function normalizeStatus(status: string) {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function statusLabel(status: string) {
  const normalized = normalizeStatus(status);

  const labels: Record<string, string> = {
    present: "Present",
    absent: "Absent",
    late: "Late",
    excused: "Excused",
  };

  return labels[normalized] ??
    normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  const styles: Record<string, string> = {
    present: "border-emerald-200 bg-emerald-50 text-emerald-700",
    absent: "border-red-200 bg-red-50 text-red-700",
    late: "border-amber-200 bg-amber-50 text-amber-700",
    excused: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[normalized] ?? "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof CalendarDays;
  iconClass: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}

export default function AttendancePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const loadAttendance = useCallback(
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

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("full_name, role, is_active")
          .eq("id", authData.user.id)
          .single();

        if (profileError || !profileData || !profileData.is_active) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (profileData.role !== "student") {
          router.replace("/dashboard");
          return;
        }

        const {
          data: attendanceData,
          error: attendanceError,
        } = await supabase
          .from("attendance_records")
          .select(
            "id, class_id, student_id, session_date, status, notes, classes(id, section, courses(course_code, title), academic_terms(academic_year, term_name))"
          )
          .eq("student_id", authData.user.id)
          .order("session_date", { ascending: false });

        if (attendanceError) {
          console.error("Attendance query failed:", attendanceError.message);
          throw new Error("Unable to load your attendance records. Please try again.");
        }

        setProfile({
          full_name: profileData.full_name,
          role: profileData.role,
          is_active: profileData.is_active,
        });

        setRecords((attendanceData ?? []) as unknown as AttendanceRecord[]);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "An unexpected error occurred while loading attendance."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const terms = useMemo(() => {
    const values = new Set<string>();

    records.forEach((record) => {
      const classInfo = firstOf(record.classes);
      const term = firstOf(classInfo?.academic_terms);

      if (term) {
        values.add(`${term.academic_year} · ${term.term_name}`);
      }
    });

    return Array.from(values).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const classInfo = firstOf(record.classes);
      const course = firstOf(classInfo?.courses);
      const term = firstOf(classInfo?.academic_terms);
      const termLabel = term
        ? `${term.academic_year} · ${term.term_name}`
        : "";

      const matchesSearch =
        !query ||
        course?.course_code.toLowerCase().includes(query) ||
        course?.title.toLowerCase().includes(query) ||
        classInfo?.section.toLowerCase().includes(query) ||
        record.session_date.toLowerCase().includes(query);

      const matchesTerm =
        selectedTerm === "all" || selectedTerm === termLabel;

      const matchesStatus =
        selectedStatus === "all" ||
        normalizeStatus(record.status) === selectedStatus;

      return matchesSearch && matchesTerm && matchesStatus;
    });
  }, [records, search, selectedTerm, selectedStatus]);

  const summary = useMemo(() => {
    const present = records.filter(
      (record) => normalizeStatus(record.status) === "present"
    ).length;

    const absent = records.filter(
      (record) => normalizeStatus(record.status) === "absent"
    ).length;

    const late = records.filter(
      (record) => normalizeStatus(record.status) === "late"
    ).length;

    const excused = records.filter(
      (record) => normalizeStatus(record.status) === "excused"
    ).length;

    const counted = records.filter((record) =>
      ["present", "absent", "late", "excused"].includes(
        normalizeStatus(record.status)
      )
    ).length;

    const attended = present + late + excused;

    return {
      total: records.length,
      present,
      absent,
      late,
      excused,
      rate: counted > 0 ? (attended / counted) * 100 : null,
    };
  }, [records]);


  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CalendarCheck className="mx-auto text-sky-700" size={28} />
          <p className="mt-4 text-sm font-medium text-slate-800">
            Loading your attendance
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Retrieving your academic records.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8 lg:px-10">
          <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                Academic records
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Attendance
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Review your recorded attendance by course and academic term.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600">
              <ShieldCheck size={17} className="text-sky-700" />
              Private academic records
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={() => void loadAttendance(true)}
                className="shrink-0 font-semibold underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Attendance rate"
              value={summary.rate === null ? "—" : `${summary.rate.toFixed(1)}%`}
              description="Present, late, and excused records counted"
              icon={ChartNoAxesCombined}
              iconClass="bg-sky-50 text-sky-700"
            />
            <StatCard
              title="Total sessions"
              value={summary.total}
              description="Attendance records available"
              icon={CalendarDays}
              iconClass="bg-indigo-50 text-indigo-700"
            />
            <StatCard
              title="Present"
              value={summary.present}
              description="Sessions marked present"
              icon={CheckCircle2}
              iconClass="bg-emerald-50 text-emerald-700"
            />
            <StatCard
              title="Absent"
              value={summary.absent}
              description="Sessions marked absent"
              icon={CircleX}
              iconClass="bg-red-50 text-red-700"
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Clock3 size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Late</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {summary.late}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Excused</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {summary.excused}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px]">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search course, section, or date"
                  aria-label="Search attendance records"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <select
                value={selectedTerm}
                onChange={(event) => setSelectedTerm(event.target.value)}
                aria-label="Filter by academic term"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">All academic terms</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                aria-label="Filter by attendance status"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">All statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Showing {filteredRecords.length} of {records.length} attendance records
              </p>
              {(search || selectedTerm !== "all" || selectedStatus !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedTerm("all");
                    setSelectedStatus("all");
                  }}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <h2 className="font-semibold text-slate-900">Attendance records</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your attendance history, ordered from newest to oldest.
              </p>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                  <CalendarDays size={27} />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">
                  {records.length === 0
                    ? "No attendance records yet"
                    : "No matching records"}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {records.length === 0
                    ? "When your faculty records attendance for your classes, your results will appear here."
                    : "Try changing your search or filters to find attendance records."}
                </p>
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSelectedTerm("all");
                      setSelectedStatus("all");
                    }}
                    className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-4">Session date</th>
                        <th className="px-6 py-4">Course</th>
                        <th className="px-6 py-4">Section</th>
                        <th className="px-6 py-4">Academic term</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecords.map((record) => {
                        const classInfo = firstOf(record.classes);
                        const course = firstOf(classInfo?.courses);
                        const term = firstOf(classInfo?.academic_terms);

                        return (
                          <tr key={record.id} className="transition hover:bg-slate-50/70">
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-800">
                              {formatDate(record.session_date)}
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-semibold text-sky-700">
                                {course?.course_code ?? "Course unavailable"}
                              </p>
                              <p className="mt-1 max-w-xs text-sm text-slate-700">
                                {course?.title ?? "Course information unavailable"}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {classInfo?.section ?? "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {term
                                ? `${term.academic_year} · ${term.term_name}`
                                : "—"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <StatusBadge status={record.status} />
                            </td>
                            <td className="max-w-xs px-6 py-4 text-sm text-slate-500">
                              {record.notes?.trim() || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                  {filteredRecords.map((record) => {
                    const classInfo = firstOf(record.classes);
                    const course = firstOf(classInfo?.courses);
                    const term = firstOf(classInfo?.academic_terms);

                    return (
                      <article key={record.id} className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-sky-700">
                              {course?.course_code ?? "Course unavailable"}
                            </p>
                            <h3 className="mt-1 font-semibold text-slate-900">
                              {course?.title ?? "Course information unavailable"}
                            </h3>
                          </div>
                          <StatusBadge status={record.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">Session date</p>
                            <p className="mt-1 font-medium text-slate-800">
                              {formatDate(record.session_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Section</p>
                            <p className="mt-1 font-medium text-slate-800">
                              {classInfo?.section ?? "—"}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Academic term</p>
                          <p className="mt-1 text-sm text-slate-700">
                            {term
                              ? `${term.academic_year} · ${term.term_name}`
                              : "—"}
                          </p>
                        </div>

                        {record.notes?.trim() && (
                          <div>
                            <p className="text-xs text-slate-500">Notes</p>
                            <p className="mt-1 text-sm leading-5 text-slate-700">
                              {record.notes}
                            </p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
            <UserRound size={15} className="mt-0.5 shrink-0" />
            Attendance records are read-only. Contact your faculty member if you
            believe an attendance entry needs correction.
          </p>
        </main>
      </div>
  );
}
