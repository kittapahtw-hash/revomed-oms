import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { HttpError } from "./auth";

const WINDOW_MIN = 15;   // นับย้อนหลัง 15 นาที
const MAX_FAIL = 8;      // ผิดเกิน 8 ครั้ง = ล็อก
const LOCK_MIN = 15;     // ล็อกนาน 15 นาที

/** ผิดกี่ครั้งแล้วในหน้าต่างเวลา */
async function failCount(key: string) {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), eq(loginAttempts.ok, false), gte(loginAttempts.ts, since)));
  return r?.n ?? 0;
}

/** เรียกก่อนเช็ครหัสผ่าน — โยน 429 ถ้าโดนล็อก */
export async function assertNotLocked(username: string, ip: string) {
  for (const key of [`user:${username}`, `ip:${ip}`]) {
    const n = await failCount(key);
    if (n >= MAX_FAIL) {
      throw new HttpError(429,
        `ใส่รหัสผิดเกิน ${MAX_FAIL} ครั้ง — ล็อกชั่วคราว ${LOCK_MIN} นาที ` +
        `ถ้าลืมรหัสให้ติดต่อ Admin`);
    }
  }
}

export async function recordAttempt(username: string, ip: string, ok: boolean) {
  await db.insert(loginAttempts).values([
    { key: `user:${username}`, ok },
    { key: `ip:${ip}`, ok },
  ]);

  // ล็อกอินสำเร็จ = ล้างประวัติผิดของ user นั้น (จะได้ไม่โดนล็อกจากของเก่า)
  if (ok) {
    await db.delete(loginAttempts).where(
      and(eq(loginAttempts.key, `user:${username}`), eq(loginAttempts.ok, false))
    );
  }

  // เก็บกวาดของเก่า (24 ชม.) — ไม่ให้ตารางบวม
  if (Math.random() < 0.05) {
    await db.delete(loginAttempts)
      .where(sql`${loginAttempts.ts} < now() - interval '24 hours'`);
  }
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown"
  );
}
