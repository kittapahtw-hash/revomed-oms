import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, type BomLine } from "@/db/schema";
import { HttpError, requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";
import { applyBom } from "@/lib/stock";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** แก้ข้อมูลหัวโปรเจกต์ + BOM + archive
 *  ขั้นตอน (stages) ไปทำที่ /api/projects/[id]/stage แทน */
const Patch = z.object({
  rev: z.number().int(),
  name: z.string().optional(),
  custId: z.string().optional(),
  kind: z.enum(["new", "repeat", "reformulate"]).optional(),
  ptype: z.string().optional(),
  pm: z.string().optional(),
  priority: z.string().optional(),
  qty: z.coerce.number().int().optional(),
  dueDate: z.string().nullable().optional(),
  poNo: z.string().nullable().optional(),
  poDate: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  bom: z.array(z.object({ itemId: z.string(), qtyPerUnit: z.coerce.number().min(0) })).optional(),
  logText: z.string().optional(),
});

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requirePerm("projects");
  const { id } = await ctx.params;
  const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) return fail(404, "ไม่พบโปรเจกต์");
  return ok({ project: p });
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requirePerm("projects");
  const { id } = await ctx.params;
  const body = Patch.parse(await req.json());

  const [cur] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!cur) return fail(404, "ไม่พบโปรเจกต์");
  if (cur.rev !== body.rev)
    return fail(409, "มีคนอื่นแก้ข้อมูลนี้ไปแล้ว ระบบโหลดข้อมูลล่าสุดให้ กรุณาแก้ใหม่อีกครั้ง");

  const nextQty = body.qty ?? cur.qty;
  const nextBom: BomLine[] = body.bom ?? cur.bom;
  const bomChanged = body.bom !== undefined || (body.qty !== undefined && body.qty !== cur.qty);

  /* ---------- reserve-stock state machine ---------- */
  let bomState = cur.bomState;

  if (bomChanged && cur.bomState === "reserved") {
    await applyBom("release", cur.bom, cur.qty, id, me.name);
    if (nextBom.length && nextQty > 0) {
      await applyBom("reserve", nextBom, nextQty, id, me.name);
      bomState = "reserved";
    } else bomState = "";
  } else if (bomChanged && !cur.bomState && nextBom.length && nextQty > 0 && !cur.archived) {
    await applyBom("reserve", nextBom, nextQty, id, me.name);
    bomState = "reserved";
  } else if (bomChanged && cur.bomState === "issued") {
    throw new HttpError(400, "โปรเจกต์นี้ตัดสต็อกจริงไปแล้ว แก้ BOM ไม่ได้");
  }

  if (body.archived === true && !cur.archived) {
    if (bomState === "reserved") { await applyBom("release", nextBom, nextQty, id, me.name); bomState = ""; }
    else if (bomState === "issued") { await applyBom("return", nextBom, nextQty, id, me.name); bomState = "returned"; }
  }
  if (body.archived === false && cur.archived && nextBom.length && nextQty > 0) {
    await applyBom("reserve", nextBom, nextQty, id, me.name);
    bomState = "reserved";
  }

  const log = body.logText
    ? [...cur.log, { ts: new Date().toISOString(), who: me.name, text: body.logText, kind: "event" }].slice(-300)
    : cur.log;

  const { rev, logText, bom, ...rest } = body;
  void rev; void logText;

  const [row] = await db.update(projects).set({
    ...rest,
    ...(bom !== undefined ? { bom } : {}),
    bomState, log, rev: cur.rev + 1, updatedAt: new Date(),
  }).where(and(eq(projects.id, id), eq(projects.rev, cur.rev))).returning();

  if (!row) return fail(409, "มีคนอื่นแก้ข้อมูลนี้พร้อมกัน ลองใหม่อีกครั้ง");
  await audit(me.username, "project.update", id);
  return ok({ project: row });
});
