"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AttendanceStatus = "present" | "late" | "absent" | "excused" | "";

type FacultyClass = {
  id: string;
  course_id: string;
  term_id: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  is_active: boolean;
  courses: { course_code: string; title: string } | { course_code: string; title: string }[] | null;
  academic_terms: { academic_year: string; term_name: string } | { academic_year: string; term_name: string }[] | null;
};

type Enrollment = {
  id: string;
  class_id: string;
  student_id: string;
};

type StudentProfile = {
  id: string;
  full_name: string;
  institutional_email: string | null;
};

type AttendanceRecord = {
  id: string;
  class_id: string;
  student_id: string;
  recorded_by: string;
  session_date: string;
  status: Exclude<AttendanceStatus, "">;
  notes: string | null;
};

type AttendanceEntry = {
  student: StudentProfile;
  status: AttendanceStatus;
  notes: string;
  existingRecordId: string | null;
};

const STATUS_OPTIONS: {
  value: Exclude<AttendanceStatus, "">;
  label: string;
  activeClass: string;
  dotClass: string;
}[] = [
  {
    value: "present",
    label: "Present",
    activeClass: "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100",
    dotClass: "bg-emerald-500",
  },
  {
    value: "late",
    label: "Late",
    activeClass: "border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-100",
    dotClass: "bg-amber-500",
  },
  {
    value: "absent",
    label: "Absent",
    activeClass: "border-red-300 bg-red-50 text-red-800 ring-2 ring-red-100",
    dotClass: "bg-red-500",
  },
  {
    value: "excused",
    label: "Excused",
    activeClass: "border-sky-300 bg-sky-50 text-sky-800 ring-2 ring-sky-100",
    dotClass: "bg-sky-500",
  },
];

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </article>
  );
}

