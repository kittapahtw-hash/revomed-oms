import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { audit } from "@/lib/audit";

const Body = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "ต้องมีวันที่"),
  title: z.string().min(1, "ต้องมีชื่อ"),
  type: z.enum(["event", "holiday"]).default("event"),
});

export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const b = Body.parse(await req.json());
  const id = b.id || `EV-${Date.now().toString(36).toUpperCase()}`;
  const vals = { id, date: b.date, title: b.title, type: b.type };

  const [row] = await db.insert(events).values(vals)
    .onConflictDoUpdate({ target: events.id, set: { date: vals.date, title: vals.title, type: vals.type } })
    .returning();

  await audit(me.username, "event.save", id);
  return ok({ event: row });
});

export const DELETE = handler(async (req: Request) => {
  const me = await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await db.delete(events).where(eq(events.id, id));
  await audit(me.username, "event.delete", id);
  return ok({});
});
