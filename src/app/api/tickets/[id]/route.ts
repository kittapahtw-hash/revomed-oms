import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";
import { notifyTicket } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  title: z.string().optional(),
  desc: z.string().optional(),
  toTeam: z.string().optional(),
  assignee: z.string().optional(),
  priority: z.string().optional(),
  status: z.enum(["open", "doing", "done", "cancelled"]).optional(),
  due: z.string().nullable().optional(),
  files: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  comment: z.string().optional(),
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requirePerm("tickets");
  const { id } = await ctx.params;
  const b = Patch.parse(await req.json());

  const [cur] = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  if (!cur) return fail(404, "ไม่พบ Ticket");

  const comments = b.comment
    ? [...cur.comments, { ts: new Date().toISOString(), who: me.name, text: b.comment }]
    : cur.comments;

  const { comment, ...rest } = b;
  void comment;

  const [row] = await db.update(tickets)
    .set({ ...rest, comments, updatedAt: new Date() })
    .where(eq(tickets.id, id)).returning();

  // เปลี่ยนผู้รับผิดชอบ / ปิดงาน → ยิงเมลแจ้ง
  if (b.assignee !== undefined && b.assignee !== cur.assignee && b.assignee) {
    void notifyTicket(row, "assign").catch((e) => console.error(e));
  } else if (b.status === "done" && cur.status !== "done") {
    void notifyTicket(row, "done").catch((e) => console.error(e));
  }

  return ok({ ticket: row });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requirePerm("tickets");
  const { id } = await ctx.params;
  await db.delete(tickets).where(eq(tickets.id, id));
  return ok({});
});
