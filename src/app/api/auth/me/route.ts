import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";

/** GET /api/auth/me → 200 { user } أو 401 (لا جلسة صالحة) */
export async function GET(req: NextRequest) {
  const sess = getSession(req);
  if (!sess) {
    return NextResponse.json({ error: "لا توجد جلسة صالحة" }, { status: 401 });
  }
  return NextResponse.json({
    user: { email: sess.email, displayName: sess.displayName, role: sess.role, exp: sess.exp },
  });
}
