
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Layers3,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CurriculumProgram = {
  id: string;
  program_code: string;
  program_name: string;
};

type CurriculumSubject = {
  id: string;
  year_level: number;
  term_name: string;
  is_required: boolean;
  course: {
    id: string;
    course_code: string;
    title: string;
    units: number;
  } | null;
};

const PROGRAM_CODE = "SSU-COENG-BSCPE-MAIN";

const TERMS = [
  "First Semester",
  "Second Semester",
  "Summer / Mid-Year",
] as const;

const YEARS = [1, 2, 3, 4] as const;

export default function CurriculumPage() {
  const [program, setProgram] = useState<CurriculumProgram | null>(null);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCurriculum = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("Please sign in to view the curriculum.");
        setProgram(null);
        setSubjects([]);
        return;
      }

      const { data: programData, error: programError } = await supabase
        .from("programs")
        .select("id, program_code, program_name")
        .eq("program_code", PROGRAM_CODE)
        .maybeSingle();

      if (programError) throw programError;

      if (!programData) {
        setProgram(null);
        setSubjects([]);
        setError(
          "The BSCpE program record could not be found. Please verify the program code in Supabase."
        );
        return;
      }

      setProgram(programData);

      const { data: curriculumData, error: curriculumError } = await supabase
        .from("program_curriculum")
        .select(
          "id, year_level, term_name, is_required, course:courses(id, course_code, title, units)"
        )
        .eq("program_id", programData.id)
        .order("year_level", { ascending: true });

      if (curriculumError) throw curriculumError;

      const validSubjects = (curriculumData ?? []).filter(
        (item) => item.course !== null
      ) as unknown as CurriculumSubject[];

      validSubjects.sort((a, b) => {
        if (a.year_level !== b.year_level) {
          return a.year_level - b.year_level;
        }

        return (
          TERMS.indexOf(a.term_name as (typeof TERMS)[number]) -
          TERMS.indexOf(b.term_name as (typeof TERMS)[number])
        );
      });

      setSubjects(validSubjects);
    } catch (err) {
      console.error("Unable to load curriculum:", err);
      setError(
        "Unable to load the curriculum. Check your connection and Supabase permissions, then try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurriculum();
  }, [loadCurriculum]);

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return subjects.filter((subject) => {
      const matchesYear =
        selectedYear === "all" ||
        subject.year_level === Number(selectedYear);

      const matchesTerm =
        selectedTerm === "all" || subject.term_name === selectedTerm;

      const matchesSearch =
        !query ||
        subject.course?.course_code.toLowerCase().includes(query) ||
        subject.course?.title.toLowerCase().includes(query);

      return matchesYear && matchesTerm && matchesSearch;
    });
  }, [subjects, search, selectedYear, selectedTerm]);

  const totalUnits = filteredSubjects.reduce(
    (total, subject) => total + Number(subject.course?.units ?? 0),
    0
  );

  const yearCount = new Set(
    filteredSubjects.map((subject) => subject.year_level)
  ).size;

  const formatUnits = (units: number) =>
    Number.isInteger(units) ? String(units) : units.toFixed(1);

  return (
    <div className="space-y-7 pb-8">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-2 -top-6 h-40 w-40 rounded-full border border-white/10" />

        <div className="relative z-10 max-w-3xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10">
            <GraduationCap className="h-6 w-6" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Academic Records
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Program Curriculum
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85 sm:text-base">
            Explore the subjects, units, and semester structure of your
            academic program.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white">
            <BookOpen className="h-4 w-4" />
            {program?.program_code ?? "BSCpE"}
          </div>
        </div>
      </section>

      {error && (
        <section
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">{error}</p>
          </div>

          <button
            type="button"
            onClick={() => void loadCurriculum()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Curriculum Subjects
            </p>
            <BookOpen className="h-5 w-5 text-emerald-700" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            {loading ? "—" : filteredSubjects.length}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Matching the current filters
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total Units</p>
            <Layers3 className="h-5 w-5 text-emerald-700" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            {loading ? "—" : formatUnits(totalUnits)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Units in the displayed results
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Year Levels</p>
            <GraduationCap className="h-5 w-5 text-emerald-700" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            {loading ? "—" : yearCount}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Year levels with matching subjects
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Data Status</p>
            {error ? (
              <TriangleAlert className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            )}
          </div>
          <p className="mt-3 text-xl font-bold tracking-tight text-gray-900">
            {loading ? "Loading" : error ? "Needs attention" : "Connected"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Curriculum data from Supabase
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Browse Subjects
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Filter the curriculum by year, semester, or subject.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadCurriculum()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search code or subject name"
              aria-label="Search curriculum subjects"
              className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>

          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            aria-label="Filter by year level"
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
          >
            <option value="all">All year levels</option>
            {YEARS.map((year) => (
              <option key={year} value={String(year)}>
                Year {year}
              </option>
            ))}
          </select>

          <select
            value={selectedTerm}
            onChange={(event) => setSelectedTerm(event.target.value)}
            aria-label="Filter by semester"
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
          >
            <option value="all">All semesters</option>
            {TERMS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-900">
              {loading ? "—" : filteredSubjects.length}
            </span>{" "}
            subjects
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedYear("all");
              setSelectedTerm("all");
            }}
            className="text-sm font-medium text-emerald-800 transition hover:text-emerald-950"
          >
            Clear filters
          </button>
        </div>
      </section>

      {loading ? (
        <section className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="h-5 w-48 rounded bg-gray-200" />
              <div className="mt-4 h-12 rounded-lg bg-gray-100" />
              <div className="mt-2 h-12 rounded-lg bg-gray-100" />
            </div>
          ))}
        </section>
      ) : filteredSubjects.length === 0 ? (
        <section className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Search className="h-5 w-5 text-gray-500" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            No subjects found
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            No curriculum subjects match your current filters. Try a different
            search or clear the selected filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedYear("all");
              setSelectedTerm("all");
            }}
            className="mt-4 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-900"
          >
            Show all subjects
          </button>
        </section>
      ) : (
        <section className="space-y-6">
          {YEARS.filter((year) =>
            filteredSubjects.some((subject) => subject.year_level === year)
          ).map((year) => {
            const yearSubjects = filteredSubjects.filter(
              (subject) => subject.year_level === year
            );

            return (
              <div key={year} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-800">
                    {year}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Year {year}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {yearSubjects.length} subjects ·{" "}
                      {formatUnits(
                        yearSubjects.reduce(
                          (sum, subject) =>
                            sum + Number(subject.course?.units ?? 0),
                          0
                        )
                      )}{" "}
                      units in filtered results
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {TERMS.filter((term) =>
                    yearSubjects.some(
                      (subject) => subject.term_name === term
                    )
                  ).map((term) => {
                    const termSubjects = yearSubjects
                      .filter((subject) => subject.term_name === term)
                      .sort((a, b) =>
                        (a.course?.course_code ?? "").localeCompare(
                          b.course?.course_code ?? ""
                        )
                      );

                    const termUnits = termSubjects.reduce(
                      (sum, subject) =>
                        sum + Number(subject.course?.units ?? 0),
                      0
                    );

                    return (
                      <article
                        key={`${year}-${term}`}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-4 py-4 sm:px-5">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">
                              <CalendarDays className="h-4 w-4 text-emerald-800" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {term}
                              </h3>
                              <p className="mt-1 text-xs text-gray-500">
                                {termSubjects.length} subjects
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xl font-bold text-gray-900">
                              {formatUnits(termUnits)}
                            </p>
                            <p className="text-xs text-gray-500">Units</p>
                          </div>
                        </div>

                        <div className="divide-y divide-gray-100">
                          {termSubjects.map((subject) => (
                            <div
                              key={subject.id}
                              className="flex items-start justify-between gap-3 px-4 py-4 transition hover:bg-gray-50/70 sm:px-5"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold tracking-wide text-emerald-800">
                                  {subject.course?.course_code}
                                </p>
                                <p className="mt-1 text-sm font-medium leading-5 text-gray-900">
                                  {subject.course?.title}
                                </p>
                                {!subject.is_required && (
                                  <span className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                                    Elective
                                  </span>
                                )}
                              </div>

                              <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-center">
                                <p className="text-sm font-bold text-gray-900">
                                  {formatUnits(
                                    Number(subject.course?.units ?? 0)
                                  )}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                  units
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h3 className="text-sm font-semibold text-amber-950">
            Curriculum completeness
          </h3>
          <p className="mt-1 text-sm leading-6 text-amber-900/80">
            This page displays the curriculum records currently stored in
            SmartGrade. Some semester entries remain unverified against the
            official university curriculum. Missing semesters are not assumed
            to be empty in the official curriculum, and no subjects are
            generated automatically.
          </p>
        </div>
      </section>
    </div>
  );
}
