import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { lineOutput } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";

const Body = z.object({
  date: z.string(),
  lineId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  qty: z.coerce.number().int().min(0).default(0),
  hours: z.coerce.number().min(0).default(0),
  downtime: z.coerce.number().min(0).default(0),
  defect: z.coerce.number().int().min(0).default(0),
  note: z.string().default(""),
});

export const GET = handler(async () => {
  await requirePerm("plant");
  return ok({ rows: await db.select().from(lineOutput).orderBy(desc(lineOutput.date)).limit(300) });
});

/** บันทึกผลผลิตรายวัน → ใช้คำนวณ OEE = Availability × Performance × Quality */
export const POST = handler(async (req: Request) => {
  const me = await requirePerm("plant");
  const b = Body.parse(await req.json());
  const [row] = await db.insert(lineOutput).values({
    ...b, projectId: b.projectId || null,
    hours: String(b.hours), downtime: String(b.downtime), who: me.name,
  }).returning();
  return ok({ row });
});
