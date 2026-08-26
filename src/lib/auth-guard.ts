import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Asserts that the current request comes from an authenticated TA.
 *
 * Next.js Server Actions compile down to ordinary POST endpoints with
 * publicly discoverable IDs. They are NOT protected by `middleware.ts`,
 * which only guards page navigations. Before this guard existed, every
 * mutation in `/ta/**` (create term, create course, create/edit/delete
 * assessment, link a course to a section) was reachable by any signed-in
 * user -- including a student -- with a single fetch. Row Level Security
 * was the only thing standing in the way, and RLS was never checked into
 * the repo, so on a fresh Supabase project there was nothing at all.
 *
 * Call this first in every TA-only Server Action. Defense in depth: keep
 * the RLS policies in supabase/schema.sql as well.
 */
export async function requireTA() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You need to be signed in to do that.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "ta") {
    throw new Error("Only teaching assistants can perform this action.");
  }

  return { supabase: supabase as SupabaseClient<Database>, userId: user.id };
}

