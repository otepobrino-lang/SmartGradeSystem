
"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Power,
  X,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Archive,
} from "lucide-react";

type TermStatus = "planned" | "active" | "completed" | "archived";

type AcademicTerm = {
  id: string;
  academic_year: string;
  term_name: string;
  starts_on: string;
  ends_on: string;
  status: TermStatus;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS: { value: TermStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const STATUS_STYLES: Record<TermStatus, string> = {
  planned: "bg-blue-50 text-blue-700",
  active: "bg-emerald-50 text-emerald-700",
  completed: "bg-slate-100 text-slate-700",
  archived: "bg-amber-50 text-amber-700",
};

const EMPTY_FORM = {
  academic_year: "",
  term_name: "",
  starts_on: "",
  ends_on: "",
  status: "planned" as TermStatus,
};

export default function AcademicTermsPage() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editing, setEditing] = useState<AcademicTerm | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadTerms = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const response = await fetch("/api/admin/terms", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load academic terms.");
      }

      setTerms(result.terms ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load academic terms.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(term: AcademicTerm) {
    setEditing(term);
    setForm({
      academic_year: term.academic_year,
      term_name: term.term_name,
      starts_on: term.starts_on,
      ends_on: term.ends_on,
      status: term.status,
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateField<K extends keyof typeof EMPTY_FORM>(
    field: K,
    value: (typeof EMPTY_FORM)[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.ends_on < form.starts_on) {
      setError("The end date cannot be earlier than the start date.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        editing ? `/api/admin/terms/${editing.id}` : "/api/admin/terms",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save academic term.");
      }

      setSuccess(editing ? "Academic term updated successfully." : "Academic term created successfully.");
      resetForm();
      await loadTerms(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save academic term.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(term: AcademicTerm, status: TermStatus) {
    if (status === term.status) return;

    const confirmed = window.confirm(
      `Change "${term.term_name} (${term.academic_year})" from ${term.status} to ${status}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/terms/${term.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update term status.");
      }

      setSuccess(`${term.term_name} status changed to ${status}.`);
      await loadTerms(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update term status.");
    }
  }

  const filteredTerms = terms.filter((term) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      term.academic_year.toLowerCase().includes(query) ||
      term.term_name.toLowerCase().includes(query) ||
      term.status.toLowerCase().includes(query);

    return matchesSearch &&
      (statusFilter === "all" || term.status === statusFilter);
  });

  const countStatus = (status: TermStatus) =>
    terms.filter((term) => term.status === status).length;

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <section className="rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10">
          <CalendarDays size={24} />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Academic Terms Management
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">
          Organize academic years, semester schedules, term dates, and academic term status.
        </p>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total terms", value: terms.length, icon: CalendarDays },
          { label: "Active", value: countStatus("active"), icon: CheckCircle2 },
          { label: "Planned", value: countStatus("planned"), icon: Clock3 },
          { label: "Completed / archived", value: countStatus("completed") + countStatus("archived"), icon: Archive },
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
              <p className="mt-4 text-3xl font-bold text-slate-900">{stat.value}</p>
            </article>
          );
        })}
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">{editing ? "Edit academic term" : "Add academic term"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {editing ? "Update the selected term." : "Create a school year and term schedule."}
              </p>
            </div>
            {editing && (
              <button type="button" onClick={resetForm} aria-label="Cancel editing" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                <X size={17} />
              </button>
            )}
          </div>

          <div>
            <label htmlFor="academicYear" className="mb-1.5 block text-sm font-medium text-slate-700">Academic year</label>
            <input
              id="academicYear"
              required
              pattern="[0-9]{4}-[0-9]{4}"
              title="Use the format YYYY-YYYY, e.g. 2026-2027"
              value={form.academic_year}
              onChange={(event) => updateField("academic_year", event.target.value)}
              placeholder="2026-2027"
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="termName" className="mb-1.5 block text-sm font-medium text-slate-700">Term name</label>
            <input
              id="termName"
              required
              maxLength={100}
              value={form.term_name}
              onChange={(event) => updateField("term_name", event.target.value)}
              placeholder="e.g. First Semester"
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="startsOn" className="mb-1.5 block text-sm font-medium text-slate-700">Start date</label>
              <input
                id="startsOn"
                type="date"
                required
                value={form.starts_on}
                onChange={(event) => updateField("starts_on", event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label htmlFor="endsOn" className="mb-1.5 block text-sm font-medium text-slate-700">End date</label>
              <input
                id="endsOn"
                type="date"
                required
                min={form.starts_on || undefined}
                value={form.ends_on}
                onChange={(event) => updateField("ends_on", event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div>
            <label htmlFor="termStatus" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
            <select
              id="termStatus"
              value={form.status}
              onChange={(event) => updateField("status", event.target.value as TermStatus)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">
            {editing ? <Pencil size={17} /> : <Plus size={18} />}
            {saving ? "Saving..." : editing ? "Save term changes" : "Create academic term"}
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
              <h2 className="font-semibold text-slate-900">Academic terms directory</h2>
              <p className="mt-1 text-sm text-slate-500">{filteredTerms.length} of {terms.length} terms</p>
            </div>
            <button type="button" onClick={() => void loadTerms(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search terms or academic year"
                aria-label="Search academic terms"
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-700"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">Loading academic terms...</p>
          ) : filteredTerms.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarDays size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-800">No academic terms found</p>
              <p className="mt-1 text-sm text-slate-500">Try changing your search or filter.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {filteredTerms.map((term) => (
                <article key={term.id} className="space-y-3 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                      <CalendarDays size={19} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{term.term_name}</p>
                      <p className="mt-1 text-sm text-slate-600">AY {term.academic_year}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDate(term.starts_on)} – {formatDate(term.ends_on)}
                      </p>
                      <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[term.status]}`}>
                        {term.status.charAt(0).toUpperCase() + term.status.slice(1)}
                      </span>
                    </div>

                    <button type="button" onClick={() => startEdit(term)} title="Edit academic term" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                      <Pencil size={15} /> Edit
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pl-0 sm:pl-[52px]">
                    {STATUS_OPTIONS.filter((option) => option.value !== term.status).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void changeStatus(term, option.value)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        Set {option.label}
                      </button>
                    ))}
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400">
                      <Power size={12} /> Change status
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
