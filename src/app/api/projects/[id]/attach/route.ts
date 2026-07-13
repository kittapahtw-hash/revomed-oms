import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, type StageState } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({
  phase: z.enum(["dev", "prod"]),
  idx: z.number().int().min(0),
  name: z.string().min(1),
  url: z.string().url(),
});

/** ผูกไฟล์ที่อัปโหลดแล้ว (จาก /api/upload) เข้ากับขั้นตอน */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requirePerm("projects");
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());

  const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) return fail(404, "ไม่พบโปรเจกต์");

  const isProd = b.phase === "prod";
  const stages: StageState[] = isProd ? (p.prodStages ?? []) : p.stages;
  if (!stages[b.idx]) return fail(400, "ไม่พบขั้นตอนนี้");

  const next = stages.map((s, i) => i !== b.idx ? s : {
    ...s,
    files: [...s.files, { name: b.name, url: b.url, by: me.name, ts: new Date().toISOString() }],
  });

  const log = [...p.log, {
    ts: new Date().toISOString(), who: me.name, text: `แนบไฟล์: ${b.name}`, kind: "file",
  }].slice(-300);

  const [row] = await db.update(projects).set({
    ...(isProd ? { prodStages: next } : { stages: next }),
    log, rev: p.rev + 1, updatedAt: new Date(),
  }).where(eq(projects.id, id)).returning();

  return ok({ project: row });
});
