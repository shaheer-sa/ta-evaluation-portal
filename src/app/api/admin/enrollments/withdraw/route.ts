import { NextRequest, NextResponse } from "next/server";
import { requireTA } from "@/lib/auth-guard";
import { z } from "zod";

const withdrawSchema = z.object({
  enrollmentIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(["withdrawn", "active"]),
});

export async function POST(req: NextRequest) {
  try {
    const { supabase } = await requireTA();
    
    const body = await req.json();
    const result = withdrawSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: result.error.errors },
        { status: 400 }
      );
    }
    
    const { enrollmentIds, status } = result.data;
    
    // In Supabase, update multiple rows using .in()
    const { data, error } = await supabase
      .from("enrollments")
      .update({
        status,
        withdrawn_at: status === "withdrawn" ? new Date().toISOString() : null,
      })
      .in("id", enrollmentIds)
      .select("id");
      
    if (error) {
      throw new Error(error.message);
    }
    
    return NextResponse.json({ success: true, updated: data?.length || 0 });
  } catch (error) {
    console.error("Error withdrawing/reactivating students:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
