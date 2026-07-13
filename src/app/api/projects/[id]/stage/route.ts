import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { productionSteps, projects, workflowSteps, type StageState } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";
import { applyStageAction, type StageAction } from "@/lib/stage";
import { applyBom } from "@/lib/stock";
import { notifyStage } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  rev: z.number().int(),
  phase: z.enum(["dev", "prod"]),     // สั่งขั้นไหนก็ได้ ไม่ต้องดูว่าโปรเจกต์อยู่เฟสอะไร
  idx: z.number().int().min(0),
  action: z.enum(["advance", "skip", "resume", "block", "unblock", "rollback", "gateOk", "gateReject"]),
});

/** ทุก action ของขั้นตอน วิ่งผ่าน endpoint เดียว — ตรรกะอยู่ฝั่ง server ล้วน กันสองคนกดชนกัน */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requirePerm("projects");
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());

  const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) return fail(404, "ไม่พบโปรเจกต์");
  if (p.rev !== b.rev) return fail(409, "มีคนอื่นแก้ข้อมูลนี้ไปแล้ว — ระบบโหลดของล่าสุดให้แล้ว ลองใหม่อีกครั้ง");
  if (p.archived) return fail(400, "โปรเจกต์นี้ถูก Archive แล้ว แก้ไม่ได้");

  const isProd = b.phase === "prod";
  const steps = isProd
    ? await db.select().from(productionSteps).orderBy(productionSteps.id)
    : await db.select().from(workflowSteps).orderBy(workflowSteps.id);

  const stages: StageState[] = isProd ? (p.prodStages ?? []) : p.stages;
  if (!stages.length) return fail(400, "โปรเจกต์นี้ยังไม่มีขั้นตอนในเฟสนี้");
  if (b.idx >= stages.length) return fail(400, "ไม่พบขั้นตอนนี้");

  const r = applyStageAction(b.action as StageAction, stages, b.idx, steps, isProd);

  // ผลิตเสร็จครบทุกขั้น → ตัดสต็อกจริงตาม BOM (Reserve model)
  let bomState = p.bomState;
  let phase = p.phase;
  if (isProd && r.finished && bomState === "reserved") {
    await applyBom("issue", p.bom, p.qty, p.id, me.name);
    bomState = "issued";
    phase = "done";
  } else if (isProd && r.finished) {
    phase = "done";
  }

  const log = [...p.log, { ts: new Date().toISOString(), who: me.name, text: r.log, kind: b.action }].slice(-300);

  const [row] = await db.update(projects).set({
    ...(isProd ? { prodStages: r.stages } : { stages: r.stages }),
    phase, bomState, log, rev: p.rev + 1, updatedAt: new Date(),
  }).where(and(eq(projects.id, id), eq(projects.rev, p.rev))).returning();

  if (!row) return fail(409, "มีคนอื่นแก้พร้อมกัน ลองใหม่อีกครั้ง");

  // ยิงเมลแจ้งทีมถัดไป (ไม่ block response — พังก็ไม่เป็นไร งานสำคัญกว่าเมล)
  if (r.notify) {
    void notifyStage({ id: p.id, name: p.name, dueDate: p.dueDate }, r.notify.step, r.notify.reason)
      .catch((e) => console.error("notifyStage failed:", e));
  }

  await audit(me.username, `stage.${b.action}`, `${id} #${stages[b.idx].sid}`);

  return ok({
    project: row,
    finished: r.finished,
    pendingSkips: r.pendingSkips,
    nextStep: r.notify?.step.th ?? null,
    today: today(),
  });
});
