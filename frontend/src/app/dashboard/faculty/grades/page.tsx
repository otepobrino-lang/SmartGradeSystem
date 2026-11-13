"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  GraduationCap,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AssignmentType = "summative" | "laboratory" | "project" | "quiz" | "exam" | "other";
type GradeStatus = "draft" | "submitted" | "approved" | "published" | "returned";
type ClassRow = {
  id: string;
  course_id: string;
  term_id: string;
  faculty_id: string;
  section: string;
  room: string | null;
  schedule_text: string | null;
  is_active: boolean;
  courses: { course_code: string; title: string; units: number } | null;
  academic_terms: { academic_year: string; term_name: string; status: string } | null;
};
type StudentRow = { id: string; full_name: string; institutional_email: string | null };
type AssignmentRow = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  assignment_type: AssignmentType;
  max_score: number;
  due_at: string | null;
  is_published: boolean;
};
type ComponentRow = { id: string; class_id: string; name: string; assignment_type: AssignmentType; weight_percent: number };
type ScoreRow = { id: string; assignment_id: string; student_id: string; score: number; feedback: string | null; graded_by: string };
type GradeRow = { id: string; class_id: string; student_id: string; term_id: string; raw_score: number | null; final_grade: number | null; status: GradeStatus; faculty_notes: string | null; created_by: string };
type SettingRow = { id: string; class_id: string; term_id: string; formula_method: string; decimal_places: number; require_all_components: boolean; created_by: string };

type Notice = { kind: "success" | "error" | "info"; text: string };

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string }[] = [
  { value: "quiz", label: "Quiz" },
  { value: "laboratory", label: "Laboratory" },
  { value: "project", label: "Project" },
  { value: "exam", label: "Examination" },
  { value: "summative", label: "Summative" },
  { value: "other", label: "Other" },
];
const STATUS_LABELS: Record<GradeStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting Review",
  approved: "Approved",
  published: "Published",
  returned: "Returned for Revision",
};
const STATUS_CLASSES: Record<GradeStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  published: "bg-violet-50 text-violet-700",
  returned: "bg-rose-50 text-rose-700",
};
const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "An unexpected error occurred. Please try again.";
}

