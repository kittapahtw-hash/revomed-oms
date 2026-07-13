import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { assertNotLocked, clientIp, recordAttempt } from "@/lib/ratelimit";
import { handler, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

const Body = z.object({ username: z.string().min(1), password: z.string().min(1) });

export const POST = handler(async (req: Request) => {
  const { username, password } = Body.parse(await req.json());
  const ip = clientIp(req);

  await assertNotLocked(username, ip);          // ผิดเกินโควตา → 429 ไม่ต้องเช็ครหัสด้วยซ้ำ

  const user = await verifyPassword(username, password);

  if (!user) {
    await recordAttempt(username, ip, false);
    await audit(username, "auth.fail", ip);
    return fail(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }

  await recordAttempt(username, ip, true);
  await createSession(user);
  await audit(username, "auth.login", ip);
  return ok({ user });
});
