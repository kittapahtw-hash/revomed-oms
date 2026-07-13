import { z } from "zod";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { notifyTicket } from "@/lib/notify";

const Body = z.object({
  title: z.string().min(1, "ต้องมีหัวข้อ"),
  desc: z.string().default(""),
  toTeam: z.string().default(""),
  assignee: z.string().default(""),
  priority: z.enum(["ปกติ", "ด่วน", "ด่วนมาก"]).default("ปกติ"),
  due: z.string().nullable().optional(),
  files: z.array(z.object({ name: z.string(), url: z.string() })).default([]),
});

export const GET = handler(async () => {
  await requirePerm("tickets");
  return ok({ tickets: await db.select().from(tickets).orderBy(desc(tickets.updatedAt)) });
});

export const POST = handler(async (req: Request) => {
  const me = await requirePerm("tickets");
  const b = Body.parse(await req.json());
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(tickets);
  const id = `TK-${String(count + 1).padStart(4, "0")}`;
  const [row] = await db.insert(tickets).values({
    id, ...b, due: b.due || null, status: "open", createdBy: me.name,
  }).returning();

  // แจ้งทีม + ผู้รับผิดชอบทางอีเมล (ไม่ block response — เมลพังก็ยังสร้าง ticket ได้)
  void notifyTicket(row, "new").catch((e) => console.error("notifyTicket failed:", e));

  return ok({ ticket: row });
});
