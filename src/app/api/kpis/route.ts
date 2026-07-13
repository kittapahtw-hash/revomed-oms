import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { kpis } from "@/db/schema";
import { requireAdmin, requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { audit } from "@/lib/audit";

const Body = z.object({
  id: z.string().optional(),
  team: z.string().default(""),
  topic: z.string().min(1, "ต้องมีชื่อ KPI"),
  how: z.string().default(""),
  op: z.enum([">=", "<="]).default(">="),
  target: z.coerce.number().default(0),
  unit: z.enum(["%", "num"]).default("%"),
  src: z.string().default("manual"),
  active: z.boolean().default(true),
  ord: z.coerce.number().int().default(0),
});

/** เพิ่ม / แก้ไข KPI — Admin เท่านั้น */
export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const b = Body.parse(await req.json());
  const id = b.id || `KPI-${Date.now().toString(36).toUpperCase()}`;

  const vals = { ...b, id, target: String(b.target) };
  const [row] = await db.insert(kpis).values(vals)
    .onConflictDoUpdate({
      target: kpis.id,
      set: {
        team: vals.team, topic: vals.topic, how: vals.how, op: vals.op,
        target: vals.target, unit: vals.unit, src: vals.src,
        active: vals.active, ord: vals.ord,
      },
    }).returning();

  await audit(me.username, "kpi.save", id);
  return ok({ kpi: row });
});

/** กรอกค่ารายเดือน — ต้องมีสิทธิ์ kpi (หรือ Admin) · KPI ที่เป็น AUTO แก้ไม่ได้ */
const Cell = z.object({
  id: z.string(),
  ym: z.string().regex(/^\d{4}-\d{2}$/, "รูปแบบเดือนต้องเป็น YYYY-MM"),
  value: z.union([z.coerce.number(), z.null()]),
});

export const PATCH = handler(async (req: Request) => {
  const me = await requirePerm("kpi");
  const b = Cell.parse(await req.json());

  const [cur] = await db.select().from(kpis).where(eq(kpis.id, b.id)).limit(1);
  if (!cur) return ok({});
  if (cur.src !== "manual")
    return ok({ error: "KPI นี้คำนวณอัตโนมัติ แก้มือไม่ได้" });

  const vals = { ...cur.vals };
  if (b.value === null) delete vals[b.ym];
  else vals[b.ym] = b.value;

  const [row] = await db.update(kpis).set({ vals }).where(eq(kpis.id, b.id)).returning();
  await audit(me.username, "kpi.value", `${b.id} ${b.ym}=${b.value}`);
  return ok({ kpi: row });
});

export const DELETE = handler(async (req: Request) => {
  const me = await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await db.delete(kpis).where(eq(kpis.id, id));
  await audit(me.username, "kpi.delete", id);
  return ok({});
});
