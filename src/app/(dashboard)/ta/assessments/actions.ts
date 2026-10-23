"use server";

import { revalidatePath } from "next/cache";
import { requireTA } from "@/lib/auth-guard";
import { friendlyDbError } from "@/lib/db-errors";
import { ActionResult } from "@/lib/action-result";

export async function createAssessment(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();

  const sectionCourseId = formData.get("sectionCourseId") as string;
  const type = formData.get("type") as "assignment" | "quiz" | "cp";
  const title = (formData.get("title") as string)?.trim();
  const maxMarks = parseFloat(formData.get("maxMarks") as string);
  const weight = parseFloat(formData.get("weight") as string);

  if (!title) return { ok: false, message: "Title is required." };
  if (title.length > 100) return { ok: false, message: "Title must be 100 characters or fewer." };

  if (!sectionCourseId) return { ok: false, message: "Please select a class." };
  if (!["assignment", "quiz", "cp"].includes(type)) {
    return { ok: false, message: "Please select a valid assessment type." };
  }

  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    return { ok: false, message: "Total marks must be a number greater than 0." };
  }
  if (!Number.isFinite(weight) || weight < 0) {
    return { ok: false, message: "Weight must be 0 or more." };
  }

  const { error } = await supabase.from("assessments").insert({
    section_course_id: sectionCourseId,
    type,
    title,
    max_marks: maxMarks,
    weight,
  });

  if (error) return { ok: false, message: friendlyDbError(error, "assessment") };
  revalidatePaths();
  return { ok: true };
}

export async function deleteAssessment(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const assessmentId = formData.get("assessmentId") as string;

  const { error } = await supabase
    .from("assessments")
    .delete()
    .eq("id", assessmentId);

  if (error) return { ok: false, message: friendlyDbError(error, "assessment") };
  revalidatePaths();
  return { ok: true };
}

export async function updateAssessment(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();

  const assessmentId = formData.get("assessmentId") as string;
  const type = formData.get("type") as "assignment" | "quiz" | "cp";
  const title = (formData.get("title") as string)?.trim();
  const maxMarks = parseFloat(formData.get("maxMarks") as string);
  const weight = parseFloat(formData.get("weight") as string);

  if (!title) return { ok: false, message: "Title is required." };
  if (title.length > 100) return { ok: false, message: "Title must be 100 characters or fewer." };

  if (!["assignment", "quiz", "cp"].includes(type)) {
    return { ok: false, message: "Please select a valid assessment type." };
  }

  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    return { ok: false, message: "Total marks must be a number greater than 0." };
  }
  if (!Number.isFinite(weight) || weight < 0) {
    return { ok: false, message: "Weight must be 0 or more." };
  }

  const { count: overCount } = await supabase
    .from("marks")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId)
    .gt("score", maxMarks);

  if (overCount && overCount > 0) {
    return { ok: false, message: `Can't lower the maximum to ${maxMarks} — ${overCount} student(s) already have a higher score. Fix those marks first.` };
  }

  const { error } = await supabase
    .from("assessments")
    .update({
      type,
      title,
      max_marks: maxMarks,
      weight,
    })
    .eq("id", assessmentId);

  if (error) return { ok: false, message: friendlyDbError(error, "assessment") };
  revalidatePaths();
  return { ok: true };
}

export async function updateCategorySettings(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();

  const sectionCourseId = formData.get("sectionCourseId") as string;
  if (!sectionCourseId) return { ok: false, message: "Class is required." };

  const parseBestOf = (raw: FormDataEntryValue | null): { value: number | null; error?: string } => {
    const str = raw === null ? "" : String(raw).trim();
    if (str === "") return { value: null };
    const n = Number(str);
    if (!Number.isInteger(n) || n < 1) {
      return { value: null, error: "Best of must be a whole number of 1 or more, or empty." };
    }
    return { value: n };
  };

  const parseTotal = (raw: FormDataEntryValue | null): { value: number | null; error?: string } => {
    const str = raw === null ? "" : String(raw).trim();
    if (str === "") return { value: null };
    const n = Number(str);
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      return { value: null, error: "Total weight must be more than 0 and at most 100, or empty." };
    }
    return { value: n };
  };

  const update: {
    best_of_quizzes?: number | null;
    best_of_assignments?: number | null;
    quiz_total_weight?: number | null;
    assignment_total_weight?: number | null;
  } = {};

  // only touch the fields the form actually showed
  if (formData.has("bestOfQuizzes")) {
    const r = parseBestOf(formData.get("bestOfQuizzes"));
    if (r.error) return { ok: false, message: r.error };
    update.best_of_quizzes = r.value;
  }
  if (formData.has("bestOfAssignments")) {
    const r = parseBestOf(formData.get("bestOfAssignments"));
    if (r.error) return { ok: false, message: r.error };
    update.best_of_assignments = r.value;
  }
  if (formData.has("quizTotalWeight")) {
    const r = parseTotal(formData.get("quizTotalWeight"));
    if (r.error) return { ok: false, message: r.error };
    update.quiz_total_weight = r.value;
  }
  if (formData.has("assignmentTotalWeight")) {
    const r = parseTotal(formData.get("assignmentTotalWeight"));
    if (r.error) return { ok: false, message: r.error };
    update.assignment_total_weight = r.value;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  // the database recalculates every weight in this class after this update
  const { error } = await supabase
    .from("section_courses")
    .update(update)
    .eq("id", sectionCourseId);

  if (error) return { ok: false, message: friendlyDbError(error, "section_course") };

  revalidatePaths();
  return { ok: true };
}

// weights can change for the whole class, so refresh everything that shows them
function revalidatePaths() {
  revalidatePath("/ta/assessments", "layout");
  revalidatePath("/ta/analytics", "layout");
  revalidatePath("/student", "layout");
}
