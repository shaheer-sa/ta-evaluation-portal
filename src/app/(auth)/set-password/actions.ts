"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clearMustChangePasswordFlag() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Use the admin client to bypass RLS, because the current profiles_update_own
  // RLS policy prevents users from updating their own row without triggering
  // a potential recursion or silent failure on the role check.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to clear must_change_password flag:", error);
    throw new Error("Failed to update profile status.");
  }
}
