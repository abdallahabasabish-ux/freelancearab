import { NextResponse } from "next/server";
import { createSessionCookie, clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };

  if (!token) {
    await clearSessionCookie();
    return NextResponse.json({ ok: true, cleared: true });
  }
  try {
    await createSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }
}
