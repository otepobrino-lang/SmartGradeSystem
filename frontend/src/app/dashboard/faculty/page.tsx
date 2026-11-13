"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  Users,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type FacultyProfile = {
  full_name: string;
  role: string;
  is_active: boolean;
};

type Course = {
  course_code: string;
  title: string;
  units: number | null;
};

type AcademicTerm = {
  academic_year: string;
  term_name: string;
  status: string;
};

type FacultyClass = {
  id: string;
  course_id: string;
  term_id: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  is_active: boolean;
  courses: Course | Course[] | null;
  academic_terms: AcademicTerm | AcademicTerm[] | null;
};

type Enrollment = {
  id: string;
  class_id: string;
  student_id: string;
  is_active: boolean;
};

type Grade = {
  id: string;
  class_id: string;
  final_grade: number | null;
  status: string;
};

type Attendance = {
  id: string;
  class_id: string;
  session_date: string;
  status: string;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof BookOpen;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <Icon size={21} />
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{description}</p>
    </section>
  );
}

export default function FacultyDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [classes, setClasses] = useState<FacultyClass[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (refresh = false) => {
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

      const userId = authData.user.id;
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role, is_active")
        .eq("id", userId)
        .single();

      if (profileError || !profileData || !profileData.is_active) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (profileData.role !== "faculty") {
        const destinations: Record<string, string> = {
          student: "/dashboard",
          administrator: "/dashboard/admin",
          dean: "/dashboard/dean",
          registrar: "/dashboard/registrar",
          guidance: "/dashboard/guidance",
        };
        router.replace(destinations[profileData.role] ?? "/login");
        return;
      }

      const [classResult, enrollmentResult, gradeResult, attendanceResult] =
        await Promise.all([
          supabase
            .from("classes")
            .select(
              "id, course_id, term_id, section, room, schedule_text, is_active, courses(course_code, title, units), academic_terms(academic_year, term_name, status)"
            )
            .eq("faculty_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("enrollments")
            .select("id, class_id, student_id, is_active")
            .eq("is_active", true),
          supabase
            .from("grades")
            .select("id, class_id, final_grade, status"),
          supabase
            .from("attendance_records")
            .select("id, class_id, session_date, status")
            .order("session_date", { ascending: false }),
        ]);

      if (classResult.error) throw new Error("Unable to load your assigned classes.");
      if (enrollmentResult.error) throw new Error("Unable to load enrollment totals.");
      if (gradeResult.error) throw new Error("Unable to load grade progress.");
      if (attendanceResult.error) throw new Error("Unable to load attendance summaries.");

      const assignedClasses = (classResult.data ?? []) as unknown as FacultyClass[];
      const classIds = new Set(assignedClasses.map((item) => item.id));

      setProfile({
        full_name: profileData.full_name ?? "Faculty",
        role: profileData.role,
        is_active: profileData.is_active,
      });
      setClasses(assignedClasses);
      setEnrollments(
        ((enrollmentResult.data ?? []) as Enrollment[]).filter((item) =>
          classIds.has(item.class_id)
        )
      );
      setGrades(
        ((gradeResult.data ?? []) as Grade[]).filter((item) =>
          classIds.has(item.class_id)
        )
      );
      setAttendance(
        ((attendanceResult.data ?? []) as Attendance[]).filter((item) =>
          classIds.has(item.class_id)
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the faculty dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeClasses = useMemo(
    () => classes.filter((item) => item.is_active),
    [classes]
  );

  const activeStudentCount = useMemo(
    () => new Set(enrollments.filter((item) => item.is_active).map((item) => item.student_id)).size,
    [enrollments]
  );

  const gradeProgress = useMemo(() => {
    if (!activeStudentCount || !activeClasses.length) return { completed: 0, total: 0 };
    const relevant = grades.filter((grade) =>
      activeClasses.some((classItem) => classItem.id === grade.class_id)
    );
    const completed = relevant.filter(
      (grade) => grade.final_grade !== null && ["submitted", "approved", "published"].includes(grade.status)
    ).length;
    const total = activeClasses.reduce(
      (sum, classItem) =>
        sum + enrollments.filter((enrollment) => enrollment.class_id === classItem.id && enrollment.is_active).length,
      0
    );
    return { completed, total };
  }, [activeClasses, activeStudentCount, enrollments, grades]);

  const recentAttendance = useMemo(() => attendance.slice(0, 5), [attendance]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin text-sky-700" />
          Loading your faculty dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-700">Faculty Workspace</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome, {displayName(profile?.full_name ?? "Faculty")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Here is an overview of your assigned classes and academic activity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              className="font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Assigned Classes"
            value={String(activeClasses.length)}
            description={`${classes.length} total class record(s), including inactive classes.`}
            icon={BookOpen}
          />
          <StatCard
            label="Enrolled Students"
            value={String(activeStudentCount)}
            description="Unique students across your active assigned classes."
            icon={Users}
          />
          <StatCard
            label="Grade Records"
            value={String(grades.length)}
            description={`${gradeProgress.completed} grade record(s) have a final grade and are submitted, approved, or published.`}
            icon={GraduationCap}
          />
          <StatCard
            label="Attendance Records"
            value={String(attendance.length)}
            description="Attendance entries recorded across your assigned classes."
            icon={CalendarDays}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">My Classes</h2>
                <p className="mt-1 text-sm text-slate-500">Classes assigned to your faculty account.</p>
              </div>
              <Link
                href="/dashboard/faculty/classes"
                className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800"
              >
                View classes <ArrowRight size={16} />
              </Link>
            </div>

            {activeClasses.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
                <BookOpen className="mx-auto mb-3 h-7 w-7 text-slate-400" />
                <p className="text-sm font-medium text-slate-800">No active classes assigned</p>
                <p className="mt-1 text-sm text-slate-500">
                  Your assigned classes will appear here once an administrator or authorized academic staff assigns them.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {activeClasses.slice(0, 5).map((classItem) => {
                  const course = firstOf(classItem.courses);
                  const term = firstOf(classItem.academic_terms);
                  const studentCount = enrollments.filter(
                    (item) => item.class_id === classItem.id && item.is_active
                  ).length;
                  const classGrades = grades.filter((item) => item.class_id === classItem.id);
                  const gradedCount = classGrades.filter(
                    (item) => item.final_grade !== null && ["submitted", "approved", "published"].includes(item.status)
                  ).length;

                  return (
                    <article key={classItem.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-sky-200">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            {course?.course_code ?? "Course"} · {classItem.section}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{course?.title ?? "Course title unavailable"}</p>
                          <p className="mt-2 text-xs text-slate-500">
                            {[term?.academic_year, term?.term_name, classItem.room ? `Room ${classItem.room}` : null]
                              .filter(Boolean)
                              .join(" · ") || "Academic details unavailable"}
                          </p>
                          {classItem.schedule_text && (
                            <p className="mt-1 text-xs text-slate-500">{classItem.schedule_text}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                            <Users size={14} /> {studentCount} students
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700">
                            <CheckCircle2 size={14} /> {gradedCount}/{studentCount} grades
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-sky-700" />
                <h2 className="text-lg font-semibold text-slate-900">Grade Progress</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Grade records with a final grade and a submitted, approved, or published status.
              </p>
              <div className="mt-5">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm text-slate-600">Completed grade records</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {gradeProgress.completed} / {gradeProgress.total}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-600 transition-all"
                    style={{
                      width: `${gradeProgress.total ? Math.min(100, (gradeProgress.completed / gradeProgress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Progress compares submitted/approved/published grade records with active enrollments.
                </p>
              </div>
              <Link
                href="/dashboard/faculty/grades"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800"
              >
                Open Grade Management <ArrowRight size={16} />
              </Link>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-sky-700" />
                <h2 className="text-lg font-semibold text-slate-900">Recent Attendance</h2>
              </div>
              {recentAttendance.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No attendance records are available for your assigned classes yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentAttendance.map((item) => {
                    const classItem = classes.find((entry) => entry.id === item.class_id);
                    const course = firstOf(classItem?.courses);
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {course?.course_code ?? "Class"} · {classItem?.section ?? ""}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(item.session_date)}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                          {item.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link
                href="/dashboard/faculty/attendance"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800"
              >
                View attendance <ArrowRight size={16} />
              </Link>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