function typeLabel(type: AssignmentType) {
  return ASSIGNMENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

export default function FacultyGradeManagementPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [settings, setSettings] = useState<SettingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"scores" | "assessments" | "components">("scores");

  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState<AssignmentType>("quiz");
  const [assessmentMax, setAssessmentMax] = useState("20");
  const [assessmentDue, setAssessmentDue] = useState("");
  const [assessmentDescription, setAssessmentDescription] = useState("");

  const [componentName, setComponentName] = useState("");
  const [componentType, setComponentType] = useState<AssignmentType>("quiz");
  const [componentWeight, setComponentWeight] = useState("20");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [requireAllComponents, setRequireAllComponents] = useState(true);

  const [scoreAssignmentId, setScoreAssignmentId] = useState("");
  const [scoreStudentId, setScoreStudentId] = useState("");
  const [scoreValue, setScoreValue] = useState("");
  const [scoreFeedback, setScoreFeedback] = useState("");

  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? null;
  const selectedAssignment = assignments.find((item) => item.id === scoreAssignmentId) ?? null;
  const totalWeight = components.reduce((total, component) => total + Number(component.weight_percent), 0);

  const loadPage = useCallback(async (classId?: string) => {
    setLoading(true);
    setNotice(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again to manage grades.");
      setUserId(authData.user.id);

      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("id,course_id,term_id,faculty_id,section,room,schedule_text,is_active,courses(course_code,title,units),academic_terms(academic_year,term_name,status)")
        .eq("faculty_id", authData.user.id)
        .order("created_at", { ascending: false });
      if (classError) throw classError;
      const classRows = (classData ?? []) as unknown as ClassRow[];
      setClasses(classRows);

      const nextClassId = classId && classRows.some((item) => item.id === classId)
        ? classId
        : classRows[0]?.id ?? "";
      setSelectedClassId(nextClassId);

      if (!nextClassId) {
        setStudents([]); setAssignments([]); setComponents([]); setScores([]); setGrades([]); setSettings(null);
        return;
      }

      const chosenClass = classRows.find((item) => item.id === nextClassId);
      const [enrollmentResult, assignmentResult, componentResult, settingResult] = await Promise.all([
        supabase.from("enrollments").select("student_id,profiles:profiles!enrollments_student_id_fkey(id,full_name,institutional_email)").eq("class_id", nextClassId).eq("is_active", true),
        supabase.from("assignments").select("id,class_id,title,description,assignment_type,max_score,due_at,is_published").eq("class_id", nextClassId).order("created_at", { ascending: false }),
        supabase.from("grade_components").select("id,class_id,name,assignment_type,weight_percent").eq("class_id", nextClassId).order("created_at", { ascending: true }),
        chosenClass ? supabase.from("grade_calculation_settings").select("id,class_id,term_id,formula_method,decimal_places,require_all_components,created_by").eq("class_id", nextClassId).eq("term_id", chosenClass.term_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (enrollmentResult.error) throw enrollmentResult.error;
      if (assignmentResult.error) throw assignmentResult.error;
      if (componentResult.error) throw componentResult.error;
      if (settingResult.error) throw settingResult.error;

      const studentRows: StudentRow[] = (enrollmentResult.data ?? []).flatMap((row: any) => row.profiles ? [{ id: row.profiles.id, full_name: row.profiles.full_name, institutional_email: row.profiles.institutional_email }] : []);
      setStudents(studentRows);
      setAssignments((assignmentResult.data ?? []) as AssignmentRow[]);
      setComponents((componentResult.data ?? []) as ComponentRow[]);
      const loadedSettings = (settingResult.data ?? null) as SettingRow | null;
      setSettings(loadedSettings);
      setDecimalPlaces(String(loadedSettings?.decimal_places ?? 2));
      setRequireAllComponents(loadedSettings?.require_all_components ?? true);

      const assignmentIds = (assignmentResult.data ?? []).map((item: any) => item.id as string);
      const [scoreResult, gradeResult] = await Promise.all([
        assignmentIds.length ? supabase.from("assessment_scores").select("id,assignment_id,student_id,score,feedback,graded_by").in("assignment_id", assignmentIds) : Promise.resolve({ data: [], error: null }),
        supabase.from("grades").select("id,class_id,student_id,term_id,raw_score,final_grade,status,faculty_notes,created_by").eq("class_id", nextClassId).eq("term_id", chosenClass?.term_id ?? "00000000-0000-0000-0000-000000000000"),
      ]);
      if (scoreResult.error) throw scoreResult.error;
      if (gradeResult.error) throw gradeResult.error;
      setScores((scoreResult.data ?? []) as ScoreRow[]);
      setGrades((gradeResult.data ?? []) as GradeRow[]);
      setScoreAssignmentId((current) => assignmentIds.includes(current) ? current : assignmentIds[0] ?? "");
      setScoreStudentId((current) => studentRows.some((item) => item.id === current) ? current : studentRows[0]?.id ?? "");
    } catch (error) {
      setNotice({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadPage(); }, [loadPage]);

  const filteredGrades = useMemo(() => {
    const query = search.trim().toLowerCase();
    return grades.filter((grade) => {
      const student = students.find((item) => item.id === grade.student_id);
      const studentName = student?.full_name ?? "Unknown student";
      const classLabel = `${selectedClass?.courses?.course_code ?? ""} ${selectedClass?.section ?? ""}`;
      const matchesSearch = !query || `${studentName} ${classLabel}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || grade.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [grades, students, selectedClass, search, statusFilter]);

  const showNotice = (kind: Notice["kind"], text: string) => setNotice({ kind, text });

  async function createAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClass || !userId) return;
    const maxScore = Number(assessmentMax);
    if (!assessmentTitle.trim() || !Number.isFinite(maxScore) || maxScore <= 0) {
      showNotice("error", "Enter an assessment title and a maximum score greater than zero.");
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.from("assignments").insert({
        class_id: selectedClass.id,
        created_by: userId,
        title: assessmentTitle.trim(),
        description: assessmentDescription.trim() || null,
        assignment_type: assessmentType,
        max_score: maxScore,
        due_at: assessmentDue ? new Date(assessmentDue).toISOString() : null,
        is_published: false,
      });
      if (error) throw error;
      setAssessmentTitle(""); setAssessmentDescription(""); setAssessmentMax("20"); setAssessmentDue("");
      showNotice("success", "Assessment created successfully.");
      await loadPage(selectedClass.id);
      setActiveTab("assessments");
    } catch (error) { showNotice("error", getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function saveComponent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClass || !userId) return;
    const weight = Number(componentWeight);
    if (!componentName.trim() || !Number.isFinite(weight) || weight <= 0 || weight > 100) {
      showNotice("error", "Enter a component name and a weight greater than 0 and no more than 100.");
      return;
    }
    if (components.some((item) => item.assignment_type === componentType)) {
      showNotice("error", "A component already exists for this assessment type in this class. Edit the existing component instead of adding a duplicate.");
      return;
    }
    if (totalWeight + weight > 100) {
      showNotice("error", `The component weights cannot exceed 100%. Current total: ${totalWeight.toFixed(2)}%.`);
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.from("grade_components").insert({
        class_id: selectedClass.id,
        created_by: userId,
        name: componentName.trim(),
        assignment_type: componentType,
        weight_percent: weight,
      });
      if (error) throw error;
      setComponentName("");
      showNotice("success", "Grading component added. Configure weights so their total equals exactly 100% before calculating final grades.");
      await loadPage(selectedClass.id);
    } catch (error) { showNotice("error", getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function updateComponentWeight(component: ComponentRow, nextWeight: string) {
    if (!selectedClass) return;
    const weight = Number(nextWeight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
      showNotice("error", "Component weight must be greater than 0 and no more than 100.");
      return;
    }
    const otherTotal = components.filter((item) => item.id !== component.id).reduce((sum, item) => sum + Number(item.weight_percent), 0);
    if (otherTotal + weight > 100) {
      showNotice("error", `Component weights cannot exceed 100%. Other components total ${otherTotal.toFixed(2)}%.`);
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.from("grade_components").update({ weight_percent: weight }).eq("id", component.id).eq("class_id", selectedClass.id);
      if (error) throw error;
      showNotice("success", "Component weight updated. Ensure all weights total exactly 100% before calculating grades.");
      await loadPage(selectedClass.id);
    } catch (error) { showNotice("error", getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClass || !userId) return;
    const places = Number(decimalPlaces);
    if (!Number.isInteger(places) || places < 0 || places > 4) {
      showNotice("error", "Decimal precision must be an integer from 0 to 4.");
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.from("grade_calculation_settings").upsert({
        class_id: selectedClass.id,
        term_id: selectedClass.term_id,
        formula_method: "weighted_category_average",
        decimal_places: places,
        require_all_components: requireAllComponents,
        created_by: userId,
      }, { onConflict: "class_id,term_id" });
      if (error) throw error;
      showNotice("success", "Grading calculation settings saved.");
      await loadPage(selectedClass.id);
    } catch (error) { showNotice("error", getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function saveScore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClass || !selectedAssignment || !scoreStudentId || !userId) {
      showNotice("error", "Select a class, assessment, and student first.");
      return;
    }
    const scoreNumber = Number(scoreValue);
    if (!Number.isFinite(scoreNumber) || scoreNumber < 0 || scoreNumber > Number(selectedAssignment.max_score)) {
      showNotice("error", `Score must be between 0 and ${selectedAssignment.max_score}.`);
      return;
    }
    const existingGradeForStudent = grades.find((grade) => grade.student_id === scoreStudentId);
    if (existingGradeForStudent && !["draft", "returned"].includes(existingGradeForStudent.status)) {
      showNotice("error", "This student's grade has already been submitted, approved, or published. Follow the authorized return/revision workflow before changing assessment scores.");
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const { error: scoreError } = await supabase.from("assessment_scores").upsert({
        assignment_id: selectedAssignment.id,
        student_id: scoreStudentId,
        score: scoreNumber,
        feedback: scoreFeedback.trim() || null,
        graded_by: userId,
      }, { onConflict: "assignment_id,student_id" });
      if (scoreError) throw scoreError;

      const { data: calculated, error: calculationError } = await supabase.rpc("calculate_student_final_grade", {
        p_class_id: selectedClass.id,
        p_student_id: scoreStudentId,
        p_term_id: selectedClass.term_id,
      });
      if (calculationError) throw calculationError;
      const calculatedValue = calculated === null ? null : Number(calculated);
      const existingGrade = grades.find((grade) => grade.student_id === scoreStudentId);
      const gradePayload = {
        class_id: selectedClass.id,
        student_id: scoreStudentId,
        term_id: selectedClass.term_id,
        raw_score: calculatedValue,
        final_grade: calculatedValue,
        status: (existingGrade?.status === "submitted" || existingGrade?.status === "approved" || existingGrade?.status === "published") ? existingGrade.status : "draft",
        created_by: existingGrade?.created_by ?? userId,
      };
      const { error: gradeError } = await supabase.from("grades").upsert(gradePayload, { onConflict: "class_id,student_id,term_id" });
      if (gradeError) throw gradeError;
      setScoreValue(""); setScoreFeedback("");
      showNotice("success", calculatedValue === null
        ? "Assessment score saved. A final grade is not available yet because one or more required components have no scored assessments."
        : `Assessment score saved. Current calculated final grade: ${calculatedValue.toFixed(Number(decimalPlaces))}.`);
      await loadPage(selectedClass.id);
    } catch (error) { showNotice("error", getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function submitGrade(grade: GradeRow) {
    if (!selectedClass || grade.final_grade === null) {
      showNotice("error", "This grade cannot be submitted until all required grading components have scores and a final grade can be calculated.");
      return;
    }
    if (totalWeight !== 100) {
      showNotice("error", `Component weights must total exactly 100%. Current total: ${totalWeight.toFixed(2)}%.`);
      return;
    }
    if (grade.status !== "draft" && grade.status !== "returned") {
      showNotice("error", "Only draft or returned grades can be submitted for review.");
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.from("grades").update({ status: "submitted" }).eq("id", grade.id);
      if (error) throw error;
      showNotice("success", "Grade submitted for review.");
      await loadPage(selectedClass.id);
    } catch (error) { showNotice("error", getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function recalculateGrade(studentId: string) {
    if (!selectedClass || !userId) return;
    setBusy(true); setNotice(null);
    try {
      const { data: calculated, error } = await supabase.rpc("calculate_student_final_grade", {
        p_class_id: selectedClass.id,
        p_student_id: studentId,
        p_term_id: selectedClass.term_id,
      });
      if (error) throw error;
      const existing = grades.find((grade) => grade.student_id === studentId);
      if (existing && existing.status !== "draft" && existing.status !== "returned") {
        showNotice("error", "This grade has already been submitted, approved, or published. Do not recalculate it here; follow the authorized return/revision workflow.");
        return;
      }
      const value = calculated === null ? null : Number(calculated);
      const { error: saveError } = await supabase.from("grades").upsert({
        class_id: selectedClass.id,
        student_id: studentId,
        term_id: selectedClass.term_id,
        raw_score: value,
        final_grade: value,
        status: existing?.status === "returned" ? "returned" : "draft",
        created_by: existing?.created_by ?? userId,
      }, { onConflict: "class_id,student_id,term_id" });
      if (saveError) throw saveError;
      showNotice("success", value === null ? "Calculation is incomplete. Add scores for each required component." : `Draft grade recalculated: ${value.toFixed(Number(decimalPlaces))}.`);
      await loadPage(selectedClass.id);
    } catch (error) { showNotice("error", getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  const draftCount = grades.filter((item) => item.status === "draft" || item.status === "returned").length;
  const submittedCount = grades.filter((item) => item.status === "submitted").length;
  const publishedCount = grades.filter((item) => item.status === "published").length;

  return (
    <main className="min-h-full bg-slate-50/80 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-sky-700">Faculty Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Grade Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Configure assessment weights, record student scores, calculate final grades, and submit completed grades for review.</p>
          </div>
          <button type="button" onClick={() => void loadPage(selectedClassId)} disabled={loading || busy} className={secondaryButtonClass}><RefreshCw size={16} /> Refresh data</button>
        </header>

        {notice && <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${notice.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
          {notice.kind === "error" ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}{notice.text}
        </div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Grade records", value: String(grades.length), detail: "For the selected class and term", icon: ClipboardList, tone: "bg-sky-50 text-sky-700" },
            { label: "Draft / returned", value: String(draftCount), detail: "Not currently awaiting approval", icon: Clock3, tone: "bg-amber-50 text-amber-700" },
            { label: "Awaiting review", value: String(submittedCount), detail: "Submitted for approval", icon: FileCheck2, tone: "bg-blue-50 text-blue-700" },
            { label: "Published", value: String(publishedCount), detail: "Released to students", icon: GraduationCap, tone: "bg-emerald-50 text-emerald-700" },
          ].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-600">{card.label}</p><p className="mt-3 text-3xl font-semibold text-slate-950">{card.value}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon size={19} /></span></div><p className="mt-3 text-xs text-slate-500">{card.detail}</p></article>; })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div><h2 className="text-lg font-semibold text-slate-950">Class and academic term</h2><p className="mt-1 text-sm text-slate-500">Only classes assigned to your signed-in faculty account are shown.</p></div>
            <label className="block w-full md:max-w-xl"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned class</span><select className={inputClass} value={selectedClassId} onChange={(event) => { setSelectedClassId(event.target.value); void loadPage(event.target.value); }} disabled={loading || classes.length === 0}><option value="">{loading ? "Loading classes…" : classes.length ? "Select a class" : "No assigned classes found"}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.courses?.course_code} — {item.courses?.title} · {item.section} · {item.academic_terms?.term_name} {item.academic_terms?.academic_year}</option>)}</select></label>
          </div>
          {selectedClass && <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-slate-500">Course</p><p className="mt-1 font-semibold text-slate-900">{selectedClass.courses?.title ?? "Course"} ({selectedClass.courses?.course_code ?? "—"})</p></div><div><p className="text-xs text-slate-500">Section</p><p className="mt-1 font-semibold text-slate-900">{selectedClass.section}</p></div><div><p className="text-xs text-slate-500">Academic term</p><p className="mt-1 font-semibold text-slate-900">{selectedClass.academic_terms?.term_name} · {selectedClass.academic_terms?.academic_year}</p></div></div>}
        </section>

        {loading ? <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-14 text-sm text-slate-600"><LoaderCircle className="animate-spin" size={20} /> Loading grade data…</div> : !selectedClass ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><BookOpen className="mx-auto text-slate-400" size={28} /><h2 className="mt-3 font-semibold text-slate-900">No assigned classes</h2><p className="mt-1 text-sm text-slate-500">An administrator or registrar must assign a class to your faculty account first.</p></div> : <>
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="text-lg font-semibold text-slate-950">Gradebook</h2><p className="mt-1 text-sm text-slate-500">Student grades for {selectedClass.courses?.course_code} · {selectedClass.section}.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student" /><select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70">{["Student", "Class / section", "Final grade", "Status", "Action"].map((label) => <th key={label} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>)}</tr></thead><tbody>
              {filteredGrades.length ? filteredGrades.map((grade) => { const student = students.find((item) => item.id === grade.student_id); return <tr key={grade.id} className="border-b border-slate-100 last:border-0"><td className="px-5 py-4"><p className="font-semibold text-slate-900">{student?.full_name ?? "Unknown student"}</p><p className="mt-1 text-xs text-slate-500">{student?.institutional_email ?? ""}</p></td><td className="px-5 py-4 text-sm text-slate-600">{selectedClass.courses?.course_code} · {selectedClass.section}</td><td className="px-5 py-4 font-semibold text-slate-900">{grade.final_grade === null ? "Incomplete" : Number(grade.final_grade).toFixed(Number(decimalPlaces))}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_CLASSES[grade.status]}`}>{STATUS_LABELS[grade.status]}</span></td><td className="px-5 py-4"><div className="flex flex-wrap gap-2">{(grade.status === "draft" || grade.status === "returned") && <button className={secondaryButtonClass} type="button" disabled={busy || grade.final_grade === null} onClick={() => void submitGrade(grade)}><Send size={14} /> Submit</button>}<button className={secondaryButtonClass} type="button" disabled={busy || (grade.status !== "draft" && grade.status !== "returned")} onClick={() => void recalculateGrade(grade.student_id)}>Recalculate</button></div></td></tr>; }) : <tr><td colSpan={5} className="px-5 py-14 text-center"><Users size={25} className="mx-auto text-slate-400" /><p className="mt-3 font-semibold text-slate-900">No grade records found</p><p className="mt-1 text-sm text-slate-500">Save an assessment score to create a draft grade record.</p></td></tr>}
            </tbody></table></div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing {filteredGrades.length} of {grades.length} grade records · {students.length} active enrolled students</div>
          </section>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Grade management tools">
            {[{ id: "scores", label: "Enter student scores" }, { id: "assessments", label: "Assessments" }, { id: "components", label: "Grading formula" }].map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${activeTab === tab.id ? "border-sky-700 bg-sky-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{tab.label}</button>)}
          </div>

          {activeTab === "scores" && <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <form onSubmit={saveScore} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-lg font-semibold text-slate-950">Record assessment score</h2><p className="mt-1 text-sm text-slate-500">Scores are saved per student and assessment. Maximum score validation is enforced by the database.</p></div>
              <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Assessment</span><select className={inputClass} value={scoreAssignmentId} onChange={(event) => { setScoreAssignmentId(event.target.value); setScoreValue(""); }} required><option value="">Select assessment</option>{assignments.map((item) => <option key={item.id} value={item.id}>{item.title} · {typeLabel(item.assignment_type)} · max {item.max_score}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Student</span><select className={inputClass} value={scoreStudentId} onChange={(event) => setScoreStudentId(event.target.value)} required><option value="">Select enrolled student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}{student.institutional_email ? ` · ${student.institutional_email}` : ""}</option>)}</select></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Score</span><input className={inputClass} type="number" min="0" max={selectedAssignment?.max_score ?? undefined} step="0.01" value={scoreValue} onChange={(event) => setScoreValue(event.target.value)} placeholder={selectedAssignment ? `0–${selectedAssignment.max_score}` : "Select assessment first"} required /></label><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Maximum score</p><p className="mt-1 text-lg font-semibold text-slate-900">{selectedAssignment?.max_score ?? "—"}</p><p className="text-xs text-slate-500">{selectedAssignment ? typeLabel(selectedAssignment.assignment_type) : "Choose an assessment"}</p></div></div>
              <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Feedback (optional)</span><textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" value={scoreFeedback} onChange={(event) => setScoreFeedback(event.target.value)} placeholder="Feedback for this assessment" /></label>
              <button className={buttonClass} type="submit" disabled={busy || !assignments.length || !students.length}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} Save score and update draft grade</button>
            </form>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-950">Recent recorded scores</h2><p className="mt-1 text-sm text-slate-500">Scores already stored for this class.</p><div className="mt-4 space-y-3">{scores.length ? scores.slice(0, 12).map((score) => { const assignment = assignments.find((item) => item.id === score.assignment_id); const student = students.find((item) => item.id === score.student_id); return <div key={score.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{student?.full_name ?? "Unknown student"}</p><p className="mt-1 truncate text-xs text-slate-500">{assignment?.title ?? "Assessment"}</p>{score.feedback && <p className="mt-1 text-xs text-slate-500">{score.feedback}</p>}</div><span className="shrink-0 rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">{Number(score.score)} / {assignment?.max_score ?? "—"}</span></div>; }) : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No assessment scores have been recorded for this class yet.</div>}</div></section>
          </section>}

          {activeTab === "assessments" && <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
            <form onSubmit={createAssessment} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-lg font-semibold text-slate-950">Create assessment</h2><p className="mt-1 text-sm text-slate-500">Add an assessment for this class. It is created as unpublished.</p></div><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Assessment title</span><input className={inputClass} value={assessmentTitle} onChange={(event) => setAssessmentTitle(event.target.value)} placeholder="e.g. Quiz 1" required maxLength={180} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Type</span><select className={inputClass} value={assessmentType} onChange={(event) => setAssessmentType(event.target.value as AssignmentType)}>{ASSIGNMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Maximum score</span><input className={inputClass} type="number" min="0.01" step="0.01" value={assessmentMax} onChange={(event) => setAssessmentMax(event.target.value)} required /></label></div><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Due date (optional)</span><input className={inputClass} type="datetime-local" value={assessmentDue} onChange={(event) => setAssessmentDue(event.target.value)} /></label><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Description (optional)</span><textarea className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" value={assessmentDescription} onChange={(event) => setAssessmentDescription(event.target.value)} /></label><button className={buttonClass} type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Create assessment</button></form>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-950">Assessments in this class</h2><p className="mt-1 text-sm text-slate-500">Each assessment's type maps to a weighted grading component.</p><div className="mt-4 space-y-3">{assignments.length ? assignments.map((assignment) => <article key={assignment.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{assignment.title}</h3><p className="mt-1 text-xs text-slate-500">{typeLabel(assignment.assignment_type)} · maximum {assignment.max_score}{assignment.due_at ? ` · due ${new Date(assignment.due_at).toLocaleString()}` : ""}</p>{assignment.description && <p className="mt-2 text-sm text-slate-600">{assignment.description}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${assignment.is_published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{assignment.is_published ? "Published" : "Draft"}</span></div></article>) : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No assessments created yet. Create one to begin recording scores.</div>}</div></div>
          </section>}

          {activeTab === "components" && <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
            <div className="space-y-5"><form onSubmit={saveComponent} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-lg font-semibold text-slate-950">Add grading component</h2><p className="mt-1 text-sm text-slate-500">Each assessment type can have one weighted component per class.</p></div><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Component name</span><input className={inputClass} value={componentName} onChange={(event) => setComponentName(event.target.value)} placeholder="e.g. Quizzes" required maxLength={100} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Assessment type</span><select className={inputClass} value={componentType} onChange={(event) => setComponentType(event.target.value as AssignmentType)}>{ASSIGNMENT_TYPES.filter((item) => !components.some((component) => component.assignment_type === item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Weight (%)</span><input className={inputClass} type="number" min="0.01" max="100" step="0.01" value={componentWeight} onChange={(event) => setComponentWeight(event.target.value)} required /></label></div><p className="text-xs text-slate-500">Current configured total: <strong className={totalWeight === 100 ? "text-emerald-700" : "text-amber-700"}>{totalWeight.toFixed(2)}%</strong></p><button className={buttonClass} type="submit" disabled={busy || components.length >= ASSIGNMENT_TYPES.length || Number(componentWeight) + totalWeight > 100}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Add component</button></form>
              <form onSubmit={saveSettings} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Settings2 size={19} className="text-sky-700" /><h2 className="text-lg font-semibold text-slate-950">Calculation settings</h2></div><div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><p className="font-semibold">Weighted category average</p><p className="mt-1 text-xs leading-5 text-slate-500">For each component: average the scored assessment percentages, multiply by the component weight, then sum the weighted contributions.</p></div><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Decimal places</span><select className={inputClass} value={decimalPlaces} onChange={(event) => setDecimalPlaces(event.target.value)}>{[0, 1, 2, 3, 4].map((value) => <option key={value} value={value}>{value} decimal place{value === 1 ? "" : "s"}</option>)}</select></label><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><input className="mt-1 h-4 w-4 accent-sky-700" type="checkbox" checked={requireAllComponents} onChange={(event) => setRequireAllComponents(event.target.checked)} /><span><span className="block text-sm font-medium text-slate-800">Require scores in all components</span><span className="mt-1 block text-xs leading-5 text-slate-500">When enabled, the database will not return a final grade until every configured component has at least one scored assessment for the student.</span></span></label><button className={buttonClass} type="submit" disabled={busy}><Save size={16} /> Save calculation settings</button></form></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950">Configured grading formula</h2><p className="mt-1 text-sm text-slate-500">Weights must total exactly 100% before a grade can be calculated.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${totalWeight === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{totalWeight.toFixed(2)}% / 100%</span></div><div className="mt-5 space-y-3">{components.length ? components.map((component) => <div key={component.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">{component.name}</p><p className="mt-1 text-xs text-slate-500">Assessment type: {typeLabel(component.assignment_type)}</p></div><div className="flex items-center gap-2"><input aria-label={`${component.name} weight percentage`} className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm" type="number" min="0.01" max="100" step="0.01" defaultValue={Number(component.weight_percent)} id={`weight-${component.id}`} /><span className="text-sm font-semibold text-sky-800">%</span><button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => { const field = document.getElementById(`weight-${component.id}`) as HTMLInputElement | null; if (field) void updateComponentWeight(component, field.value); }}>Save</button></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(100, Number(component.weight_percent))}%` }} /></div></div>) : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No grading components configured. Add categories and weights.</div>}</div><div className="mt-5 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><p className="font-semibold">Formula</p><p className="mt-1">Final grade = Σ (average assessment percentage for each component × component weight ÷ 100).</p><p className="mt-2 text-xs">Assessment percentage = (student score ÷ assessment maximum score) × 100. The database function performs the calculation and applies the configured decimal precision.</p></div><div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>Current database function requires the configured component weights to total exactly 100%. If required components have no scored assessments, it returns no final grade. Scores do not automatically publish assignments.</p></div></div>
          </section>}
        </>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><ClipboardList size={19} /></span><div><h2 className="font-semibold text-slate-950">Grade workflow and safeguards</h2><p className="mt-1 text-sm leading-6 text-slate-600">Assessment scores update a draft grade through the database calculation function. Only draft or returned grades with a complete calculated result and 100% component weights can be submitted for review. Approval and publication remain separate authorized steps.</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(STATUS_LABELS).map(([status, label]) => <span key={status} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_CLASSES[status as GradeStatus]}`}>{label}</span>)}</div></div></div></section>
      </div>
    </main>
  );
}
