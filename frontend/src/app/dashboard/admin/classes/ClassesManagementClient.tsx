"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  BookOpen, 
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

type ClassRecord = {
  id: string;
  course_id: string;
  term_id: string;
  faculty_id: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Course = {
  id: string;
  course_code: string;
  title: string;
  department_id: string;
  is_active: boolean;
};

type AcademicTerm = {
  id: string;
  academic_year: string;
  term_name: string;
  starts_on: string;
  ends_on: string;
  status: "planned" | "active" | "completed" | "archived";
};

type Faculty = {
  id: string;
  full_name: string;
  institutional_email: string | null;
  department_id: string | null;
};

type ClassForm = {
  course_id: string;
  term_id: string;
  faculty_id: string;
  section: string;
  room: string;
  schedule_text: string;
  is_active: boolean;
};

const EMPTY_FORM: ClassForm = {
  course_id: "",
  term_id: "",
  faculty_id: "",
  section: "",
  room: "",
  schedule_text: "",
  is_active: true,
};

type FilterStatus = "all" | "active" | "inactive";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-100";

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function termLabel(term: AcademicTerm) {
  return `${term.academic_year} · ${term.term_name}`;
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [termFilter, setTermFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/classes", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load classes.");
      }

      setClasses(result.classes ?? []);
      setCourses(result.courses ?? []);
      setTerms(result.terms ?? []);
      setFaculty(result.faculty ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load classes."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses]
  );

  const termById = useMemo(
    () => new Map(terms.map((term) => [term.id, term])),
    [terms]
  );

  const facultyById = useMemo(
    () => new Map(faculty.map((person) => [person.id, person])),
    [faculty]
  );

  const activeTerm = terms.find((term) => term.status === "active");

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return classes.filter((item) => {
      const course = courseById.get(item.course_id);
      const term = termById.get(item.term_id);
      const instructor = facultyById.get(item.faculty_id);

      const searchable = [
        course?.course_code,
        course?.title,
        term?.academic_year,
        term?.term_name,
        instructor?.full_name,
        item.section,
        item.room,
        item.schedule_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesTerm =
        termFilter === "all" || item.term_id === termFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "inactive" && !item.is_active);

      return matchesSearch && matchesTerm && matchesStatus;
    });
  }, [
    classes,
    search,
    termFilter,
    statusFilter,
    courseById,
    termById,
    facultyById,
  ]);

  const activeCount = classes.filter((item) => item.is_active).length;
  const inactiveCount = classes.length - activeCount;

  function startCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      term_id: activeTerm?.id ?? "",
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(item: ClassRecord) {
    setEditingId(item.id);
    setForm({
      course_id: item.course_id,
      term_id: item.term_id,
      faculty_id: item.faculty_id,
      section: item.section,
      room: item.room ?? "",
      schedule_text: item.schedule_text ?? "",
      is_active: item.is_active,
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function updateField<K extends keyof ClassForm>(
    key: K,
    value: ClassForm[K]
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const endpoint = editingId
        ? `/api/admin/classes/${editingId}`
        : "/api/admin/classes";

      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save the class.");
      }

      setNotice(
        editingId
          ? "Class updated successfully."
          : "Class created successfully."
      );
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save the class."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: ClassRecord) {
    const action = item.is_active ? "deactivate" : "activate";

    if (!window.confirm(`Are you sure you want to ${action} this class?`)) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/classes/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !item.is_active }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Unable to ${action} class.`);
      }

      setNotice(`Class ${action}d successfully.`);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Unable to ${action} class.`
      );
    }
  }

  const hasAssignmentOptions =
    courses.length > 0 && terms.length > 0 && faculty.length > 0;

  return (
    <div className="min-h-screen bg-gray-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-emerald-700">
              <BookOpen size={16} />
              <span>Academic Administration</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Classes Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage course offerings, faculty assignments, sections, and
              classroom schedules.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              <Plus size={17} />
              Create Class
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <X size={18} className="mt-0.5 shrink-0" />
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
            <Check size={18} className="mt-0.5 shrink-0" />
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
            title="Total Classes"
            value={classes.length}
            description="All recorded class offerings"
            icon={<BookOpen size={20} />}
          />
          <StatCard
            title="Active Classes"
            value={activeCount}
            description="Currently enabled"
            icon={<Check size={20} />}
            accent="emerald"
          />
          <StatCard
            title="Inactive Classes"
            value={inactiveCount}
            description="Currently disabled"
            icon={<Power size={20} />}
            accent="gray"
          />
          <StatCard
            title="Active Term"
            value={activeTerm ? "Available" : "None"}
            description={
              activeTerm ? termLabel(activeTerm) : "No active academic term"
            }
            icon={<CalendarDays size={20} />}
            accent="blue"
            compact
          />
        </div>

        {formOpen && (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Class" : "Create Class"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Assign a course, academic term, faculty member, and section.
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
              {!hasAssignmentOptions && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Some assignment options are unavailable. You need at least
                  one active course, one non-archived academic term, and one
                  active faculty profile to create a class.
                  <div className="mt-2 text-xs">
                    Courses: {courses.length} · Terms: {terms.length} ·
                    Faculty: {faculty.length}
                  </div>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="class-course">
                    Course <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="class-course"
                      required
                      value={form.course_id}
                      onChange={(event) =>
                        updateField("course_id", event.target.value)
                      }
                      className={`${inputClass} appearance-none pr-10`}
                    >
                      <option value="">Select a course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.course_code} — {course.title}
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
                  <label className={labelClass} htmlFor="class-term">
                    Academic Term <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="class-term"
                      required
                      value={form.term_id}
                      onChange={(event) =>
                        updateField("term_id", event.target.value)
                      }
                      className={`${inputClass} appearance-none pr-10`}
                    >
                      <option value="">Select an academic term</option>
                      {terms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {termLabel(term)} · {term.status}
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
                  <label className={labelClass} htmlFor="class-faculty">
                    Faculty Member <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="class-faculty"
                      required
                      value={form.faculty_id}
                      onChange={(event) =>
                        updateField("faculty_id", event.target.value)
                      }
                      className={`${inputClass} appearance-none pr-10`}
                    >
                      <option value="">Select faculty</option>
                      {faculty.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.full_name}
                          {person.institutional_email
                            ? ` · ${person.institutional_email}`
                            : ""}
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
                  <label className={labelClass} htmlFor="class-section">
                    Section <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="class-section"
                    required
                    maxLength={50}
                    value={form.section}
                    onChange={(event) =>
                      updateField("section", event.target.value)
                    }
                    placeholder="e.g. BSIT-2A"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="class-room">
                    Room
                  </label>
                  <input
                    id="class-room"
                    maxLength={100}
                    value={form.room}
                    onChange={(event) =>
                      updateField("room", event.target.value)
                    }
                    placeholder="e.g. Room 204"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="class-schedule">
                    Schedule
                  </label>
                  <input
                    id="class-schedule"
                    maxLength={250}
                    value={form.schedule_text}
                    onChange={(event) =>
                      updateField("schedule_text", event.target.value)
                    }
                    placeholder="e.g. Mon/Wed, 9:00–10:30 AM"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Enter a readable schedule. Automatic conflict detection
                    requires structured schedule data.
                  </p>
                </div>

                {editingId && (
                  <div className="md:col-span-2">
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
                          Active class
                        </span>
                        <span className="block text-xs text-gray-500">
                          Allow this class offering to remain enabled.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !hasAssignmentOptions}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Check size={17} />
                  )}
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Class"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Class Directory
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredClasses.length} of {classes.length} class offerings
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[560px]">
                <div className="relative">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search course, faculty, section..."
                    aria-label="Search classes"
                    className={`${inputClass} pl-9`}
                  />
                </div>

                <div className="relative">
                  <select
                    value={termFilter}
                    onChange={(event) => setTermFilter(event.target.value)}
                    aria-label="Filter by academic term"
                    className={`${inputClass} appearance-none pr-9`}
                  >
                    <option value="all">All academic terms</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {termLabel(term)}
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
                  ["all", "All Classes"],
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
              <LoaderCircle
                size={20}
                className="animate-spin text-emerald-700"
              />
              Loading classes...
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <BookOpen size={26} />
              </div>
              <h3 className="font-semibold text-gray-900">
                {classes.length === 0
                  ? "No classes created yet"
                  : "No matching classes"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {classes.length === 0
                  ? "Create your first class by assigning a course, academic term, faculty member, and section."
                  : "Try changing your search or filters."}
              </p>
              {classes.length === 0 && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  <Plus size={17} />
                  Create First Class
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1050px] text-left">
                  <thead className="bg-gray-50/80 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Course / Section</th>
                      <th className="px-5 py-4 font-semibold">Academic Term</th>
                      <th className="px-5 py-4 font-semibold">Faculty</th>
                      <th className="px-5 py-4 font-semibold">Schedule / Room</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredClasses.map((item) => {
                      const course = courseById.get(item.course_id);
                      const term = termById.get(item.term_id);
                      const instructor = facultyById.get(item.faculty_id);

                      return (
                        <tr key={item.id} className="transition hover:bg-gray-50/70">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-gray-900">
                              {course?.course_code ?? "Unknown course"}
                            </div>
                            <div className="mt-1 max-w-64 text-sm text-gray-500">
                              {course?.title ?? "Course unavailable"}
                            </div>
                            <div className="mt-2 inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                              Section {item.section}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-medium text-gray-800">
                              {term?.academic_year ?? "Unknown year"}
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              {term?.term_name ?? "Term unavailable"}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-start gap-2">
                              <Users size={16} className="mt-0.5 shrink-0 text-gray-400" />
                              <div>
                                <div className="text-sm font-medium text-gray-800">
                                  {instructor?.full_name ?? "Faculty unavailable"}
                                </div>
                                {instructor?.institutional_email && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    {instructor.institutional_email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-start gap-2 text-sm text-gray-700">
                              <Clock size={15} className="mt-0.5 shrink-0 text-gray-400" />
                              <span>{item.schedule_text || "No schedule set"}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                              <MapPin size={14} />
                              {item.room || "No room assigned"}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <StatusPill active={item.is_active} />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                title="Edit class"
                                aria-label={`Edit ${course?.course_code ?? "class"} ${item.section}`}
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleStatus(item)}
                                title={item.is_active ? "Deactivate class" : "Activate class"}
                                aria-label={item.is_active ? "Deactivate class" : "Activate class"}
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

              <div className="divide-y divide-gray-100 md:hidden">
                {filteredClasses.map((item) => {
                  const course = courseById.get(item.course_id);
                  const term = termById.get(item.term_id);
                  const instructor = facultyById.get(item.faculty_id);

                  return (
                    <article key={item.id} className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {course?.course_code ?? "Unknown course"} · {item.section}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {course?.title ?? "Course unavailable"}
                          </p>
                        </div>
                        <StatusPill active={item.is_active} />
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p className="flex gap-2">
                          <CalendarDays size={16} className="shrink-0 text-gray-400" />
                          {term ? termLabel(term) : "Term unavailable"}
                        </p>
                        <p className="flex gap-2">
                          <Users size={16} className="shrink-0 text-gray-400" />
                          {instructor?.full_name ?? "Faculty unavailable"}
                        </p>
                        <p className="flex gap-2">
                          <Clock size={16} className="shrink-0 text-gray-400" />
                          {item.schedule_text || "No schedule set"}
                        </p>
                        <p className="flex gap-2">
                          <MapPin size={16} className="shrink-0 text-gray-400" />
                          {item.room || "No room assigned"}
                        </p>
                      </div>
                      <div className="flex gap-2 border-t border-gray-100 pt-3">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleStatus(item)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Power size={15} />
                          {item.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  accent = "green",
  compact = false,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  accent?: "green" | "emerald" | "gray" | "blue";
  compact?: boolean;
}) {
  const iconStyles = {
    green: "bg-green-50 text-green-700",
    emerald: "bg-emerald-50 text-emerald-700",
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p
            className={`mt-2 truncate font-bold tracking-tight text-gray-900 ${
              compact ? "text-xl" : "text-3xl"
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconStyles[accent]}`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-gray-500">{description}</p>
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
