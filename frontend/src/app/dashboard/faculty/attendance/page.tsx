"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, BookOpen, CheckCircle2, ClipboardList, LoaderCircle, RefreshCw, Search, Users } from "lucide-react";

type Course = { course_code: string; title: string; units: number | null };
type Term = { academic_year: string; term_name: string; status: string };
type ClassRow = { id: string; course_id: string; term_id: string; section: string; is_active: boolean; courses: Course | Course[] | null; academic_terms: Term | Term[] | null };
type Enrollment = { id: string; class_id: string; student_id: string; is_active: boolean };
type Profile = { id: string; full_name: string | null; institutional_email: string | null };
type Grade = { id: string; class_id: string; student_id: string; term_id: string; raw_score: number | null; final_grade: number | null; status: string; faculty_notes: string | null; published_at: string | null };
type GradeRow = Grade & { studentName: string; email: string; courseName: string; section: string; termName: string };

function first<T>(v: T | T[] | null | undefined): T | null { return !v ? null : Array.isArray(v) ? v[0] ?? null : v; }
function labelStatus(v: string) { return v.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()); }
function statusClass(v: string) {
  const s = v.toLowerCase();
  if (s === "approved" || s === "published") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "submitted" || s === "pending") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (s === "returned" || s === "rejected") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default function FacultyGradeManagementPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again to view grade management.");
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,is_active").eq("id", auth.user.id).single();
      if (profileError) throw profileError;
      if (profile.role !== "faculty" || !profile.is_active) throw new Error("This page is available only to active faculty accounts.");
      const { data: classData, error: classError } = await supabase.from("classes")
        .select("id,course_id,term_id,section,is_active,courses(course_code,title,units),academic_terms(academic_year,term_name,status)")
        .eq("faculty_id", auth.user.id).order("created_at", { ascending: false });
      if (classError) throw classError;
      const classRows = (classData ?? []) as unknown as ClassRow[];
      setClasses(classRows);
      if (!classRows.length) { setRows([]); return; }
      const ids = classRows.map(c => c.id);
      const [enrollResult, gradeResult] = await Promise.all([
        supabase.from("enrollments").select("id,class_id,student_id,is_active").in("class_id", ids).eq("is_active", true),
        supabase.from("grades").select("id,class_id,student_id,term_id,raw_score,final_grade,status,faculty_notes,published_at").in("class_id", ids)
      ]);
      if (enrollResult.error) throw enrollResult.error;
      if (gradeResult.error) throw gradeResult.error;
      const enrollments = (enrollResult.data ?? []) as Enrollment[];
      const grades = (gradeResult.data ?? []) as Grade[];
      const studentIds = [...new Set([...enrollments.map(e => e.student_id), ...grades.map(g => g.student_id)])];
      let profiles: Profile[] = [];
      if (studentIds.length) {
        const { data, error: studentsError } = await supabase.from("profiles").select("id,full_name,institutional_email").in("id", studentIds);
        if (studentsError) throw studentsError;
        profiles = (data ?? []) as Profile[];
      }
      const profileById = new Map(profiles.map(p => [p.id, p]));
      const classById = new Map(classRows.map(c => [c.id, c]));
      const existing = new Map<string, GradeRow>();
      for (const g of grades) {
        const c = classById.get(g.class_id);
        const p = profileById.get(g.student_id);
        const course = first(c?.courses);
        const term = first(c?.academic_terms);
        existing.set(`${g.class_id}:${g.student_id}`, {
          ...g, studentName: p?.full_name || "Unnamed student", email: p?.institutional_email || "",
          courseName: course ? `${course.course_code} · ${course.title}` : "Course", section: c?.section || "—",
          termName: term ? `${term.term_name} · ${term.academic_year}` : "Term not assigned"
        });
      }
      const combined = [...existing.values()];
      const gradedKeys = new Set(combined.map(r => `${r.class_id}:${r.student_id}`));
      for (const e of enrollments) {
        const key = `${e.class_id}:${e.student_id}`;
        if (gradedKeys.has(key)) continue;
        const c = classById.get(e.class_id);
        const p = profileById.get(e.student_id);
        const course = first(c?.courses);
        const term = first(c?.academic_terms);
        combined.push({
          id: `ungraded:${key}`, class_id: e.class_id, student_id: e.student_id, term_id: c?.term_id || "",
          raw_score: null, final_grade: null, status: "draft", faculty_notes: null, published_at: null,
          studentName: p?.full_name || "Unnamed student", email: p?.institutional_email || "",
          courseName: course ? `${course.course_code} · ${course.title}` : "Course", section: c?.section || "—",
          termName: term ? `${term.term_name} · ${term.academic_year}` : "Term not assigned"
        });
      }
      setRows(combined.sort((a,b) => a.studentName.localeCompare(b.studentName)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load grade records.");
      setRows([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const visibleRows = useMemo(() => rows.filter(r => {
    const text = `${r.studentName} ${r.email} ${r.courseName} ${r.section}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase()))
      && (classFilter === "all" || r.class_id === classFilter)
      && (statusFilter === "all" || r.status.toLowerCase() === statusFilter);
  }), [rows, search, classFilter, statusFilter]);
  const counts = useMemo(() => ({
    total: rows.length,
    draft: rows.filter(r => ["draft","pending"].includes(r.status.toLowerCase())).length,
    submitted: rows.filter(r => ["submitted","under_review"].includes(r.status.toLowerCase())).length,
    finalized: rows.filter(r => ["approved","published"].includes(r.status.toLowerCase())).length
  }), [rows]);
  const statuses = [...new Set(rows.map(r => r.status.toLowerCase()))];

  return <main className="min-h-full bg-slate-50/80 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-semibold text-sky-700">Faculty Workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Grade Management</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review grade records for students in your assigned classes.</p></div>
        <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/>Refresh</button>
      </header>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={18}/><span>{error}</span></div>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Grade records",counts.total,ClipboardList],["Draft / pending",counts.draft,BookOpen],["Under review",counts.submitted,Users],["Approved / published",counts.finalized,CheckCircle2]].map(([label,value,Icon]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{String(label)}</p><span className="rounded-xl bg-sky-50 p-2 text-sky-700"><Icon size={18}/></span></div><p className="mt-3 text-3xl font-semibold text-slate-950">{loading ? "—" : String(value)}</p><p className="mt-2 text-xs text-slate-500">Across your assigned classes</p></article>)}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold text-slate-950">Student gradebook</h2><p className="mt-1 text-sm text-slate-500">Students without a grade record are shown as Draft. Grade edits and submission workflow can be added according to your approval rules.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student or course" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-sky-500 sm:w-64"/></label>
          <select value={classFilter} onChange={e=>setClassFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">All assigned classes</option>{classes.map(c=>{const course=first(c.courses); return <option key={c.id} value={c.id}>{course?.course_code || "Course"} · {c.section}</option>})}</select>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">All statuses</option>{statuses.map(s=><option key={s} value={s}>{labelStatus(s)}</option>)}</select></div>
        </div>
        {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18}/>Loading grade records...</div> : visibleRows.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-5 py-12 text-center"><ClipboardList className="mx-auto text-slate-400" size={28}/><h3 className="mt-3 font-semibold text-slate-900">No grade records found</h3><p className="mt-1 text-sm text-slate-500">{rows.length ? "Try changing your search or filters." : "Students from your assigned classes will appear here once enrolled."}</p></div> :
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3 font-medium">Student</th><th className="px-3 py-3 font-medium">Course / section</th><th className="px-3 py-3 font-medium">Academic term</th><th className="px-3 py-3 font-medium">Raw score</th><th className="px-3 py-3 font-medium">Final grade</th><th className="px-3 py-3 font-medium">Status</th></tr></thead><tbody>{visibleRows.map(r=><tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-3 py-4"><p className="font-medium text-slate-900">{r.studentName}</p><p className="mt-0.5 text-xs text-slate-500">{r.email || "No institutional email"}</p></td><td className="px-3 py-4"><p className="font-medium text-slate-800">{r.courseName}</p><p className="mt-0.5 text-xs text-slate-500">Section {r.section}</p></td><td className="px-3 py-4 text-slate-600">{r.termName}</td><td className="px-3 py-4">{r.raw_score ?? "—"}</td><td className="px-3 py-4 font-semibold">{r.final_grade ?? "—"}</td><td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass(r.status)}`}>{labelStatus(r.status)}</span></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </main>;
}
