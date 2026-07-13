import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { checkPasswordStrength, hashPassword, requireAdmin, revokeSessions } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

const Body = z.object({
  username: z.string().min(1),
  name: z.string().min(1),
  email: z.string().default(""),
  admin: z.boolean().default(false),
  perms: z.record(z.union([z.literal(0), z.literal(1)])).default({}),
  newPassword: z.string().optional(),
});

/** upsert user (Admin เท่านั้น) — ไม่ตั้งรหัสใหม่ = คงรหัสเดิม */
export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const b = Body.parse(await req.json());
  const [exist] = await db.select().from(users).where(eq(users.username, b.username)).limit(1);
  if (b.newPassword) {
    const bad = checkPasswordStrength(b.newPassword);
    if (bad) return fail(400, bad);
  }
  if (!exist && !b.newPassword) return fail(400, "ต้องตั้งรหัสผ่านให้ผู้ใช้ใหม่");
  const password = b.newPassword ? hashPassword(b.newPassword) : exist!.password;

  await db.insert(users).values({
    username: b.username, name: b.name, email: b.email, admin: b.admin, perms: b.perms, password,
  }).onConflictDoUpdate({
    target: users.username,
    set: { name: b.name, email: b.email, admin: b.admin, perms: b.perms, password },
  });
  // แก้สิทธิ์ / เปลี่ยนรหัสให้คนอื่น = เตะ session เก่าออกทันที ไม่ต้องรอ 8 ชม.
  if (exist) await revokeSessions(b.username);

  await audit(me.username, "user.save", b.username);
  return ok({});
});

export const DELETE = handler(async (req: Request) => {
  const me = await requireAdmin();
  const { username } = z.object({ username: z.string() }).parse(await req.json());
  const admins = (await db.select().from(users).where(eq(users.admin, true)));
  if (admins.length <= 1 && admins[0]?.username === username)
    return fail(400, "ต้องมี Admin อย่างน้อย 1 คน");
  await revokeSessions(username);   // เตะออกก่อนลบ — token เก่าใช้ไม่ได้ทันที
  await db.delete(users).where(eq(users.username, username));
  await audit(me.username, "user.delete", username);
  return ok({});
});
