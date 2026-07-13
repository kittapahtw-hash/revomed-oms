import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stockItems } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { audit } from "@/lib/audit";

const Item = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["RM", "PKG"]).default("RM"),
  unit: z.string().default(""),
  qty: z.coerce.number().min(0).default(0),
  safety: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  supplier: z.string().default(""),
  note: z.string().default(""),
});

/** เพิ่ม/แก้ไข master วัตถุดิบ (upsert) */
export const POST = handler(async (req: Request) => {
  const me = await requirePerm("stock");
  const b = Item.parse(await req.json());
  const vals = { ...b, qty: String(b.qty), safety: String(b.safety), cost: String(b.cost) };
  const [row] = await db.insert(stockItems).values(vals)
    .onConflictDoUpdate({
      target: stockItems.id,
      set: { name: vals.name, type: vals.type, unit: vals.unit, safety: vals.safety, cost: vals.cost, supplier: vals.supplier, note: vals.note },
    }).returning();
  await audit(me.username, "stock.master", b.id);
  return ok({ item: row });
});

export const DELETE = handler(async (req: Request) => {
  const me = await requirePerm("stock");
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await db.delete(stockItems).where(eq(stockItems.id, id));
  await audit(me.username, "stock.delete", id);
  return ok({});
});
