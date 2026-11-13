
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Power,
  X,
  CheckCircle2,
  AlertCircle,
  Layers3,
} from "lucide-react";

type Department = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<Department | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const loadDepartments = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const response = await fetch("/api/admin/departments", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load departments.");
      }

      setDepartments(result.departments ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load departments."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  const resetForm = () => {
    setEditing(null);
    setCode("");
    setName("");
  };

  function startEdit(department: Department) {
    setEditing(department);
    setCode(department.code);
    setName(department.name);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch("/api/admin/departments", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          code: code.trim().toUpperCase(),
          name: name.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save department.");
      }

      setSuccess(
        editing
          ? "Department updated successfully."
          : "Department created successfully."
      );

      resetForm();
      await loadDepartments(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save department."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(department: Department) {
    const nextStatus = !department.is_active;
    const confirmed = window.confirm(
      `${nextStatus ? "Activate" : "Deactivate"} ${department.name}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: department.id,
          is_active: nextStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update department status.");
      }

      setSuccess(
        `${department.name} has been ${nextStatus ? "activated" : "deactivated"}.`
      );

      await loadDepartments(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update department status."
      );
    }
  }

  const filteredDepartments = departments.filter((department) => {
    const query = search.trim().toLowerCase();

    return (
      department.code.toLowerCase().includes(query) ||
      department.name.toLowerCase().includes(query)
    );
  });

  const activeCount = departments.filter((item) => item.is_active).length;
  const inactiveCount = departments.length - activeCount;

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <section className="rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10">
          <Building2 size={24} />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Departments Management
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">
          Manage colleges and departments, maintain their official codes, and
          control availability for faculty assignments.
        </p>
      </section>

      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 size={18} className="shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total departments", value: departments.length, icon: Building2 },
          { label: "Active departments", value: activeCount, icon: CheckCircle2 },
          { label: "Inactive departments", value: inactiveCount, icon: Layers3 },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{stat.label}</p>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <Icon size={19} />
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-900">
                {stat.value}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">
                {editing ? "Edit department" : "Add a department"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {editing ? "Update department details." : "Register a new college or department."}
              </p>
            </div>
            {editing && (
              <button type="button" onClick={resetForm} aria-label="Cancel editing" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                <X size={17} />
              </button>
            )}
          </div>

          <div>
            <label htmlFor="departmentCode" className="mb-1.5 block text-sm font-medium text-slate-700">
              Department code
            </label>
            <input
              id="departmentCode"
              required
              minLength={2}
              maxLength={15}
              pattern="[A-Za-z0-9_-]+"
              title="Use letters, numbers, hyphens, or underscores."
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. COED"
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>

          <div>
            <label htmlFor="departmentName" className="mb-1.5 block text-sm font-medium text-slate-700">
              Official department name
            </label>
            <input
              id="departmentName"
              required
              minLength={2}
              maxLength={150}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. College of Education"
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>

          <button type="submit" disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">
            {editing ? <Pencil size={17} /> : <Plus size={18} />}
            {saving
              ? "Saving..."
              : editing
                ? "Save department changes"
                : "Create department"}
          </button>

          {editing && (
            <button type="button" onClick={resetForm} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          )}
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Department directory</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredDepartments.length} of {departments.length} departments
              </p>
            </div>
            <button type="button" onClick={() => void loadDepartments(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="relative mt-5">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by code or department name"
              aria-label="Search departments"
              className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">Loading departments...</p>
          ) : filteredDepartments.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-800">No departments found</p>
              <p className="mt-1 text-sm text-slate-500">
                Try a different search or create a department.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {filteredDepartments.map((department) => (
                <article key={department.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <Building2 size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{department.name}</p>
                    <p className="mt-1 text-xs text-slate-500">Code: {department.code}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${department.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {department.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => startEdit(department)} title="Edit department" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                      <Pencil size={15} /> Edit
                    </button>
                    <button type="button" onClick={() => void toggleStatus(department)} title={department.is_active ? "Deactivate department" : "Activate department"} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${department.is_active ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                      <Power size={15} />
                      {department.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        <p className="font-semibold text-slate-900">Administrator access</p>
        Department creation, editing, and status changes are performed by a server-side API that verifies the active administrator session.
      </section>
    </main>
  );
}
