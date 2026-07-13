import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const COOKIE = "oms_session";
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production")
      throw new Error("AUTH_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร");
    console.warn("⚠️  AUTH_SECRET สั้นเกินไป — โหมด dev เท่านั้น");
  }
  return new TextEncoder().encode(s || "dev-secret-change-me-please-32bytes!");
};

export type SessionUser = {
  username: string;
  name: string;
  email: string;
  admin: boolean;
  perms: Record<string, 0 | 1>;
};

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/* ---------- นโยบายรหัสผ่าน ---------- */
export const MIN_PASSWORD = 8;

export function checkPasswordStrength(p: string): string | null {
  if (p.length < MIN_PASSWORD) return `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`;
  if (!/[a-zA-Z]/.test(p)) return "รหัสผ่านต้องมีตัวอักษรอย่างน้อย 1 ตัว";
  if (!/[0-9]/.test(p)) return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
  if (WEAK.has(p.toLowerCase())) return "รหัสผ่านนี้เดาง่ายเกินไป — ห้ามใช้";
  return null;
}
const WEAK = new Set([
  "password", "password1", "12345678", "123456789", "qwerty123",
  "revomed1", "admin123", "11111111", "abcd1234", "p@ssw0rd",
]);

export const hashPassword = (p: string) => bcrypt.hashSync(p, 10);

/* ---------- session ---------- */
export async function verifyPassword(username: string, password: string): Promise<SessionUser | null> {
  const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!u) {
    bcrypt.compareSync(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
    return null;   // ทำ dummy compare กันจับเวลาเดาว่ามี username นี้ไหม
  }
  if (!bcrypt.compareSync(password, u.password)) return null;
  return { username: u.username, name: u.name, email: u.email, admin: u.admin, perms: u.perms || {} };
}

export async function createSession(user: SessionUser) {
  const [u] = await db.select({ v: users.tokenVersion }).from(users)
    .where(eq(users.username, user.username)).limit(1);

  const token = await new SignJWT({ ...user, v: u?.v ?? 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** เตะทุก session ของคนนี้ออกทันที (ลบ user / เปลี่ยนรหัส / ถอดสิทธิ์) */
export async function revokeSessions(username: string) {
  await db.update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.username, username));
}

/**
 * อ่าน session — verify ลายเซ็น แล้ว **เช็คกับ DB ว่า user ยังอยู่และ tokenVersion ยังตรง**
 * (JWT อย่างเดียว revoke ไม่ได้ — ไล่คนออกแล้วเขายังใช้ token เก่าได้อีก 8 ชม.)
 */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const username = String(payload.username);
    const v = Number(payload.v ?? 0);

    const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!u) return null;                    // ถูกลบไปแล้ว
    if (u.tokenVersion !== v) return null;   // ถูก revoke แล้ว

    // เอาสิทธิ์สดจาก DB — Admin ถอดสิทธิ์แล้วมีผลทันที ไม่ต้องรอ token หมดอายุ
    return {
      username: u.username, name: u.name, email: u.email,
      admin: u.admin, perms: u.perms || {},
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSession();
  if (!u) throw new HttpError(401, "ต้องล็อกอินก่อน (หรือ session หมดอายุ/ถูกยกเลิก)");
  return u;
}

export async function requirePerm(perm: string): Promise<SessionUser> {
  const u = await requireUser();
  if (!u.admin && u.perms?.[perm] !== 1) throw new HttpError(403, "ไม่มีสิทธิ์เข้าถึงส่วนนี้");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (!u.admin) throw new HttpError(403, "เฉพาะ Admin");
  return u;
}
