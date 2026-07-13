import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { today } from "@/lib/utils";

const Body = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "ต้องมีหัวข้อ"),
  body: z.string().default(""),
  cat: z.string().default("อื่นๆ"),
  ts: z.string().optional(),
});

export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const b = Body.parse(await req.json());
  const id = b.id || `AN-${Date.now().toString(36).toUpperCase()}`;
  const vals = { id, title: b.title, body: b.body, cat: b.cat, by: me.name, ts: b.ts || today() };

  const [row] = await db.insert(announcements).values(vals)
    .onConflictDoUpdate({ target: announcements.id, set: { title: vals.title, body: vals.body, cat: vals.cat, ts: vals.ts } })
    .returning();

  await audit(me.username, "announce.save", id);
  return ok({ announcement: row });
});

export const DELETE = handler(async (req: Request) => {
  const me = await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await db.delete(announcements).where(eq(announcements.id, id));
  await audit(me.username, "announce.delete", id);
  return ok({});
});
