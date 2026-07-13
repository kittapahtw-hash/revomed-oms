import { z } from "zod";
import { requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { undoMove } from "@/lib/stock";
import { audit } from "@/lib/audit";

export const POST = handler(async (req: Request) => {
  const me = await requirePerm("stock");
  const { id } = z.object({ id: z.coerce.number().int() }).parse(await req.json());
  const r = await undoMove(id, me.name);
  await audit(me.username, "stock.undo", String(id));
  return ok(r);
});
