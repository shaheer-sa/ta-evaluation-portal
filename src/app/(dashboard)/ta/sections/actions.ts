"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createSection(formData: FormData) {
  const supabase = await createClient();
  const termId = formData.get("termId") as string;
  const name = formData.get("name") as string; // e.g. "A", "B"

  const { error } = await supabase
    .from("sections")
    .insert({ term_id: termId, name });

  if (error) throw new Error(error.message);
  revalidatePath("/ta/sections");
}

export async function linkCourseToSection(formData: FormData) {
  const supabase = await createClient();
  const sectionId = formData.get("sectionId") as string;
  const courseId = formData.get("courseId") as string;

  const { error } = await supabase
    .from("section_courses")
    .insert({ section_id: sectionId, course_id: courseId });

  // 23505 is unique violation (if it's already linked)
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath("/ta/sections");
}
