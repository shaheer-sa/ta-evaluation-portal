"use server";

import { revalidatePath } from "next/cache";
import { requireTA } from "@/lib/auth-guard";

export async function createAssessment(formData: FormData) {
  const { supabase } = await requireTA();

  const sectionCourseId = formData.get("sectionCourseId") as string;
  const type = formData.get("type") as string;
  const title = formData.get("title") as string;
  const maxMarks = parseFloat(formData.get("maxMarks") as string);
  const weight = parseFloat(formData.get("weight") as string);

  const { error } = await supabase.from("assessments").insert({
    section_course_id: sectionCourseId,
    type,
    title,
    max_marks: maxMarks,
    weight,
  });

  if (error) throw new Error(error.message);
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
  const type = formData.get("type") as string;
  const title = formData.get("title") as string;
  const maxMarks = parseFloat(formData.get("maxMarks") as string);
  const weight = parseFloat(formData.get("weight") as string);

  const { error } = await supabase
    .from("assessments")
    .update({
      type,
      title,
      max_marks: maxMarks,
      weight,
    })
    .eq("id", assessmentId);

  if (error) throw new Error(error.message);
  revalidatePath("/ta/assessments");
}
