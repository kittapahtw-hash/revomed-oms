import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  customers, departments, lines, productTypes, productionSteps,
  stockItems, workflowSteps,
} from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

/** master data ทั้งหมดวิ่งผ่าน endpoint เดียว — ต้องมีสิทธิ์ setup
 *  (ของเดิม non-admin ที่มีสิทธิ์ setup ก็แก้ lead time / ลูกค้า / สต็อกมาสเตอร์ได้) */

const Schemas = {
  workflow: z.object({
    id: z.coerce.number().int(),
    team: z.string().min(1),
    th: z.string().min(1),
    en: z.string().default(""),
    lead: z.coerce.number().int().min(0),
    gate: z.string().default(""),
    note: z.string().default(""),
  }),
  production: z.object({
    id: z.coerce.number().int(),
    team: z.string().min(1),
    th: z.string().min(1),
    en: z.string().default(""),
    lead: z.coerce.number().int().min(0),
  }),
  customer: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().default(""),
    contact: z.string().default(""),
  }),
  ptype: z.object({ name: z.string().min(1) }),
  line: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    capacity: z.coerce.number().int().min(0).default(0),
    note: z.string().default(""),
  }),
  dept: z.object({
    key: z.string().min(1),
    name: z.string().min(1),
    th: z.string().min(1),
    cls: z.string().default(""),
    email: z.string().default(""),
  }),
  stock: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(["RM", "PKG"]).default("RM"),
    unit: z.string().default(""),
    qty: z.coerce.number().min(0).default(0),
    safety: z.coerce.number().min(0).default(0),
    cost: z.coerce.number().min(0).default(0),
    supplier: z.string().default(""),
    note: z.string().default(""),
  }),
} as const;

type Kind = keyof typeof Schemas;

export const POST = handler(async (req: Request) => {
  const me = await requirePerm("setup");
  const raw = await req.json();
  const kind = String(raw.kind) as Kind;
  if (!(kind in Schemas)) return fail(400, "ประเภทข้อมูลไม่ถูกต้อง");

  const b = Schemas[kind].parse(raw.data);

  switch (kind) {
    case "workflow": {
      const v = b as z.infer<typeof Schemas.workflow>;
      await db.insert(workflowSteps).values(v)
        .onConflictDoUpdate({ target: workflowSteps.id, set: v });
      break;
    }
    case "production": {
      const v = b as z.infer<typeof Schemas.production>;
      await db.insert(productionSteps).values(v)
        .onConflictDoUpdate({ target: productionSteps.id, set: v });
      break;
    }
    case "customer": {
      const v = b as z.infer<typeof Schemas.customer>;
      await db.insert(customers).values(v)
        .onConflictDoUpdate({ target: customers.id, set: v });
      break;
    }
    case "ptype": {
      const v = b as z.infer<typeof Schemas.ptype>;
      await db.insert(productTypes).values(v).onConflictDoNothing();
      break;
    }
    case "line": {
      const v = b as z.infer<typeof Schemas.line>;
      await db.insert(lines).values(v)
        .onConflictDoUpdate({ target: lines.id, set: v });
      break;
    }
    case "dept": {
      const v = b as z.infer<typeof Schemas.dept>;
      await db.insert(departments).values(v)
        .onConflictDoUpdate({ target: departments.key, set: v });
      break;
    }
    case "stock": {
      const v = b as z.infer<typeof Schemas.stock>;
      const vals = { ...v, qty: String(v.qty), safety: String(v.safety), cost: String(v.cost) };
      await db.insert(stockItems).values(vals).onConflictDoUpdate({
        target: stockItems.id,
        set: {
          name: vals.name, type: vals.type, unit: vals.unit, safety: vals.safety,
          cost: vals.cost, supplier: vals.supplier, note: vals.note,
        },   // qty ไม่แก้ตรงนี้ — ต้องผ่านรับเข้า/จ่ายออก เพื่อให้มีประวัติเสมอ
      });
      break;
    }
  }

  await audit(me.username, `master.${kind}`, JSON.stringify(b).slice(0, 120));
  return ok({});
});

export const DELETE = handler(async (req: Request) => {
  const me = await requirePerm("setup");
  const { kind, id } = z.object({ kind: z.string(), id: z.string() }).parse(await req.json());

  switch (kind) {
    case "workflow": await db.delete(workflowSteps).where(eq(workflowSteps.id, Number(id))); break;
    case "production": await db.delete(productionSteps).where(eq(productionSteps.id, Number(id))); break;
    case "customer": await db.delete(customers).where(eq(customers.id, id)); break;
    case "ptype": await db.delete(productTypes).where(eq(productTypes.name, id)); break;
    case "line": await db.delete(lines).where(eq(lines.id, id)); break;
    case "dept": await db.delete(departments).where(eq(departments.key, id)); break;
    case "stock": await db.delete(stockItems).where(eq(stockItems.id, id)); break;
    default: return fail(400, "ประเภทข้อมูลไม่ถูกต้อง");
  }

  await audit(me.username, `master.${kind}.delete`, id);
  return ok({});
});
