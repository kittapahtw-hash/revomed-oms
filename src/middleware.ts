import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "oms_session";

/**
 * กันคนไม่ล็อกอินเข้าหน้าแอป — เช็คแค่ว่า "มี cookie มั้ย" (verify จริงทำใน layout/route ที่ต่อ DB ได้)
 *
 * ⚠️ ห้ามเด้ง /login → /home ที่นี่เด็ดขาด:
 *    middleware ไม่รู้ว่า cookie ยัง valid มั้ย (revoke/หมดอายุ/token version ไม่ตรง)
 *    ถ้าเด้ง = cookie เสีย → layout ตีกลับ /login → middleware เห็น cookie → เด้ง /home → วนไม่จบ
 *    (ERR_TOO_MANY_REDIRECTS)
 *    หน้า login เช็คเองว่าล็อกอินอยู่แล้วหรือยัง ผ่าน /api/auth/me ซึ่ง verify กับ DB จริง
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login")) return NextResponse.next();

  if (!req.cookies.has(COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
