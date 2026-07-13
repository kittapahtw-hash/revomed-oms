import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { stockLots } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { receiveLot } from "@/lib/lot";
import { audit } from "@/lib/audit";

const Body = z.object({
  itemId: z.string().min(1),
  lotNo: z.string().min(1, "ต้องระบุเลขล็อต"),
  qty: z.coerce.number().positive("จำนวนต้องมากกว่า 0"),
  expiry: z.string().nullable().default(null),
  mfgDate: z.string().nullable().default(null),
  supplier: z.string().default(""),
  poNo: z.string().default(""),
  coaUrl: z.string().default(""),
  qcStatus: z.enum(["pending", "passed", "quarantine"]).default("pending"),
  note: z.string().default(""),
});

export const GET = handler(async () => {
  await requirePerm("stock");
  return ok({ lots: await db.select().from(stockLots).orderBy(desc(stockLots.receivedAt)) });
});

/** รับวัตถุดิบเข้าคลัง — ต้องมีล็อตเสมอ */
export const POST = handler(async (req: Request) => {
  const me = await requirePerm("stock");
  const b = Body.parse(await req.json());
  const lot = await receiveLot({ ...b, who: me.name });
  await audit(me.username, "lot.receive", `${b.itemId} lot=${b.lotNo} x${b.qty}`);
  return ok({ lot });
});
