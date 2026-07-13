import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lineOutput } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requirePerm("plant");
  const { id } = await ctx.params;
  await db.delete(lineOutput).where(eq(lineOutput.id, Number(id)));
  await audit(me.username, "lineOutput.delete", id);
  return ok({});
});
