import { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_SECURE } from "@/lib/auth-server";

/** POST /api/auth/logout — مسح كوكي الجلسة على الخادم */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, path: "/", maxAge: 0 });
  return res;
}
