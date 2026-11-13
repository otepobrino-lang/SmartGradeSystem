import { NextResponse } from "next/server";
import { authorizeAdmin, isAuthorizationError, isUuid } from "@/lib/authorize-admin";

type RouteContext = { params: Promise<{ id: string; enrollmentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await authorizeAdmin();
    if (isAuthorizationError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id, enrollmentId } = await context.params;
    if (!isUuid(id) || !isUuid(enrollmentId)) {
      return NextResponse.json({ error: "Invalid student or enrollment ID." }, { status: 400 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body) ||
        typeof (body as Record<string, unknown>).is_active !== "boolean") {
      return NextResponse.json({ error: "Provide a valid is_active boolean value." }, { status: 400 });
    }
    const isActive = (body as { is_active: boolean }).is_active;

    const { data: enrollment, error: lookupError } = await auth.admin
      .from("enrollments")
      .select("id, student_id, class_id, is_active")
      .eq("id", enrollmentId)
      .eq("student_id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("Enrollment lookup failed:", lookupError.message);
      return NextResponse.json({ error: "Unable to find enrollment." }, { status: 500 });
    }
    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment record not found for this student." }, { status: 404 });
    }

    if (isActive) {
      const { data: student, error: studentError } = await auth.admin
        .from("profiles").select("is_active").eq("id", id).eq("role", "student").maybeSingle();
      if (studentError) {
        console.error("Enrollment student validation failed:", studentError.message);
        return NextResponse.json({ error: "Unable to verify student status." }, { status: 500 });
      }
      if (!student || !student.is_active) {
        return NextResponse.json({ error: "Reactivate the student account before reactivating enrollment." }, { status: 400 });
      }

      const { data: classRecord, error: classError } = await auth.admin
        .from("classes").select("is_active").eq("id", enrollment.class_id).maybeSingle();
      if (classError) {
        console.error("Enrollment class validation failed:", classError.message);
        return NextResponse.json({ error: "Unable to verify class status." }, { status: 500 });
      }
      if (!classRecord?.is_active) {
        return NextResponse.json({ error: "This class is inactive and its enrollment cannot be reactivated." }, { status: 400 });
      }

      const { data: duplicate, error: duplicateError } = await auth.admin
        .from("enrollments").select("id")
        .eq("student_id", id).eq("class_id", enrollment.class_id)
        .eq("is_active", true).neq("id", enrollmentId).maybeSingle();

      if (duplicateError) {
        console.error("Duplicate active enrollment check failed:", duplicateError.message);
        return NextResponse.json({ error: "Unable to verify duplicate enrollment." }, { status: 500 });
      }
      if (duplicate) {
        return NextResponse.json({ error: "Another active enrollment already exists for this student and class." }, { status: 409 });
      }
    }

    const { data, error } = await auth.admin.from("enrollments")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", enrollmentId).eq("student_id", id)
      .select("id, student_id, class_id, enrolled_at, is_active")
      .single();

    if (error) {
      console.error("Enrollment status update failed:", error.message);
      return NextResponse.json({ error: "Unable to update enrollment status." }, { status: 500 });
    }

    return NextResponse.json({
      message: `Enrollment ${isActive ? "reactivated" : "deactivated"} successfully.`,
      enrollment: data,
    });
  } catch (error) {
    console.error("Enrollment PATCH error:", error);
    return NextResponse.json({ error: "Unexpected error updating enrollment." }, { status: 500 });
  }
}
