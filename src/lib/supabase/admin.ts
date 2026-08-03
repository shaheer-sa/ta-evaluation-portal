import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client — uses the SERVICE_ROLE_KEY.
 *
 * SECURITY:
 *  - This client BYPASSES RLS on every query.
 *  - NEVER import this file in any client component or any file that
 *    gets bundled for the browser.
 *  - Only use in Route Handlers (route.ts) and Server Actions.
 *
 * Current uses:
 *  - Roll-number → email lookup during student login
 *  - CSV student import (creating auth accounts via Admin API)
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
