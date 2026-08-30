"use server";

import { revalidatePath } from "next/cache";
import { requireTA } from "@/lib/auth-guard";
import { friendlyDbError } from "@/lib/db-errors";
import type { ActionResult } from "@/lib/action-result";

export async function createSection(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const termId = formData.get("termId") as string;
  const name = formData.get("name") as string; // e.g. "A", "B"

  const { error } = await supabase
    .from("sections")
    .insert({ term_id: termId, name });

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/sections");
  return { ok: true };
}

export async function updateSection(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const id = formData.get("id") as string;
  const termId = formData.get("termId") as string;
  const name = formData.get("name") as string;

  const { error } = await supabase
    .from("sections")
    .update({ term_id: termId, name })
    .eq("id", id);

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/sections");
  return { ok: true };
}

export async function deleteSection(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const id = formData.get("id") as string;

  const { error } = await supabase
    .from("sections")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/sections");
  return { ok: true };
}

export async function linkCourseToSection(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const sectionId = formData.get("sectionId") as string;
  const courseId = formData.get("courseId") as string;

  const { error } = await supabase
    .from("section_courses")
    .insert({ section_id: sectionId, course_id: courseId });

  // 23505 is unique violation (if it's already linked)
  if (error && error.code !== "23505") return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/sections");
  return { ok: true };
}

export async function unlinkCourseFromSection(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const id = formData.get("id") as string; // The section_courses ID

  const { error } = await supabase
    .from("section_courses")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/sections");
  return { ok: true };
}
