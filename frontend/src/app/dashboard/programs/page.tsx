
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  GraduationCap,
  RefreshCw,
  Search,
  AlertCircle,
} from "lucide-react";

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
  department: Department | null;
};

type DirectoryResponse = {
  departments?: Department[];
  programs?: Program[];
  error?: string;
};

export default function ProgramsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDirectory = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const response = await fetch("/api/academic-directory", {
        cache: "no-store",
      });

      const result: DirectoryResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load the academic directory.");
      }

      const activeDepartments = (result.departments ?? []).filter(
        (department) => department.is_active
      );

      const activeDepartmentIds = new Set(
        activeDepartments.map((department) => department.id)
      );

      const activePrograms = (result.programs ?? []).filter(
        (program) =>
          program.is_active &&
          program.department_id !== null &&
          activeDepartmentIds.has(program.department_id)
      );

      setDepartments(activeDepartments);
      setPrograms(activePrograms);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the academic directory."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const filteredPrograms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return programs.filter((program) => {
      const matchesDepartment =
        selectedDepartment === "all" ||
        program.department_id === selectedDepartment;

      const matchesSearch =
        program.program_code.toLowerCase().includes(query) ||
        program.program_name.toLowerCase().includes(query) ||
        program.campus_name.toLowerCase().includes(query) ||
        (program.department?.name ?? "").toLowerCase().includes(query) ||
        (program.department?.code ?? "").toLowerCase().includes(query);

      return matchesDepartment && matchesSearch;
    });
  }, [programs, search, selectedDepartment]);

  const visibleDepartments = useMemo(() => {
    if (selectedDepartment !== "all") {
      return departments.filter(
        (department) => department.id === selectedDepartment
      );
    }

    return departments;
  }, [departments, selectedDepartment]);

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <GraduationCap size={25} />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
          Academic Information
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Departments and Programs
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Explore the active academic departments and degree programs offered
          at Samar State University.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Departments</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {departments.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Active departments</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Degree programs</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {programs.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Active programs</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Directory status</p>
          <p className="mt-3 text-xl font-bold text-emerald-700">
            {loading ? "Loading..." : error ? "Unavailable" : "Connected"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            University academic directory
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search departments or programs"
              aria-label="Search departments or programs"
              className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/10"
            />
          </div>

          <select
            value={selectedDepartment}
            onChange={(event) => setSelectedDepartment(event.target.value)}
            aria-label="Filter by department"
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-600 sm:max-w-sm"
          >
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadDirectory(true)}
            disabled={refreshing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Showing {filteredPrograms.length} programs across{" "}
          {visibleDepartments.length} departments
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
          Loading departments and programs...
        </div>
      ) : visibleDepartments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Building2 size={30} className="mx-auto text-slate-400" />
          <h2 className="mt-4 font-semibold text-slate-900">
            No departments found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Try another search or select all departments.
          </p>
        </div>
      ) : (
        <section className="space-y-5">
          {visibleDepartments.map((department) => {
            const departmentPrograms = filteredPrograms.filter(
              (program) => program.department_id === department.id
            );

            if (
              search.trim() &&
              !department.name.toLowerCase().includes(search.trim().toLowerCase()) &&
              !department.code.toLowerCase().includes(search.trim().toLowerCase()) &&
              departmentPrograms.length === 0
            ) {
              return null;
            }

            return (
              <article
                key={department.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <Building2 size={21} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                      {department.code}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      {department.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {departmentPrograms.length} matching program
                      {departmentPrograms.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {departmentPrograms.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    No matching active programs are currently listed for this
                    department.
                  </p>
                ) : (
                  <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {departmentPrograms.map((program) => (
                      <div
                        key={program.id}
                        className="rounded-xl border border-slate-200 p-4 transition hover:border-sky-200 hover:bg-sky-50/30"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                          <BookOpen size={18} />
                        </div>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-sky-700">
                          {program.program_code}
                        </p>

                        <h3 className="mt-1 font-semibold leading-6 text-slate-900">
                          {program.program_name}
                        </h3>

                        <p className="mt-3 text-xs text-slate-500">
                          Campus: {program.campus_name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <footer className="border-t border-slate-200 pt-5 text-xs text-slate-400">
        SmartGrade · Samar State University
      </footer>
    </main>
  );
}
