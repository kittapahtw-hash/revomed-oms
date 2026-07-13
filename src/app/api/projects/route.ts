import { z } from "zod";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { productionSteps, projects, workflowSteps, type StageState } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { blankStage, runStatusOf } from "@/lib/stage";
import { today } from "@/lib/utils";

const Body = z.object({
  name: z.string().min(1, "ต้องมีชื่อโปรเจกต์"),
  custId: z.string().min(1, "ต้องเลือกลูกค้า"),
  kind: z.enum(["new", "repeat", "reformulate"]).default("new"),
  ptype: z.string().default(""),
  pm: z.string().default(""),
  priority: z.enum(["ปกติ", "ด่วน", "ด่วนมาก"]).default("ปกติ"),
  qty: z.coerce.number().int().min(0).default(0),
  dueDate: z.string().nullable().optional(),
  poNo: z.string().nullable().optional(),
  poDate: z.string().nullable().optional(),
});

export const POST = handler(async (req: Request) => {
  const me = await requirePerm("projects");
  const b = Body.parse(await req.json());

  const year = new Date().getFullYear();
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(projects)
    .where(sql`${projects.id} LIKE ${"PJ-" + year + "-%"}`);
  const id = `PJ-${year}-${String(count + 1).padStart(3, "0")}`;

  const [wf, prod] = await Promise.all([
    db.select().from(workflowSteps).orderBy(workflowSteps.id),
    db.select().from(productionSteps).orderBy(productionSteps.id),
  ]);

  /* seed ขั้นตอนตามประเภทงาน
   *   new / reformulate : เปิด Phase 1 ขั้นแรก
   *   repeat            : สูตรเดิม ทะเบียนเดิม → mark dev ทั้งหมดเป็น skip แล้วเข้าเฟสผลิตเลย */
  const isRepeat = b.kind === "repeat";

  const stages: StageState[] = wf.map((w, i) => {
    const s = blankStage(w.id);
    if (isRepeat) { s.status = "skip"; s.start = today(); }
    else if (i === 0) { s.status = runStatusOf(w, false); s.start = today(); }
    return s;
  });

  const prodStages: StageState[] | null = isRepeat
    ? prod.map((s, i) => {
        const st = blankStage(s.id);
        if (i === 0) { st.status = runStatusOf(s, true); st.start = today(); }
        return st;
      })
    : null;

  const note = isRepeat
    ? "สร้างโปรเจกต์ (ผลิตซ้ำ — ข้ามเฟสพัฒนา เข้าเฟสผลิตทันที)"
    : b.kind === "reformulate"
      ? "สร้างโปรเจกต์ (ปรับสูตร — กดข้ามขั้นที่ทำไปแล้วได้ที่หน้า detail)"
      : "สร้างโปรเจกต์ (งานใหม่)";

  const [row] = await db.insert(projects).values({
    id, ...b,
    dueDate: b.dueDate || null, poDate: b.poDate || null, poNo: b.poNo || null,
    phase: isRepeat ? "prod" : "dev",
    stages, prodStages,
    log: [{ ts: new Date().toISOString(), who: me.name, text: note, kind: "event" }],
  }).returning();

  await audit(me.username, "project.create", `${id} (${b.kind})`);
  return ok({ project: row });
});

export const GET = handler(async () => {
  await requirePerm("projects");
  return ok({ projects: await db.select().from(projects).orderBy(desc(projects.createdAt)) });
});
