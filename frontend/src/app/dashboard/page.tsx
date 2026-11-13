"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string;
  role: string;
  department_id: string | null;
};

type CourseRecord = {
  course_code: string;
  title: string;
};

type ClassRecord = {
  id: string;
  section: string;
  courses: CourseRecord | CourseRecord[] | null;
  academic_terms: { academic_year: string; term_name: string } | { academic_year: string; term_name: string }[] | null;
};

type EnrollmentRecord = {
  id: string;
  class_id: string;
  classes: ClassRecord | ClassRecord[] | null;
};

type GradeRecord = {
  id: string;
  class_id: string;
  term_id: string;
  final_grade: number | null;
  status: string;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  class_id: string;
  session_date: string;
  status: string;
};

type ChartPoint = {
  label: string;
  grade: number;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatGrade(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof BookOpen;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <Icon size={21} />
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">
      <BookOpen className="mb-3 text-slate-400" size={24} />
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        .select("full_name, role, department_id, is_active")
        .eq("id", userId)
        .single();

      if (profileError || !profileData || !profileData.is_active) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const roleDestinations: Record<string, string> = {
      administrator: "/dashboard/admin",
      faculty: "/dashboard/faculty",
      dean: "/dashboard/dean",
      registrar: "/dashboard/registrar",
      guidance: "/dashboard/guidance",
    };

    if (profileData.role !== "student") {
      const destination = roleDestinations[profileData.role];

      if (!destination) {
        setError("Your account role does not have a configured dashboard.");
        return;
      }

      router.replace(destination);
      return;
    }

      const [enrollmentResult, gradeResult, attendanceResult] = await Promise.all([
        supabase
          .from("enrollments")
          .select("id, class_id, classes(id, section, courses(course_code, title), academic_terms(academic_year, term_name))")
          .eq("student_id", userId)
          .eq("is_active", true),
        supabase
          .from("grades")
          .select("id, class_id, term_id, final_grade, status, created_at")
          .eq("student_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("attendance_records")
          .select("id, class_id, session_date, status")
          .eq("student_id", userId)
          .order("session_date", { ascending: false }),
      ]);

      if (enrollmentResult.error) throw new Error("Unable to load your enrolled courses.");
      if (gradeResult.error) throw new Error("Unable to load your grade records.");
      if (attendanceResult.error) throw new Error("Unable to load your attendance records.");

      setProfile({
        full_name: profileData.full_name,
        role: profileData.role,
        department_id: profileData.department_id,
      });
      setEnrollments((enrollmentResult.data ?? []) as unknown as EnrollmentRecord[]);
      setGrades((gradeResult.data ?? []) as GradeRecord[]);
      setAttendance((attendanceResult.data ?? []) as AttendanceRecord[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const publishedGrades = useMemo(
    () => grades.filter((grade) => grade.final_grade !== null && ["approved", "published"].includes(grade.status)),
    [grades],
  );

  const averageGrade = useMemo(() => {
    if (!publishedGrades.length) return null;
    return publishedGrades.reduce((sum, grade) => sum + Number(grade.final_grade), 0) / publishedGrades.length;
  }, [publishedGrades]);

  const attendanceRate = useMemo(() => {
    if (!attendance.length) return null;
    const counted = attendance.filter((item) => ["present", "late", "absent", "excused"].includes(item.status));
    if (!counted.length) return null;
    const attended = counted.filter((item) => ["present", "late", "excused"].includes(item.status)).length;
    return (attended / counted.length) * 100;
  }, [attendance]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return [...publishedGrades]
      .reverse()
      .map((grade, index) => ({
        label: `Record ${index + 1}`,
        grade: Number(grade.final_grade),
      }));
  }, [publishedGrades]);

  const courseByClass = useMemo(() => {
    const map = new Map<string, string>();
    enrollments.forEach((enrollment) => {
      const classRecord = firstOf(enrollment.classes);
      const course = firstOf(classRecord?.courses);
      if (classRecord && course) map.set(classRecord.id, `${course.course_code} · ${classRecord.section}`);
    });
    return map;
  }, [enrollments]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  
const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, active: true },
  { label: "My Courses", href: "/dashboard/courses", icon: BookOpen, active: false },
  { label: "Programs", href: "/dashboard/programs", icon: GraduationCap, active: false },
  { label: "Grade History", href: "/dashboard/grades", icon: ChartNoAxesCombined, active: false },
  { label: "Attendance", href: "/dashboard/attendance", icon: CalendarDays, active: false },
  { label: "Account Settings", href: "/dashboard/settings", icon: Settings, active: false },
];


  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <BookOpen size={24} />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-800">Loading your academic dashboard</p>
          <p className="mt-1 text-xs text-slate-500">Retrieving your SmartGrade records.</p>
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

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-700 text-white">
            <BookOpen size={23} />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">SmartGrade</p>
            <p className="text-xs text-slate-500">Samar State University</p>
          </div>
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Student workspace</p>
          <nav className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${item.active ? "bg-sky-50 text-sky-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                <item.icon size={18} />
                {item.label}
                {item.active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-600" />}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
                {initials(profile?.full_name || "Student")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{profile?.full_name || "Student"}</p>
                <p className="mt-0.5 text-xs capitalize text-slate-500">{profile?.role || "student"}</p>
              </div>
            </div>
            <button type="button" onClick={handleSignOut} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation menu">
              <Menu size={21} />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-900">Student Overview</p>
              <p className="mt-0.5 text-xs text-slate-500">Your academic progress at a glance</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => void loadDashboard(true)} disabled={refreshing} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" aria-label="Notifications" className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50">
              <Bell size={18} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
          {error && (
            <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
              <p>{error}</p>
              <button type="button" onClick={() => void loadDashboard(true)} className="font-semibold underline underline-offset-4">Try again</button>
            </div>
          )}

          {profile?.role !== "student" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <ShieldCheck className="text-sky-700" size={28} />
              <h1 className="mt-4 text-2xl font-semibold">Your workspace is being prepared</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Your account role is <span className="font-medium capitalize text-slate-700">{profile?.role}</span>. This page currently contains the student workspace. Your role-specific dashboard will be implemented separately.
              </p>
            </section>
          ) : (
            <>
              <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold text-sky-700">ACADEMIC OVERVIEW</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    Welcome back, {profile.full_name.split(" ")[0]}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                    Review your course enrollment, published grades, and attendance records in one place.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 sm:self-auto">
                  <ShieldCheck size={17} className="text-sky-700" />
                  Personal academic records
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Enrolled classes" value={String(enrollments.length)} description="Active class enrollments" icon={BookOpen} />
                <StatCard title="Published grades" value={String(publishedGrades.length)} description="Approved or published grade records" icon={GraduationCap} />
                <StatCard title="Grade average" value={averageGrade === null ? "—" : formatGrade(averageGrade)} description={averageGrade === null ? "No published grades available yet" : "Average of available published grades"} icon={ChartNoAxesCombined} />
                <StatCard title="Attendance rate" value={attendanceRate === null ? "—" : `${formatGrade(attendanceRate)}%`} description={attendanceRate === null ? "No attendance records available yet" : `${attendance.length} recorded class sessions`} icon={CalendarDays} />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-slate-900">Grade performance</h2>
                      <p className="mt-1 text-sm text-slate-500">Published grades over your available records</p>
                    </div>
                    <div className="rounded-lg bg-sky-50 p-2 text-sky-700">
                      <Activity size={19} />
                    </div>
                  </div>
                  {chartData.length > 1 ? (
                    <div className="mt-6 h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                          <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0", fontSize: 12 }} formatter={(value) => [`${value ?? "—"}`, "Grade"]} />
                          <Line type="monotone" dataKey="grade" stroke="#0284C7" strokeWidth={3} dot={{ r: 4, fill: "#0284C7", strokeWidth: 2, stroke: "#FFFFFF" }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <EmptyState title="Not enough grade history yet" description="Your chart will appear after at least two grades have been approved or published by your faculty." />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-slate-900">Attendance summary</h2>
                      <p className="mt-1 text-sm text-slate-500">Based on recorded class sessions</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                      <Clock3 size={19} />
                    </div>
                  </div>
                  {attendanceRate === null ? (
                    <div className="mt-6">
                      <EmptyState title="No attendance data yet" description="Attendance information will appear when your faculty records class sessions." />
                    </div>
                  ) : (
                    <div className="mt-7">
                      <div className="flex items-end justify-between">
                        <p className="text-4xl font-semibold tracking-tight">{formatGrade(attendanceRate)}%</p>
                        <p className="text-xs text-slate-500">{attendance.length} sessions</p>
                      </div>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${Math.min(100, attendanceRate)}%` }} />
                      </div>
                      <div className="mt-5 space-y-3">
                        {[
                          { label: "Present", count: attendance.filter((item) => item.status === "present").length },
                          { label: "Late", count: attendance.filter((item) => item.status === "late").length },
                          { label: "Absent", count: attendance.filter((item) => item.status === "absent").length },
                          { label: "Excused", count: attendance.filter((item) => item.status === "excused").length },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">{item.label}</span>
                            <span className="font-medium text-slate-800">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-900">My courses</h2>
                      <p className="mt-1 text-sm text-slate-500">Your current active enrollments</p>
                    </div>
                    <Link href="/dashboard/courses" className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800">
                      View all <ArrowRight size={15} />
                    </Link>
                  </div>
                  <div className="mt-5 space-y-3">
                    {enrollments.length === 0 ? (
                      <EmptyState title="No active enrollments" description="Your enrolled classes will appear here once the registrar or authorized staff enrolls you in a class." />
                    ) : (
                      enrollments.slice(0, 5).map((enrollment) => {
                        const classRecord = firstOf(enrollment.classes);
                        const course = firstOf(classRecord?.courses);
                        const term = firstOf(classRecord?.academic_terms);
                        return (
                          <div key={enrollment.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-sky-100 hover:bg-slate-50">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                              <BookOpen size={19} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{course?.title ?? "Course information unavailable"}</p>
                              <p className="mt-1 text-xs text-slate-500">{course?.course_code ?? "No course code"}{classRecord?.section ? ` · Section ${classRecord.section}` : ""}</p>
                              {term && <p className="mt-1 text-xs text-slate-400">{term.academic_year} · {term.term_name}</p>}
                            </div>
                            <CheckCircle2 size={17} className="mt-1 shrink-0 text-emerald-600" />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div>
                    <h2 className="font-semibold text-slate-900">Recent grade records</h2>
                    <p className="mt-1 text-sm text-slate-500">Grades released by your faculty</p>
                  </div>
                  <div className="mt-5">
                    {publishedGrades.length === 0 ? (
                      <EmptyState title="No published grades yet" description="Approved or published grades will appear here when they are available." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-500">
                              <th className="pb-3 pr-3 font-medium">Class</th>
                              <th className="pb-3 pr-3 font-medium">Date</th>
                              <th className="pb-3 text-right font-medium">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {publishedGrades.slice(0, 5).map((grade) => (
                              <tr key={grade.id} className="border-b border-slate-50 last:border-0">
                                <td className="py-3 pr-3 text-sm font-medium text-slate-800">{courseByClass.get(grade.class_id) ?? "Class record"}</td>
                                <td className="py-3 pr-3 text-xs text-slate-500">{new Date(grade.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                                <td className="py-3 text-right text-sm font-semibold text-slate-900">{formatGrade(grade.final_grade)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <Link href="/dashboard/grades" className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-800">
                      Open grade history <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </section>

              <footer className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <p>SmartGrade · Samar State University</p>
                <p className="inline-flex items-center gap-1.5"><UserRound size={13} /> Personal academic workspace</p>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
