
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Users,
  Search,
  RefreshCw,
  GraduationCap,
  Building2,
  BookOpen,
  CheckCircle2,
  XCircle,
  Pencil,
  Power,
  X,
  LoaderCircle,
  ChevronDown,
  Mail,
  CalendarDays,
  ClipboardList,
} from "lucide-react";

type Student = {
  id: string;
  full_name: string;
  institutional_email: string | null;
  department_id: string | null;
  program_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  active_enrollment_count: number;
};

type Department = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

type Program = {
  id: string;
  program_code: string;
  program_name: string;
  department_id: string | null;
  campus_name: string;
  is_active: boolean;
};

type StudentForm = {
  full_name: string;
  institutional_email: string;
  department_id: string;
  program_id: string;
  is_active: boolean;
};

type StatusFilter = "all" | "active" | "inactive";

const EMPTY_FORM: StudentForm = {
  full_name: "",
  institutional_email: "",
  department_id: "",
  program_id: "",
  is_active: true,
};

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/students", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load students.");
      }

      setStudents(result.students ?? []);
      setDepartments(result.departments ?? []);
      setPrograms(result.programs ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load students."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const departmentById = useMemo(
    () => new Map(departments.map((item) => [item.id, item])),
    [departments]
  );

  const programById = useMemo(
    () => new Map(programs.map((item) => [item.id, item])),
    [programs]
  );

  const filteredPrograms = useMemo(
    () =>
      programs.filter(
        (program) =>
          !form.department_id ||
          program.department_id === form.department_id
      ),
    [programs, form.department_id]
  );

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const department = departmentById.get(student.department_id ?? "");
      const program = programById.get(student.program_id ?? "");

      const searchable = [
        student.full_name,
        student.institutional_email,
        department?.code,
        department?.name,
        program?.program_code,
        program?.program_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesDepartment =
        departmentFilter === "all" ||
        student.department_id === departmentFilter;
      const matchesProgram =
        programFilter === "all" || student.program_id === programFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && student.is_active) ||
        (statusFilter === "inactive" && !student.is_active);

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesProgram &&
        matchesStatus
      );
    });
  }, [
    students,
    search,
    departmentFilter,
    programFilter,
    statusFilter,
    departmentById,
    programById,
  ]);

  const activeCount = students.filter((student) => student.is_active).length;
  const inactiveCount = students.length - activeCount;
  const enrolledCount = students.filter(
    (student) => student.active_enrollment_count > 0
  ).length;

  function startEdit(student: Student) {
    setEditingStudent(student);
    setForm({
      full_name: student.full_name,
      institutional_email: student.institutional_email ?? "",
      department_id: student.department_id ?? "",
      program_id: student.program_id ?? "",
      is_active: student.is_active,
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function updateField<K extends keyof StudentForm>(
    field: K,
    value: StudentForm[K]
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingStudent) {
      setError(
        "Creating student accounts is not enabled here yet. Select an existing student to edit their profile."
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/students/${editingStudent.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update student.");
      }

      setNotice("Student profile updated successfully.");
      setFormOpen(false);
      setEditingStudent(null);
      setForm(EMPTY_FORM);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update student."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(student: Student) {
    const action = student.is_active ? "deactivate" : "reactivate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${student.full_name}'s account?`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/students/${student.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !student.is_active }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Unable to ${action} student.`);
      }

      setNotice(
        `Student account ${student.is_active ? "deactivated" : "reactivated"} successfully.`
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Unable to ${action} student.`
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-emerald-700">
              <GraduationCap size={17} />
              <span>Academic Administration</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Student Management
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage student profiles, academic assignments, and account status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <XCircle size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notice"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Students"
            value={students.length}
            detail="Registered student profiles"
            icon={<Users size={21} />}
          />
          <StatCard
            title="Active Students"
            value={activeCount}
            detail="Accounts currently enabled"
            icon={<CheckCircle2 size={21} />}
            tone="green"
          />
          <StatCard
            title="Inactive Students"
            value={inactiveCount}
            detail="Accounts currently disabled"
            icon={<Power size={21} />}
            tone="gray"
          />
          <StatCard
            title="With Enrollments"
            value={enrolledCount}
            detail="Students with active class enrollments"
            icon={<ClipboardList size={21} />}
            tone="blue"
          />
        </div>

        {formOpen && editingStudent && (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Edit Student Profile
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Update profile details without changing the account role or identity.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitForm} className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                Student ID:{" "}
                <span className="break-all font-mono text-xs">
                  {editingStudent.id}
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="student-name">
                    Full Name *
                  </label>
                  <input
                    id="student-name"
                    required
                    maxLength={150}
                    value={form.full_name}
                    onChange={(event) =>
                      updateField("full_name", event.target.value)
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="student-email">
                    Institutional Email
                  </label>
                  <input
                    id="student-email"
                    type="email"
                    maxLength={254}
                    value={form.institutional_email}
                    onChange={(event) =>
                      updateField("institutional_email", event.target.value)
                    }
                    placeholder="student@school.edu"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="student-department">
                    Department
                  </label>
                  <div className="relative">
                    <select
                      id="student-department"
                      value={form.department_id}
                      onChange={(event) => {
                        const departmentId = event.target.value;
                        updateField("department_id", departmentId);

                        if (
                          form.program_id &&
                          programs.find((program) => program.id === form.program_id)
                            ?.department_id !== departmentId
                        ) {
                          updateField("program_id", "");
                        }
                      }}
                      className={`${inputClass} appearance-none pr-10`}
                    >
                      <option value="">No department assigned</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code} — {department.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="student-program">
                    Program
                  </label>
                  <div className="relative">
                    <select
                      id="student-program"
                      value={form.program_id}
                      onChange={(event) =>
                        updateField("program_id", event.target.value)
                      }
                      className={`${inputClass} appearance-none pr-10`}
                    >
                      <option value="">No program assigned</option>
                      {filteredPrograms.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.program_code} — {program.program_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3.5">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    updateField("is_active", event.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 accent-emerald-700"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-800">
                    Active student account
                  </span>
                  <span className="block text-xs text-gray-500">
                    Uncheck to deactivate this student account.
                  </span>
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Student Directory
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredClasses.length} of {students.length} student profiles
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[650px]">
                <div className="relative">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, email, or program..."
                    aria-label="Search students"
                    className={`${inputClass} pl-9`}
                  />
                </div>

                <div className="relative">
                  <select
                    value={departmentFilter}
                    onChange={(event) => {
                      setDepartmentFilter(event.target.value);
                      setProgramFilter("all");
                    }}
                    aria-label="Filter by department"
                    className={`${inputClass} appearance-none pr-9`}
                  >
                    <option value="all">All departments</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code} — {department.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>

                <div className="relative sm:col-span-2">
                  <select
                    value={programFilter}
                    onChange={(event) => setProgramFilter(event.target.value)}
                    aria-label="Filter by program"
                    className={`${inputClass} appearance-none pr-9`}
                  >
                    <option value="all">All programs</option>
                    {programs
                      .filter(
                        (program) =>
                          departmentFilter === "all" ||
                          program.department_id === departmentFilter
                      )
                      .map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.program_code} — {program.program_name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["all", "All Students"],
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                    statusFilter === value
                      ? "bg-emerald-700 text-white"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
              <LoaderCircle size={20} className="animate-spin text-emerald-700" />
              Loading students...
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <Users size={30} className="mb-4 text-emerald-700" />
              <h3 className="font-semibold text-gray-900">
                {students.length === 0
                  ? "No student profiles found"
                  : "No matching students"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {students.length === 0
                  ? "Student profiles will appear here once student accounts exist."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead className="bg-gray-50/80 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Student</th>
                    <th className="px-5 py-4 font-semibold">Department</th>
                    <th className="px-5 py-4 font-semibold">Program</th>
                    <th className="px-5 py-4 font-semibold">Enrollments</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Registered</th>
                    <th className="px-5 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClasses.map((student) => {
                    const department = departmentById.get(
                      student.department_id ?? ""
                    );
                    const program = programById.get(student.program_id ?? "");

                    return (
                      <tr key={student.id} className="transition hover:bg-gray-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-800">
                              {student.full_name
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900">
                                {student.full_name}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                                <Mail size={13} />
                                <span>{student.institutional_email || "No email provided"}</span>
                              </div>
                              <div className="mt-1 max-w-56 truncate font-mono text-[10px] text-gray-400">
                                {student.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          <div className="flex items-start gap-2">
                            <Building2 size={15} className="mt-0.5 shrink-0 text-gray-400" />
                            <span>
                              {department
                                ? `${department.code} — ${department.name}`
                                : "Not assigned"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          <div className="flex items-start gap-2">
                            <BookOpen size={15} className="mt-0.5 shrink-0 text-gray-400" />
                            <span>
                              {program
                                ? `${program.program_code} — ${program.program_name}`
                                : "Not assigned"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">
                            <ClipboardList size={14} />
                            {student.active_enrollment_count}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <StatusPill active={student.is_active} />
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays size={14} className="text-gray-400" />
                            {formatDate(student.created_at)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/students/${student.id}/enrollments`}
                              title={`Manage enrollments for ${student.full_name}`}
                              aria-label={`Manage enrollments for ${student.full_name}`}
                              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                            >
                              <ClipboardList size={15} />
                              Manage Enrollments
                            </Link>

                            <button
                              type="button"
                              onClick={() => startEdit(student)}
                              title="Edit student"
                              aria-label={`Edit ${student.full_name}`}
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleStatus(student)}
                              title={student.is_active ? "Deactivate account" : "Reactivate account"}
                              aria-label={student.is_active ? "Deactivate account" : "Reactivate account"}
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                            >
                              <Power size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  detail,
  icon,
  tone = "emerald",
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone?: "emerald" | "green" | "gray" | "blue";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    green: "bg-green-50 text-green-700",
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 truncate text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-600" : "bg-gray-400"
        }`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}
