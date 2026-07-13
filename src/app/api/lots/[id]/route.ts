import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stockLots } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  qcStatus: z.enum(["pending", "passed", "failed", "quarantine"]).optional(),
  coaUrl: z.string().optional(),
  expiry: z.string().nullable().optional(),
  note: z.string().optional(),
});

/** อัปเดตผล QC / แนบ COA / แก้วันหมดอายุ */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requirePerm("stock");
  const { id } = await ctx.params;
  const b = Patch.parse(await req.json());

  const [row] = await db.update(stockLots).set(b)
    .where(eq(stockLots.id, Number(id))).returning();
  if (!row) return fail(404, "ไม่พบล็อต");

  await audit(me.username, "lot.update",
    `${row.itemId} lot=${row.lotNo} ${b.qcStatus ? `QC=${b.qcStatus}` : ""}`);
  return ok({ lot: row });
});
