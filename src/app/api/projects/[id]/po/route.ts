import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { productionSteps, projects, type StageState } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";
import { blankStage, runStatusOf, skipsOf } from "@/lib/stage";
import { notifyStage } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  rev: z.number().int(),
  poNo: z.string().min(1, "ต้องมีเลขที่ PO"),
  poDate: z.string().min(1, "ต้องมีวันที่ PO"),
  dueDate: z.string().min(1, "ต้องมีกำหนดส่ง"),
  qty: z.coerce.number().int().min(1, "จำนวนต้องมากกว่า 0"),
});

/** เปิด PO = ปิด Phase 1 แล้วเข้าเฟสผลิต (แทน openPOModal/confirmPO เดิม)
 *  บล็อกถ้ายังมีขั้น dev ที่ข้ามไว้ค้างอยู่ — ต้องกลับไปทำให้ครบก่อน */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requirePerm("projects");
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());

  const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) return fail(404, "ไม่พบโปรเจกต์");
  if (p.rev !== b.rev) return fail(409, "มีคนอื่นแก้ข้อมูลนี้ไปแล้ว ลองใหม่อีกครั้ง");
  if (p.phase !== "dev") return fail(400, "โปรเจกต์นี้เปิด PO ไปแล้ว");

  const skips = skipsOf(p.stages);
  if (skips.length)
    return fail(400, `ยังมีขั้นตอนที่ข้ามไว้ ${skips.length} ขั้น — ต้องกลับไปทำให้ครบก่อนเปิด PO`);

  const notDone = p.stages.filter((s) => s.status !== "done");
  if (notDone.length)
    return fail(400, `ยังปิดไม่ครบ เหลืออีก ${notDone.length} ขั้นตอนใน Phase 1`);

  const steps = await db.select().from(productionSteps).orderBy(productionSteps.id);
  const prodStages: StageState[] = steps.map((s, i) => {
    const st = blankStage(s.id);
    if (i === 0) { st.status = runStatusOf(s, true); st.start = today(); }
    return st;
  });

  const log = [...p.log, {
    ts: new Date().toISOString(), who: me.name,
    text: `เปิด PO ${b.poNo} — เข้าสู่เฟสการผลิต (${b.qty.toLocaleString()} ชิ้น · ส่ง ${b.dueDate})`,
    kind: "po",
  }].slice(-300);

  const [row] = await db.update(projects).set({
    phase: "prod", poNo: b.poNo, poDate: b.poDate, dueDate: b.dueDate, qty: b.qty,
    prodStages, log, rev: p.rev + 1, updatedAt: new Date(),
  }).where(and(eq(projects.id, id), eq(projects.rev, p.rev))).returning();

  if (!row) return fail(409, "มีคนอื่นแก้พร้อมกัน ลองใหม่");

  if (steps[0]) {
    void notifyStage({ id: p.id, name: p.name, dueDate: b.dueDate }, steps[0], "เปิด PO แล้ว — เริ่มเฟสการผลิต")
      .catch((e) => console.error(e));
  }
  await audit(me.username, "project.po", `${id} PO=${b.poNo}`);
  return ok({ project: row });
});
