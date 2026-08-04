"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const next = searchParams.get("next") ?? "/login";

    // Supabase browser client automatically processes hash fragments 
    // (#access_token=...) in the URL and sets the session on load!
    
    // We check if a session is present.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (session && !error) {
        // Successfully logged in via link, redirect to target
        router.push(next);
        router.refresh();
      } else {
        // If no session is found, it might be a PKCE code instead of a hash.
        const code = searchParams.get("code");
        if (code) {
          supabase.auth.exchangeCodeForSession(code).then(({ error: pkceError }) => {
            if (!pkceError) {
              router.push(next);
              router.refresh();
            } else {
              router.push("/login?error=auth_callback_failed");
            }
          });
        } else {
          router.push("/login?error=auth_callback_failed");
        }
      }
    });
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Verifying secure link...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying secure link...</p>
        </div>
      }>
        <AuthCallbackContent />
      </Suspense>
    </div>
  );
}
