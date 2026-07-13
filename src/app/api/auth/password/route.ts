import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  checkPasswordStrength, createSession, hashPassword,
  requireUser, revokeSessions, verifyPassword,
} from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

const Body = z.object({ current: z.string().min(1), next: z.string() });

export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const { current, next } = Body.parse(await req.json());

  if (!(await verifyPassword(me.username, current)))
    return fail(400, "รหัสผ่านเดิมไม่ถูกต้อง");

  const bad = checkPasswordStrength(next);
  if (bad) return fail(400, bad);
  if (next === current) return fail(400, "รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม");

  await db.update(users).set({ password: hashPassword(next) })
    .where(eq(users.username, me.username));

  // เปลี่ยนรหัส = เตะ session อื่นทั้งหมดออก (เผื่อโดนขโมย token ไป) แล้วออก token ใหม่ให้ตัวเอง
  await revokeSessions(me.username);
  await createSession(me);

  await audit(me.username, "auth.change-password");
  return ok({});
});
