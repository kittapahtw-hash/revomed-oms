import { z } from "zod";
import { requirePerm } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { manualMove } from "@/lib/stock";
import { audit } from "@/lib/audit";

const Body = z.object({
  itemId: z.string().min(1),
  dir: z.enum(["in", "out"]),
  qty: z.coerce.number().positive("จำนวนต้องมากกว่า 0"),
  ref: z.string().default(""),
  note: z.string().default(""),
});

/** รับเข้า / จ่ายออก — จ่ายออกเกินยอด "ใช้ได้" ระบบบล็อกทันที (ห้ามกินยอดจอง) */
export const POST = handler(async (req: Request) => {
  const me = await requirePerm("stock");
  const b = Body.parse(await req.json());
  const res = await manualMove(b.itemId, b.dir, b.qty, b.ref, me.name, b.note);
  await audit(me.username, `stock.${b.dir}`, `${b.itemId} x${b.qty}`);
  return ok(res);
});