export default function FacultyAttendancePage() {
  const router = useRouter();
  const [facultyId, setFacultyId] = useState("");
  const [classes, setClasses] = useState<FacultyClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sessionDate, setSessionDate] = useState(localDateValue);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const course = firstOf(selectedClass?.courses);
  const term = firstOf(selectedClass?.academic_terms);

  const loadClasses = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");
    setSuccess("");

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const userId = authData.user.id;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", userId)
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

      const { data, error: classError } = await supabase
        .from("classes")
        .select(
          "id, course_id, term_id, section, room, schedule_text, is_active, courses(course_code, title), academic_terms(academic_year, term_name)"
        )
        .eq("faculty_id", userId)
        .order("created_at", { ascending: false });

      if (classError) throw new Error(classError.message);

      const assignedClasses = (data ?? []) as unknown as FacultyClass[];
      setFacultyId(userId);
      setClasses(assignedClasses);

      const requestedClassId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("classId")
          : null;

      setSelectedClassId((current) => {
        if (current && assignedClasses.some((item) => item.id === current)) return current;
        if (requestedClassId && assignedClasses.some((item) => item.id === requestedClassId)) {
          return requestedClassId;
        }
        return assignedClasses.find((item) => item.is_active)?.id ?? assignedClasses[0]?.id ?? "";
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load your assigned classes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  const loadClassAttendance = useCallback(async () => {
    if (!selectedClassId || !sessionDate || !facultyId) {
      setEntries([]);
      return;
    }

    setStudentsLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();

      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("id, class_id, student_id")
        .eq("class_id", selectedClassId)
        .eq("is_active", true);

      if (enrollmentError) throw new Error(enrollmentError.message);

      const enrollments = (enrollmentData ?? []) as Enrollment[];
      const studentIds = [...new Set(enrollments.map((item) => item.student_id))];

      if (studentIds.length === 0) {
        setEntries([]);
        return;
      }

      const [{ data: profileData, error: profileError }, { data: attendanceData, error: attendanceError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, institutional_email")
            .in("id", studentIds)
            .order("full_name", { ascending: true }),
          supabase
            .from("attendance_records")
            .select("id, class_id, student_id, recorded_by, session_date, status, notes")
            .eq("class_id", selectedClassId)
            .eq("session_date", sessionDate),
        ]);

      if (profileError) throw new Error(profileError.message);
      if (attendanceError) throw new Error(attendanceError.message);

      const profiles = (profileData ?? []) as StudentProfile[];
      const records = (attendanceData ?? []) as AttendanceRecord[];
      const recordByStudent = new Map(records.map((record) => [record.student_id, record]));

      setEntries(
        profiles.map((student) => {
          const record = recordByStudent.get(student.id);
          return {
            student,
            status: record?.status ?? "",
            notes: record?.notes ?? "",
            existingRecordId: record?.id ?? null,
          };
        })
      );
    } catch (caught) {
      setEntries([]);
      setError(
        caught instanceof Error
          ? `Unable to load students or attendance: ${caught.message}`
          : "Unable to load students or attendance."
      );
    } finally {
      setStudentsLoading(false);
    }
  }, [selectedClassId, sessionDate, facultyId]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (facultyId && selectedClassId && sessionDate) {
      void loadClassAttendance();
    } else if (!selectedClassId) {
      setEntries([]);
    }
  }, [facultyId, selectedClassId, sessionDate, loadClassAttendance]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;

    return entries.filter((entry) => {
      const name = entry.student.full_name?.toLowerCase() ?? "";
      const email = entry.student.institutional_email?.toLowerCase() ?? "";
      return name.includes(query) || email.includes(query);
    });
  }, [entries, search]);

  const counts = useMemo(() => {
    const total = entries.length;
    const present = entries.filter((item) => item.status === "present").length;
    const late = entries.filter((item) => item.status === "late").length;
    const absent = entries.filter((item) => item.status === "absent").length;
    const excused = entries.filter((item) => item.status === "excused").length;
    const marked = present + late + absent + excused;

    return { total, present, late, absent, excused, marked, unmarked: total - marked };
  }, [entries]);

  function updateEntry(studentId: string, changes: Partial<Pick<AttendanceEntry, "status" | "notes">>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.student.id === studentId ? { ...entry, ...changes } : entry
      )
    );
    setSuccess("");
  }

  function markAll(status: Exclude<AttendanceStatus, "">) {
    setEntries((current) => current.map((entry) => ({ ...entry, status })));
    setSuccess("");
  }

  async function saveAttendance() {
    if (!selectedClassId || !sessionDate || !facultyId) {
      setError("Select a class and session date before saving attendance.");
      return;
    }

    const markedEntries = entries.filter(
      (entry): entry is AttendanceEntry & { status: Exclude<AttendanceStatus, ""> } =>
        entry.status !== ""
    );
    if (markedEntries.length === 0) {
      setError("Please mark at least one student before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();
      const payload = markedEntries.map((entry) => ({
        class_id: selectedClassId,
        student_id: entry.student.id,
        recorded_by: facultyId,
        session_date: sessionDate,
        status: entry.status,
        notes: entry.notes.trim() || null,
      }));

      const { error: saveError } = await supabase
        .from("attendance_records")
        .upsert(payload, { onConflict: "class_id,student_id,session_date" });

      if (saveError) throw new Error(saveError.message);

      setSuccess(
        `Attendance saved for ${markedEntries.length} of ${entries.length} enrolled students.`
      );
      await loadClassAttendance();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `Unable to save attendance: ${caught.message}`
          : "Unable to save attendance. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-6">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin text-sky-700" />
          Loading your assigned classes...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-7 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-sky-700">Faculty Workspace</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Attendance Management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Record and manage attendance for students enrolled in your assigned classes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadClasses(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </section>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1 break-words">{error}</p>
            <button type="button" onClick={() => setError("")} aria-label="Dismiss error" className="rounded-lg p-1 hover:bg-red-100">
              <XCircle size={17} />
            </button>
          </div>
        )}

        {success && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <Check size={18} className="shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Enrolled students" value={counts.total} description="Active enrollments in this class" icon={Users} iconClass="bg-sky-50 text-sky-700" />
          <StatCard label="Present" value={counts.present} description="Marked present" icon={Check} iconClass="bg-emerald-50 text-emerald-700" />
          <StatCard label="Late" value={counts.late} description="Marked late" icon={Clock3} iconClass="bg-amber-50 text-amber-700" />
          <StatCard label="Absent" value={counts.absent} description="Marked absent" icon={XCircle} iconClass="bg-red-50 text-red-700" />
          <StatCard label="Unmarked" value={counts.unmarked} description="Still needs an attendance status" icon={ClipboardCheck} iconClass="bg-slate-100 text-slate-700" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div>
              <label htmlFor="attendance-class" className="mb-2 block text-sm font-semibold text-slate-700">Assigned class</label>
              <div className="relative">
                <select
                  id="attendance-class"
                  value={selectedClassId}
                  onChange={(event) => {
                    setSelectedClassId(event.target.value);
                    const url = new URL(window.location.href);
                    if (event.target.value) url.searchParams.set("classId", event.target.value);
                    else url.searchParams.delete("classId");
                    window.history.replaceState({}, "", url.toString());
                  }}
                  disabled={classes.length === 0}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
                >
                  {classes.length === 0 && <option value="">No assigned classes</option>}
                  {classes.map((item) => {
                    const itemCourse = firstOf(item.courses);
                    const itemTerm = firstOf(item.academic_terms);
                    return (
                      <option key={item.id} value={item.id}>
                        {itemCourse?.course_code ?? "Course"} · {item.section} · {itemTerm?.term_name ?? "Term"}
                        {!item.is_active ? " (Inactive)" : ""}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              {selectedClass && (
                <p className="mt-2 text-xs text-slate-500">
                  {course?.title ?? "Course title unavailable"}
                  {term ? ` · ${term.academic_year} ${term.term_name}` : ""}
                  {selectedClass.room ? ` · ${selectedClass.room}` : ""}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="attendance-date" className="mb-2 block text-sm font-semibold text-slate-700">Session date</label>
              <div className="relative">
                <CalendarDays size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="attendance-date"
                  type="date"
                  value={sessionDate}
                  onChange={(event) => setSessionDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>
          </div>

          {selectedClass && (
            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {course?.course_code ?? "Class"} · {selectedClass.section}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(sessionDate)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => markAll("present")} disabled={!entries.length || studentsLoading} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50">
                  Mark all present
                </button>
                <button type="button" onClick={() => markAll("absent")} disabled={!entries.length || studentsLoading} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50">
                  Mark all absent
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-semibold text-slate-900">Enrolled students</h2>
              <p className="mt-1 text-sm text-slate-500">
                {counts.marked} marked · {counts.unmarked} unmarked · {counts.total} enrolled
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student name or email"
                aria-label="Search enrolled students"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          {studentsLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle size={19} className="animate-spin text-sky-700" />
              Loading enrolled students and saved attendance...
            </div>
          ) : !selectedClassId ? (
            <div className="px-6 py-16 text-center">
              <Users size={30} className="mx-auto text-slate-300" />
              <h3 className="mt-4 font-semibold text-slate-800">No assigned classes</h3>
              <p className="mt-2 text-sm text-slate-500">Your classes will appear here once an administrator assigns them to your faculty account.</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Users size={30} className="mx-auto text-slate-300" />
              <h3 className="mt-4 font-semibold text-slate-800">No active student enrollments</h3>
              <p className="mt-2 text-sm text-slate-500">There are no active students enrolled in this class for the selected session.</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">No students match your search.</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Attendance status</th>
                      <th className="px-6 py-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.student.id} className="align-top transition hover:bg-slate-50/60">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">
                              {initials(entry.student.full_name || "Student")}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{entry.student.full_name || "Student"}</p>
                              <p className="mt-1 text-xs text-slate-500">{entry.student.institutional_email || "Email unavailable"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={entry.status === option.value}
                                onClick={() => updateEntry(entry.student.id, { status: option.value })}
                                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                  entry.status === option.value
                                    ? option.activeClass
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={entry.notes}
                            onChange={(event) => updateEntry(entry.student.id, { notes: event.target.value })}
                            placeholder="Optional note"
                            className="w-full min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {filteredEntries.map((entry) => (
                  <article key={entry.student.id} className="space-y-4 p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">
                        {initials(entry.student.full_name || "Student")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{entry.student.full_name || "Student"}</p>
                        <p className="truncate text-xs text-slate-500">{entry.student.institutional_email || "Email unavailable"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance status</p>
                      <div className="grid grid-cols-2 gap-2">
                        {STATUS_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={entry.status === option.value}
                            onClick={() => updateEntry(entry.student.id, { status: option.value })}
                            className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                              entry.status === option.value
                                ? option.activeClass
                                : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`note-${entry.student.id}`} className="mb-2 block text-xs font-semibold text-slate-500">Notes</label>
                      <input
                        id={`note-${entry.student.id}`}
                        type="text"
                        value={entry.notes}
                        onChange={(event) => updateEntry(entry.student.id, { notes: event.target.value })}
                        placeholder="Optional note"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-5 text-slate-500">
              Only marked students are saved. Existing records for the selected class and date are updated instead of duplicated.
            </p>
            <button
              type="button"
              onClick={() => void saveAttendance()}
              disabled={saving || studentsLoading || entries.length === 0 || counts.marked === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
              {saving ? "Saving attendance..." : "Save attendance"}
            </button>
          </div>
        </section>

        <p className="text-xs leading-5 text-slate-400">
          Attendance access is restricted by your signed-in faculty account and the class-level Supabase security policies.
        </p>
      </div>
    </main>
  );
}
