"use server";

import { revalidatePath } from "next/cache";
import { requireTA } from "@/lib/auth-guard";
import { friendlyDbError } from "@/lib/db-errors";
import type { ActionResult } from "@/lib/action-result";

export async function createTerm(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const name = formData.get("name") as string;
  const shouldActivate = formData.get("isActive") === "on";

  // Always insert as inactive. Activating a term is a separate,
  // transactional step (below) — the database only allows ONE active
  // term at a time (enforced by a unique index on terms.is_active),
  // so a raw insert with is_active: true would throw a raw constraint
  // violation the moment another term is already active. Going through
  // activate_term() deactivates the old term and activates the new one
  // atomically, and also logs the change to activity_logs.
  const { data: newTerm, error } = await supabase
    .from("terms")
    .insert({ name, is_active: false })
    .select("id")
    .single();

  if (error) return { ok: false, message: friendlyDbError(error) };

  if (shouldActivate && newTerm) {
    const { error: activateError } = await supabase.rpc("activate_term", {
      p_term_id: newTerm.id,
    });
    if (activateError) return { ok: false, message: activateError.message };
  }

  revalidatePath("/ta/courses");
  return { ok: true };
}

export async function updateTerm(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { ok: false, message: "Term name is required." };

  const { error } = await supabase.from("terms").update({ name }).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  // Only ever activate from here. Deactivation happens by activating another term.
  if (formData.get("isActive") === "on") {
    const { error: activateError } = await supabase.rpc("activate_term", { p_term_id: id });
    if (activateError) return { ok: false, message: activateError.message };
  }

  revalidatePath("/ta/courses");
  return { ok: true };
}

export async function deleteTerm(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const id = formData.get("id") as string;
  const { error } = await supabase.from("terms").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/courses");
  return { ok: true };
}

export async function createCourse(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const code = formData.get("code") as string;
  const name = formData.get("name") as string;

  const { error } = await supabase.from("courses").insert({
    code,
    name,
    enable_cp: formData.get("enableCp") === "on",
    enable_assignments: formData.get("enableAssignments") === "on",
    enable_quizzes: formData.get("enableQuizzes") === "on",
    enable_reeval: formData.get("enableReeval") === "on",
  });

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/courses");
  return { ok: true };
}

export async function updateCourse(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const id = formData.get("id") as string;
  const code = formData.get("code") as string;
  const name = formData.get("name") as string;

  const { error } = await supabase.from("courses").update({
    code,
    name,
    enable_cp: formData.get("enableCp") === "on",
    enable_assignments: formData.get("enableAssignments") === "on",
    enable_quizzes: formData.get("enableQuizzes") === "on",
    enable_reeval: formData.get("enableReeval") === "on",
  }).eq("id", id);

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/courses");
  return { ok: true };
}

export async function deleteCourse(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireTA();
  const id = formData.get("id") as string;
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/ta/courses");
  return { ok: true };
}
