"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, BookOpen, CalendarDays, CheckCircle2, CircleAlert,
  ClipboardList, LoaderCircle, MapPin, Power, RefreshCw, UserRound,
} from "lucide-react";

type Student = {
  id: string;
  full_name: string;
  institutional_email: string | null;
  department_name: string | null;
  program_name: string | null;
  is_active: boolean;
};
type Enrollment = {
  id: string;
  class_id: string;
  student_id: string;
  enrolled_at: string;
  is_active: boolean;
  course_code: string;
  course_title: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  term_name: string;
  academic_year: string;
  faculty_name: string;
};
type AvailableClass = {
  id: string;
  course_code: string;
  course_title: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  term_name: string;
  academic_year: string;
  faculty_name: string;
};

const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function StudentEnrollmentsPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/students/${studentId}/enrollments`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load enrollments.");
      setStudent(result.student);
      setEnrollments(result.enrollments ?? []);
      setAvailableClasses(result.availableClasses ?? []);
      setSelectedClassId((current) =>
        current && (result.availableClasses ?? []).some((item: AvailableClass) => item.id === current)
          ? current
          : (result.availableClasses?.[0]?.id ?? "")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load enrollments.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function assignClass() {
    if (!selectedClassId) {
      setError("Please select an available class first.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/students/${studentId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: selectedClassId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to assign class.");
      setNotice(result.message || "Student enrolled successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign class.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnrollment(enrollment: Enrollment) {
    const nextActive = !enrollment.is_active;
    const action = nextActive ? "reactivate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${enrollment.course_code} — Section ${enrollment.section}?`)) return;

    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/enrollments/${enrollment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: nextActive }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Unable to ${action} enrollment.`);
      setNotice(result.message || `Enrollment ${nextActive ? "reactivated" : "deactivated"} successfully.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update enrollment.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = enrollments.filter((item) => item.is_active).length;

  return (
    <main className="min-h-screen bg-gray-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/dashboard/students"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-900"
        >
          <ArrowLeft size={16} /> Back to Student Management
        </Link>

        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-emerald-700">
              <ClipboardList size={17} /> Academic Administration
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Manage Enrollments
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Assign classes and manage this student&apos;s enrollment records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </header>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert size={18} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" /><span>{notice}</span>
          </div>
        )}

        {loading && !student ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
            <LoaderCircle size={20} className="animate-spin text-emerald-700" /> Loading student...
          </div>
        ) : student ? (
          <>
            <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <UserRound size={23} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900">{student.full_name}</h2>
                    <p className="mt-1 break-all text-sm text-gray-500">{student.institutional_email || "No institutional email"}</p>
                    <p className="mt-2 text-sm text-gray-600">{student.program_name || "Program not assigned"}</p>
                    <p className="text-sm text-gray-500">{student.department_name || "Department not assigned"}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-gray-500">Active enrollments</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{activeCount}</p>
                <p className="mt-2 text-xs text-gray-500">{enrollments.length} total enrollment records, including inactive records</p>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Assign a Class</h2>
                <p className="mt-1 text-sm text-gray-500">Choose an active class offering to enroll this student.</p>
              </div>
              {availableClasses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">
                  No available active classes. All active classes may already be assigned to this student, or no active class offerings exist.
                </div>
              ) : (
                <div className="flex flex-col gap-3 md:flex-row">
                  <select
                    aria-label="Select class to assign"
                    className={inputClass}
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                  >
                    {availableClasses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.course_code} — {item.course_title} | Section {item.section} | {item.academic_year} {item.term_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void assignClass()}
                    disabled={saving || !selectedClassId || !student.is_active}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? <LoaderCircle size={17} className="animate-spin" /> : <BookOpen size={17} />}
                    Assign Class
                  </button>
                </div>
              )}
              {!student.is_active && (
                <p className="mt-3 text-sm text-amber-700">This student account is inactive. Reactivate the student before assigning new classes.</p>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900">Enrollment Directory</h2>
                <p className="mt-1 text-sm text-gray-500">{enrollments.length} enrollment record(s)</p>
              </div>
              {enrollments.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                  <ClipboardList size={30} className="mb-3 text-emerald-700" />
                  <h3 className="font-semibold text-gray-900">No enrollments yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Select an active class above to create the first enrollment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Course / Section</th>
                        <th className="px-5 py-4 font-semibold">Academic Term</th>
                        <th className="px-5 py-4 font-semibold">Faculty</th>
                        <th className="px-5 py-4 font-semibold">Schedule / Room</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Enrolled On</th>
                        <th className="px-5 py-4 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {enrollments.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/70">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-gray-900">{item.course_code}</p>
                            <p className="mt-1 text-sm text-gray-600">{item.course_title}</p>
                            <p className="mt-1 text-xs text-gray-500">Section {item.section}</p>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            <p className="font-medium">{item.academic_year}</p>
                            <p className="mt-1">{item.term_name}</p>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">{item.faculty_name || "Not assigned"}</td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            <p className="flex items-start gap-1.5"><CalendarDays size={14} className="mt-0.5 shrink-0" />{item.schedule_text || "No schedule"}</p>
                            <p className="mt-1 flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0" />{item.room || "No room"}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${item.is_active ? "bg-emerald-600" : "bg-gray-400"}`} />
                              {item.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">{formatDate(item.enrolled_at)}</td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => void toggleEnrollment(item)}
                              disabled={saving}
                              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Power size={14} /> {item.is_active ? "Deactivate" : "Reactivate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <h2 className="font-semibold text-gray-900">Student not found</h2>
            <p className="mt-1 text-sm text-gray-500">The student ID may be invalid, or this profile is not a student account.</p>
          </div>
        )}
      </div>
    </main>
  );
}
