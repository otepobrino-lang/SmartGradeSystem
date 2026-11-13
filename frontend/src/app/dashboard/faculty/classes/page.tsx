"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  GraduationCap,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  course_code: string;
  title: string;
  units: number | null;
};

type AcademicTerm = {
  academic_year: string;
  term_name: string;
  status: string;
  starts_on?: string | null;
  ends_on?: string | null;
};

type FacultyClass = {
  id: string;
  course_id: string;
  term_id: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  is_active: boolean;
  created_at?: string;
  courses: Course | Course[] | null;
  academic_terms: AcademicTerm | AcademicTerm[] | null;
};

type Enrollment = {
  id: string;
  class_id: string;
  student_id: string;
  is_active: boolean;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  institutional_email?: string | null;
};

type StudentRow = StudentProfile & {
  enrollment_id: string;
  class_id: string;
};

type StatusFilter = "all" | "active" | "inactive";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatTerm(term: AcademicTerm | null) {
  if (!term) return "Academic term not assigned";
  return [term.term_name, term.academic_year].filter(Boolean).join(" · ");
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

export default function FacultyClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<FacultyClass[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadClasses = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile || !profile.is_active) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (profile.role !== "faculty") {
        const destinations: Record<string, string> = {
          student: "/dashboard",
          administrator: "/dashboard/admin",
          dean: "/dashboard/dean",
          registrar: "/dashboard/registrar",
          guidance: "/dashboard/guidance",
        };
        router.replace(destinations[profile.role] ?? "/login");
        return;
      }

      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select(
          "id, course_id, term_id, section, room, schedule_text, is_active, created_at, courses(course_code, title, units), academic_terms(academic_year, term_name, status, starts_on, ends_on)"
        )
        .eq("faculty_id", authData.user.id)
        .order("created_at", { ascending: false });

      if (classError) throw new Error("We couldn't load your assigned classes. Please refresh and try again.");

      const assignedClasses = (classData ?? []) as unknown as FacultyClass[];
      setClasses(assignedClasses);

      if (assignedClasses.length === 0) {
        setEnrollments([]);
        setStudents([]);
        return;
      }

      const classIds = assignedClasses.map((item) => item.id);
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("id, class_id, student_id, is_active")
        .in("class_id", classIds)
        .eq("is_active", true);

      if (enrollmentError) throw new Error("Your classes loaded, but student enrollment totals couldn't be retrieved.");

      const activeEnrollments = (enrollmentData ?? []) as Enrollment[];
      setEnrollments(activeEnrollments);

      const studentIds = [...new Set(activeEnrollments.map((item) => item.student_id))];
      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const { data: profileData, error: studentsError } = await supabase
        .from("profiles")
        .select("id, full_name, institutional_email")
        .in("id", studentIds);

      if (studentsError) {
        setStudents([]);
      } else {
        const profileById = new Map(
          ((profileData ?? []) as StudentProfile[]).map((item) => [item.id, item])
        );
        setStudents(
          activeEnrollments.map((enrollment) => ({
            ...(profileById.get(enrollment.student_id) ?? {
              id: enrollment.student_id,
              full_name: "Student profile unavailable",
              institutional_email: null,
            }),
            enrollment_id: enrollment.id,
            class_id: enrollment.class_id,
          }))
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong while loading My Classes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void loadClasses(true);
      }, 250);
    };

    const channel = supabase
      .channel("faculty-my-classes-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "classes" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enrollments" },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadClasses]);

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return classes.filter((classItem) => {
      const course = firstOf(classItem.courses);
      const term = firstOf(classItem.academic_terms);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && classItem.is_active) ||
        (statusFilter === "inactive" && !classItem.is_active);
      const searchable = [
        course?.course_code,
        course?.title,
        classItem.section,
        classItem.room,
        classItem.schedule_text,
        term?.term_name,
        term?.academic_year,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [classes, search, statusFilter]);

  const activeCount = classes.filter((item) => item.is_active).length;
  const inactiveCount = classes.length - activeCount;
  const totalStudents = new Set(enrollments.map((item) => item.student_id)).size;

  function studentCount(classId: string) {
    return enrollments.filter((item) => item.class_id === classId).length;
  }

  function classStudents(classId: string) {
    return students
      .filter((item) => item.class_id === classId)
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin text-sky-700" />
          Loading your classes...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-700">Faculty Workspace</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My Classes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Review the classes assigned to you, check enrollment totals, and open class-specific grade or attendance tools.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadClasses(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => void loadClasses(true)} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Assigned classes</p>
              <BookOpen className="h-5 w-5 text-sky-700" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{classes.length}</p>
            <p className="mt-1 text-xs text-slate-500">{activeCount} active · {inactiveCount} inactive</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Active class enrollments</p>
              <GraduationCap className="h-5 w-5 text-sky-700" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{enrollments.length}</p>
            <p className="mt-1 text-xs text-slate-500">{totalStudents} unique student(s) across your classes</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Class terms</p>
              <CalendarDays className="h-5 w-5 text-sky-700" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {new Set(classes.map((item) => item.term_id)).size}
            </p>
            <p className="mt-1 text-xs text-slate-500">Distinct academic term(s) represented</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Assigned class list</h2>
              <p className="mt-1 text-sm text-slate-500">Only classes assigned to your signed-in faculty account are shown.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block min-w-0 sm:min-w-64">
                <span className="sr-only">Search classes</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search course, section, room..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
                {search && (
                  <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
              <label className="relative block">
                <span className="sr-only">Filter by class status</span>
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 sm:min-w-40"
                >
                  <option value="active">Active classes</option>
                  <option value="all">All classes</option>
                  <option value="inactive">Inactive classes</option>
                </select>
              </label>
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-5 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {classes.length === 0 ? "No classes assigned yet" : "No matching classes"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {classes.length === 0
                  ? "Your assigned classes will appear here once an administrator or registrar assigns them to your faculty account."
                  : "Try another search term or change the status filter to see more classes."}
              </p>
              {(search || statusFilter !== "active") && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setStatusFilter("all"); }}
                  className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {filteredClasses.map((classItem) => {
                const course = firstOf(classItem.courses);
                const term = firstOf(classItem.academic_terms);
                const classStudentRows = classStudents(classItem.id);
                const expanded = expandedClassId === classItem.id;
                return (
                  <article key={classItem.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-sky-200 hover:shadow-sm">
                    <div className="border-b border-slate-100 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                              {course?.course_code || "Course"}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${classItem.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${classItem.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                              {classItem.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-semibold leading-6 text-slate-900">
                            {course?.title || "Untitled course"}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">Section {classItem.section || "Not specified"}</p>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
                          <BookOpen className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-500">Academic term</p>
                            <p className="mt-1 text-sm font-medium text-slate-800">{formatTerm(term)}</p>
                            {term?.status && <p className="mt-1 text-xs capitalize text-slate-500">{term.status}</p>}
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-500">Room and schedule</p>
                            <p className="mt-1 break-words text-sm font-medium text-slate-800">{classItem.room || "Room not assigned"}</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{classItem.schedule_text || "Schedule not specified"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Users className="h-4 w-4 text-slate-500" />
                          <span><strong className="font-semibold text-slate-900">{studentCount(classItem.id)}</strong> active enrollment(s)</span>
                          {course?.units != null && <span className="text-slate-300">|</span>}
                          {course?.units != null && <span>{course.units} unit(s)</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedClassId(expanded ? null : classItem.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                        >
                          <Users className="h-4 w-4" />
                          {expanded ? "Hide students" : "View students"}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-b border-slate-100 bg-slate-50/70 p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-slate-900">Enrolled students</h4>
                          <span className="text-xs text-slate-500">{classStudentRows.length} listed</span>
                        </div>
                        {classStudentRows.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                            No active student enrollments were found for this class.
                          </p>
                        ) : (
                          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                            {classStudentRows.map((student) => (
                              <li key={student.enrollment_id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">
                                  {initials(student.full_name || "Student")}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-900">{student.full_name || "Student"}</p>
                                  <p className="truncate text-xs text-slate-500">{student.institutional_email || "Institutional email unavailable"}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 p-5 sm:px-6">
                      <Link
                        href={`/dashboard/faculty/grades?classId=${encodeURIComponent(classItem.id)}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800"
                      >
                        <GraduationCap className="h-4 w-4" />
                        Grade Management
                      </Link>
                      <Link
                        href={`/dashboard/faculty/attendance?classId=${encodeURIComponent(classItem.id)}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Clock3 className="h-4 w-4" />
                        Attendance
                      </Link>
                      {classItem.is_active && (
                        <span className="ml-auto inline-flex items-center gap-1.5 self-center text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Available this term
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <p className="mt-5 text-xs leading-5 text-slate-400">
          Class assignments and student visibility are governed by your signed-in account and Supabase access policies.
        </p>
      </div>
    </main>
  );
}
