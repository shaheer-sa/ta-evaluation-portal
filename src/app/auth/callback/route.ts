import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/login';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    } else {
      console.error("Auth callback exchange error:", error);
    }
  }

  // Redirect to error page if something went wrong or no code was provided
  return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_failed`);
}
