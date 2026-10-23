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
  revalidatePath("/ta/assessments");
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
  revalidatePath("/ta/assessments");
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
  revalidatePath("/ta/assessments");
  return { ok: true };
}

export async function updateBestOf(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();

  const sectionCourseId = formData.get("sectionCourseId") as string;
  if (!sectionCourseId) return { ok: false, message: "Class is required." };

  const rawQuiz = formData.get("bestOfQuizzes");
  const rawAssignment = formData.get("bestOfAssignments");

  const parseBestOf = (raw: FormDataEntryValue | null): { value: number | null; error?: string } => {
    if (raw === null || raw === undefined) return { value: null };
    const str = String(raw).trim();
    if (str === "") return { value: null };
    const n = Number(str);
    if (!Number.isInteger(n) || n < 1) {
      return { value: null, error: "Use a whole number of 1 or more, or leave it empty." };
    }
    return { value: n };
  };

  const quizResult = parseBestOf(rawQuiz);
  if (quizResult.error) return { ok: false, message: quizResult.error };

  const assignmentResult = parseBestOf(rawAssignment);
  if (assignmentResult.error) return { ok: false, message: assignmentResult.error };

  const { error } = await supabase
    .from("section_courses")
    .update({
      best_of_quizzes: quizResult.value,
      best_of_assignments: assignmentResult.value,
    })
    .eq("id", sectionCourseId);

  if (error) return { ok: false, message: friendlyDbError(error, "section_course") };

  revalidatePath("/ta/assessments");
  revalidatePath("/ta/analytics");
  revalidatePath("/student");
  return { ok: true };
}

