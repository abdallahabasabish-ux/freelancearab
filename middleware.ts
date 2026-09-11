import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/utils/constants";

const ADMIN_ONLY = /^\/admin(\/|$)/;
const PROTECTED  = /^\/(dashboard|admin)(\/|$)/;
const AUTH_PAGES = /^\/(login|register|forgot-password)(\/|$)/;

/** نقرأ Custom Claim من التوكن دون تحقّق تشفيري هنا (Middleware سريع).
 *  التحقق النهائي يحدث في السيرفر (getSessionUser) وفي Firestore Rules. */
function decodeRole(token?: string): { isAdmin: boolean } {
  if (!token) return { isAdmin: false };
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64").toString("utf8")
    );
    return { isAdmin: payload.admin === true };
  } catch {
    return { isAdmin: false };
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isAuthed = Boolean(token);
  const { isAdmin } = decodeRole(token);

  // صفحات الدخول: لو مسجّل، ودّيه للوحة المناسبة
  if (AUTH_PAGES.test(pathname) && isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // حماية /dashboard و /admin
  if (PROTECTED.test(pathname) && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // /admin يتطلب أدمن
  if (ADMIN_ONLY.test(pathname) && !isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api|.*\\..*).*)"],
};
