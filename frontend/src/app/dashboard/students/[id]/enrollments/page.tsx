
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  RefreshCw,
  UserRound,
  MapPin,
  Clock,
  Plus,
  Power,
  Users,
  AlertCircle,
} from "lucide-react";

type Student = {
  id: string;
  full_name: string;
  institutional_email: string | null;
  is_active: boolean;
};

type Enrollment = {
  id: string;
  class_id: string;
  student_id: string;
  is_active: boolean;
  enrolled_at: string;
  class?: {
    id: string;
    section: string;
    room: string | null;
    schedule_text: string | null;
    is_active: boolean;
    course?: {
      course_code: string;
      title: string;
      units: number;
    } | null;
    term?: {
      academic_year: string;
      term_name: string;
      status: string;
    } | null;
    faculty?: {
      full_name: string;
    } | null;
  } | null;
};

type AvailableClass = {
  id: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  course?: {
    course_code: string;
    title: string;
    units: number;
  } | null;
  term?: {
    academic_year: string;
    term_name: string;
    status: string;
  } | null;
  faculty?: {
    full_name: string;
  } | null;
};

type ApiData = {
  student?: Student;
  enrollments?: Enrollment[];
  availableClasses?: AvailableClass[];
  error?: string;
  message?: string;
};

const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function StudentEnrollmentsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const studentId = params.id;

  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>(
    []
  );
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/enrollments`,
        { cache: "no-store" }
      );

      const data: ApiData = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load student enrollments.");
      }

      setStudent(data.student ?? null);
      setEnrollments(data.enrollments ?? []);
      setAvailableClasses(data.availableClasses ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );  
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) void loadData();
  }, [studentId, loadData]);

  async function assignClass() {
    if (!selectedClassId) {
      setError("Please select a class first.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/enrollments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ class_id: selectedClassId }),
        }
      );

      const data: ApiData = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to assign this class.");
      }

      setSuccess(data.message || "Class assigned successfully.");
      setSelectedClassId("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to assign class."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeEnrollmentStatus(enrollment: Enrollment) {
    const nextStatus = !enrollment.is_active;
    const confirmed = window.confirm(
      nextStatus
        ? "Reactivate this student's enrollment?"
        : "Deactivate this student's enrollment?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/enrollments/${enrollment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: nextStatus }),
        }
      );

      const data: ApiData = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update enrollment.");
      }

      setSuccess(
        data.message ||
          `Enrollment ${nextStatus ? "reactivated" : "deactivated"} successfully.`
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update enrollment."
      );
    }
  }

  const activeCount = enrollments.filter((item) => item.is_active).length;
  const inactiveCount = enrollments.length - activeCount;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-6xl animate-pulse rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-4 h-7 w-64 rounded bg-slate-200" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-100" />
          <div className="mt-8 h-40 rounded-xl bg-slate-100" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/admin/students")}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700"
        >
          <ArrowLeft size={17} />
          Back to Student Management
        </button>

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-sm font-medium text-emerald-700">
              Academic Administration
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Manage Enrollments
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Assign classes and manage this student&apos;s enrollment status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {success}
          </div>
        )}

        {student ? (
          <section className={cardClass}>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <UserRound size={26} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-slate-900">
                  {student.full_name}
                </h2>
                <p className="break-all text-sm text-slate-500">
                  {student.institutional_email || "No email recorded"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Student ID: {student.id}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  student.is_active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {student.is_active ? "Active account" : "Inactive account"}
              </span>
            </div>
          </section>
        ) : (
          <section className={cardClass}>
            <p className="font-medium text-slate-800">
              Student information was not returned by the API.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Check the enrollment API response and verify that the student ID exists.
            </p>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className={cardClass}>
            <p className="text-sm text-slate-500">Total enrollments</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {enrollments.length}
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-sm text-slate-500">Active enrollments</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {activeCount}
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-sm text-slate-500">Inactive enrollments</p>
            <p className="mt-2 text-3xl font-bold text-slate-500">
              {inactiveCount}
            </p>
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Assign a class
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose an available class offering for this student.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Select a class...</option>
              {availableClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.course?.course_code || "Course"} —{" "}
                  {item.course?.title || "Untitled course"} | Section{" "}
                  {item.section} | {item.term?.term_name || "No term"} (
                  {item.term?.academic_year || "No academic year"})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void assignClass()}
              disabled={saving || !selectedClassId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} />
              {saving ? "Assigning..." : "Assign Class"}
            </button>
          </div>

          {availableClasses.length === 0 && (
            <p className="mt-3 text-sm text-amber-700">
              No available classes were returned. Check that active class offerings exist and that the API returns the classes array.
            </p>
          )}
        </section>

        <section className={`${cardClass} overflow-hidden`}>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Enrollment directory
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {enrollments.length} recorded enrollment
              {enrollments.length === 1 ? "" : "s"}
            </p>
          </div>

          {enrollments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-5 py-12 text-center">
              <BookOpen className="mx-auto text-emerald-700" size={32} />
              <h3 className="mt-3 font-semibold text-slate-900">
                No enrollments yet
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Select a class above to create the first enrollment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {enrollments.map((enrollment) => {
                const classInfo = enrollment.class;

                return (
                  <article
                    key={enrollment.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                          <BookOpen size={21} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900">
                            {classInfo?.course?.course_code || "Course"} —{" "}
                            {classInfo?.course?.title || "Class details unavailable"}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Section {classInfo?.section || "—"}
                            {classInfo?.course?.units != null
                              ? ` · ${classInfo.course.units} units`
                              : ""}
                          </p>

                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            <p className="flex items-center gap-2">
                              <CalendarDays size={15} className="shrink-0" />
                              {classInfo?.term?.academic_year || "No academic year"}
                              {" · "}
                              {classInfo?.term?.term_name || "No term"}
                            </p>
                            <p className="flex items-center gap-2">
                              <Users size={15} className="shrink-0" />
                              {classInfo?.faculty?.full_name || "Faculty not assigned"}
                            </p>
                            <p className="flex items-center gap-2">
                              <Clock size={15} className="shrink-0" />
                              {classInfo?.schedule_text || "No schedule recorded"}
                            </p>
                            <p className="flex items-center gap-2">
                              <MapPin size={15} className="shrink-0" />
                              {classInfo?.room || "No room assigned"}
                            </p>
                          </div>

                          <p className="mt-3 text-xs text-slate-400">
                            Enrolled{" "}
                            {new Date(enrollment.enrolled_at).toLocaleDateString(
                              "en-PH",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            enrollment.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {enrollment.is_active ? "Active" : "Inactive"}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            void changeEnrollmentStatus(enrollment)
                          }
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                            enrollment.is_active
                              ? "border-red-200 text-red-700 hover:bg-red-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          <Power size={15} />
                          {enrollment.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
