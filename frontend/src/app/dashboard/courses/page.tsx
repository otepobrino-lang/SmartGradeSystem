
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Search,
  RefreshCw,
  ShieldCheck,
  Clock3,
  UserRound,
  Layers3,
  TriangleAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string;
  course_code: string;
  title: string;
  description: string | null;
  units: number;
};

type Term = {
  academic_year: string;
  term_name: string;
  status: string;
};

type Faculty = {
  full_name: string;
};

type ClassRecord = {
  id: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  is_active: boolean;
  courses: Course | Course[] | null;
  academic_terms: Term | Term[] | null;
  profiles: Faculty | Faculty[] | null;
};

type Enrollment = {
  id: string;
  class_id: string;
  enrolled_at: string;
  is_active: boolean;
  classes: ClassRecord | ClassRecord[] | null;
};

type StudentProfile = {
  full_name: string;
  role: string;
  is_active: boolean;
  program_id: string | null;
};

type StudentProgram = {
  id: string;
  program_code: string;
  program_name: string;
};

type CurriculumRecord = {
  course_id: string;
  year_level: number;
  term_name: string;
};

type CurriculumPlacement = {
  year_level: number;
  term_name: string;
};

type CurriculumPlacementMap = Record<string, CurriculumPlacement>;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatUnits(value: number | string | null | undefined) {
  const units = Number(value ?? 0);
  return Number.isInteger(units) ? String(units) : units.toFixed(1);
}

