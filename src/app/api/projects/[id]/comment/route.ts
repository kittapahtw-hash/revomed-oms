import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ text: z.string().min(1, "พิมพ์ข้อความก่อน") });

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requirePerm("projects");
  const { id } = await ctx.params;
  const { text } = Body.parse(await req.json());

  const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) return fail(404, "ไม่พบโปรเจกต์");

  const log = [...p.log, { ts: new Date().toISOString(), who: me.name, text, kind: "comment" }].slice(-300);
  const [row] = await db.update(projects).set({ log, rev: p.rev + 1, updatedAt: new Date() })
    .where(eq(projects.id, id)).returning();

  return ok({ project: row });
});
