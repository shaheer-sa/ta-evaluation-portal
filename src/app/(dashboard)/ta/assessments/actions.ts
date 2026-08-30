"use server";

import { revalidatePath } from "next/cache";
import { requireTA } from "@/lib/auth-guard";
import { friendlyDbError } from "@/lib/db-errors";

export async function createAssessment(formData: FormData) {
  const { supabase } = await requireTA();

  const sectionCourseId = formData.get("sectionCourseId") as string;
  const type = formData.get("type") as "assignment" | "quiz" | "cp";
  const title = (formData.get("title") as string)?.trim();
  const maxMarks = parseFloat(formData.get("maxMarks") as string);
  const weight = parseFloat(formData.get("weight") as string);

  if (!title) throw new Error("Title is required.");
  if (title.length > 100) throw new Error("Title must be 100 characters or fewer.");

  if (!sectionCourseId) throw new Error("Please select a class.");
  if (!["assignment", "quiz", "cp"].includes(type)) {
    throw new Error("Please select a valid assessment type.");
  }

  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    throw new Error("Max marks must be a number greater than 0.");
  }
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error("Weight must be 0 or more.");
  }

  const { error } = await supabase.from("assessments").insert({
    section_course_id: sectionCourseId,
    type,
    title,
    max_marks: maxMarks,
    weight,
  });

  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/ta/assessments");
}

export async function deleteAssessment(formData: FormData) {
  const { supabase } = await requireTA();
  const assessmentId = formData.get("assessmentId") as string;

  // Delete related marks first, then the assessment
  await supabase.from("marks").delete().eq("assessment_id", assessmentId);
  const { error } = await supabase
    .from("assessments")
    .delete()
    .eq("id", assessmentId);

  if (error) throw new Error(error.message);
  revalidatePath("/ta/assessments");
}

export async function updateAssessment(formData: FormData) {
  const { supabase } = await requireTA();

  const assessmentId = formData.get("assessmentId") as string;
  const type = formData.get("type") as "assignment" | "quiz" | "cp";
  const title = (formData.get("title") as string)?.trim();
  const maxMarks = parseFloat(formData.get("maxMarks") as string);
  const weight = parseFloat(formData.get("weight") as string);

  if (!title) throw new Error("Title is required.");
  if (title.length > 100) throw new Error("Title must be 100 characters or fewer.");

  if (!["assignment", "quiz", "cp"].includes(type)) {
    throw new Error("Please select a valid assessment type.");
  }

  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    throw new Error("Max marks must be a number greater than 0.");
  }
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error("Weight must be 0 or more.");
  }

  const { count: overCount } = await supabase
    .from("marks")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId)
    .gt("score", maxMarks);

  if (overCount && overCount > 0) {
    throw new Error(
      `Can't lower the maximum to ${maxMarks} — ${overCount} student(s) already have a higher score. Fix those marks first.`
    );
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

  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/ta/assessments");
}