function CourseCard({
  enrollment,
  placement,
}: {
  enrollment: Enrollment;
  placement?: CurriculumPlacement;
}) {
  const classInfo = firstOf(enrollment.classes);
  const course = firstOf(classInfo?.courses);
  const term = firstOf(classInfo?.academic_terms);
  const faculty = firstOf(classInfo?.profiles);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
          <BookOpen size={22} />
        </div>

        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          Enrolled
        </span>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          {course?.course_code ?? "Course code unavailable"}
        </p>

        <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-900">
          {course?.title ?? "Course information unavailable"}
        </h2>

        {course?.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
            {course.description}
          </p>
        )}
      </div>

      <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
        <div className="flex items-start gap-2.5 text-sm">
          <GraduationCap
            size={17}
            className="mt-0.5 shrink-0 text-slate-400"
          />
          <div>
            <p className="text-xs text-slate-500">Section</p>
            <p className="mt-0.5 font-medium text-slate-800">
              {classInfo?.section ?? "Not specified"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-sm">
          <CalendarDays
            size={17}
            className="mt-0.5 shrink-0 text-slate-400"
          />
          <div>
            <p className="text-xs text-slate-500">Academic term</p>
            <p className="mt-0.5 font-medium text-slate-800">
              {term
                ? `${term.academic_year} · ${term.term_name}`
                : "Not specified"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-sm">
          <Layers3
            size={17}
            className="mt-0.5 shrink-0 text-slate-400"
          />
          <div>
            <p className="text-xs text-slate-500">Curriculum placement</p>
            <p className="mt-0.5 font-medium text-slate-800">
              {placement
                ? `Year ${placement.year_level} · ${placement.term_name}`
                : "No matching curriculum mapping"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-sm">
          <UserRound
            size={17}
            className="mt-0.5 shrink-0 text-slate-400"
          />
          <div>
            <p className="text-xs text-slate-500">Faculty</p>
            <p className="mt-0.5 font-medium text-slate-800">
              {faculty?.full_name ?? "Not assigned"}
            </p>
          </div>
        </div>

        {(classInfo?.room || classInfo?.schedule_text) && (
          <div className="flex items-start gap-2.5 text-sm">
            <Clock3
              size={17}
              className="mt-0.5 shrink-0 text-slate-400"
            />
            <div>
              <p className="text-xs text-slate-500">Class details</p>

              {classInfo.room && (
                <p className="mt-0.5 font-medium text-slate-800">
                  {classInfo.room}
                </p>
              )}

              {classInfo.schedule_text && (
                <p className="mt-0.5 text-slate-600">
                  {classInfo.schedule_text}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">
          {course?.units != null
            ? `${formatUnits(course.units)} units`
            : "Units not specified"}
        </span>

        <span className="text-xs text-slate-400">
          Class {enrollment.class_id.slice(0, 8)}
        </span>
      </div>
    </article>
  );
}

export default function MyCoursesPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [program, setProgram] = useState<StudentProgram | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [curriculumPlacements, setCurriculumPlacements] =
    useState<CurriculumPlacementMap>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("all");

  const loadCourses = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const supabase = createClient();

        const {
          data: authData,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("full_name, role, is_active, program_id")
          .eq("id", authData.user.id)
          .single();

        if (
          profileError ||
          !profileData ||
          !profileData.is_active
        ) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (profileData.role !== "student") {
          router.replace("/dashboard");
          return;
        }

        const currentProfile = profileData as StudentProfile;
        setProfile(currentProfile);

        setProgram(null);
        setCurriculumPlacements({});

        const {
          data: enrollmentData,
          error: enrollmentError,
        } = await supabase
          .from("enrollments")
          .select(
            "id, class_id, enrolled_at, is_active, classes(id, section, room, schedule_text, is_active, courses(id, course_code, title, description, units), academic_terms(academic_year, term_name, status), profiles!classes_faculty_id_fkey(full_name))"
          )
          .eq("student_id", authData.user.id)
          .eq("is_active", true)
          .order("enrolled_at", { ascending: false });

        if (enrollmentError) {
          throw new Error(enrollmentError.message);
        }

        const currentEnrollments = (
          enrollmentData ?? []
        ) as unknown as Enrollment[];

        setEnrollments(currentEnrollments);

        if (!currentProfile.program_id) {
          return;
        }

        const {
          data: programData,
          error: programError,
        } = await supabase
          .from("programs")
          .select("id, program_code, program_name")
          .eq("id", currentProfile.program_id)
          .maybeSingle();

        if (programError) {
          throw new Error(programError.message);
        }

        if (!programData) {
          throw new Error(
            "Your assigned program could not be found. Please contact the administrator."
          );
        }

        const currentProgram = programData as StudentProgram;
        setProgram(currentProgram);

        const {
          data: curriculumData,
          error: curriculumError,
        } = await supabase
          .from("program_curriculum")
          .select("course_id, year_level, term_name")
          .eq("program_id", currentProgram.id);

        if (curriculumError) {
          throw new Error(curriculumError.message);
        }

        const placementMap: CurriculumPlacementMap = {};

        for (const record of (curriculumData ??
          []) as CurriculumRecord[]) {
          placementMap[record.course_id] = {
            year_level: record.year_level,
            term_name: record.term_name,
          };
        }

        setCurriculumPlacements(placementMap);
      } catch (caught) {
        console.error("Unable to load My Courses:", caught);

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load your courses. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const terms = useMemo(() => {
    const values = new Set<string>();

    enrollments.forEach((enrollment) => {
      const classInfo = firstOf(enrollment.classes);
      const term = firstOf(classInfo?.academic_terms);

      if (term) {
        values.add(`${term.academic_year} · ${term.term_name}`);
      }
    });

    return Array.from(values).sort((a, b) => b.localeCompare(a));
  }, [enrollments]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrollments.filter((enrollment) => {
      const classInfo = firstOf(enrollment.classes);
      const course = firstOf(classInfo?.courses);
      const term = firstOf(classInfo?.academic_terms);
      const faculty = firstOf(classInfo?.profiles);

      const termLabel = term
        ? `${term.academic_year} · ${term.term_name}`
        : "";

      const matchesSearch =
        !query ||
        course?.title.toLowerCase().includes(query) ||
        course?.course_code.toLowerCase().includes(query) ||
        classInfo?.section.toLowerCase().includes(query) ||
        faculty?.full_name.toLowerCase().includes(query);

      const matchesTerm =
        selectedTerm === "all" || selectedTerm === termLabel;

      return Boolean(matchesSearch && matchesTerm);
    });
  }, [enrollments, search, selectedTerm]);

  const totalUnits = enrollments.reduce((total, enrollment) => {
    const classInfo = firstOf(enrollment.classes);
    const course = firstOf(classInfo?.courses);

    return total + Number(course?.units ?? 0);
  }, 0);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-10 py-8 text-center shadow-sm">
          <BookOpen
            className="mx-auto text-emerald-800"
            size={28}
          />
          <p className="mt-4 text-sm font-medium text-slate-800">
            Loading your courses
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Retrieving your enrollments and curriculum information.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            ACADEMIC ENROLLMENT
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            My Courses
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            View your enrolled classes, faculty, academic terms, and
            corresponding program curriculum placements.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              {program
                ? `${program.program_code} · ${program.program_name}`
                : "Program not assigned"}
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 sm:self-auto">
          <ShieldCheck size={17} className="text-emerald-800" />
          Private enrollment records
        </div>
      </section>

      {error && (
        <section
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <TriangleAlert
              size={18}
              className="mt-0.5 shrink-0"
            />
            <p className="break-words">{error}</p>
          </div>

          <button
            type="button"
            onClick={() => void loadCourses(true)}
            disabled={refreshing}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 font-medium transition hover:bg-red-100 disabled:opacity-50"
          >
            Try again
          </button>
        </section>
      )}

      {!profile?.program_id && (
        <section className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <TriangleAlert
            size={20}
            className="mt-0.5 shrink-0 text-amber-700"
          />

          <div>
            <h2 className="text-sm font-semibold text-amber-950">
              Degree program not assigned
            </h2>
            <p className="mt-1 text-sm leading-6 text-amber-900/80">
              Your active enrollments can still be viewed. Curriculum
              placements will appear after an authorized administrator
              assigns your correct degree program.
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Active courses</p>
            <BookOpen size={19} className="text-emerald-800" />
          </div>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {enrollments.length}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Active enrollment records
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Academic terms</p>
            <CalendarDays size={19} className="text-emerald-800" />
          </div>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {terms.length}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Terms represented in your enrollments
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Total enrolled units</p>
            <Layers3 size={19} className="text-emerald-800" />
          </div>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {formatUnits(totalUnits)}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Sum of units in active enrollment records
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search course title, code, section, or faculty"
              aria-label="Search enrolled courses"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            />
          </div>

          <select
            value={selectedTerm}
            onChange={(event) => setSelectedTerm(event.target.value)}
            aria-label="Filter by academic term"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          >
            <option value="all">All academic terms</option>

            {terms.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-800">
              {filtered.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800">
              {enrollments.length}
            </span>{" "}
            courses
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {(search || selectedTerm !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedTerm("all");
                }}
                className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
              >
                Clear filters
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadCourses(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {enrollments.length === 0 ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
            <BookOpen size={27} />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-900">
            No active courses yet
          </h2>

          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Your classes will appear here after an authorized staff
            member enrolls your account in a class.
          </p>

          <Link
            href="/dashboard"
            className="mt-5 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            Back to overview
          </Link>
        </section>
      ) : filtered.length === 0 ? (
        <section className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <Search size={25} className="text-slate-400" />

          <h2 className="mt-4 font-semibold text-slate-900">
            No matching courses
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Try a different search term or academic term filter.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedTerm("all");
            }}
            className="mt-4 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Clear filters
          </button>
        </section>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((enrollment) => {
            const classInfo = firstOf(enrollment.classes);
            const course = firstOf(classInfo?.courses);

            const placement = course?.id
              ? curriculumPlacements[course.id]
              : undefined;

            return (
              <CourseCard
                key={enrollment.id}
                enrollment={enrollment}
                placement={placement}
              />
            );
          })}
        </section>
      )}

      <footer className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>SmartGrade · Samar State University</p>

        <p>
          {enrollments.length} active enrollment
          {enrollments.length === 1 ? "" : "s"} retrieved from Supabase
        </p>
      </footer>
    </main>
  );
}
