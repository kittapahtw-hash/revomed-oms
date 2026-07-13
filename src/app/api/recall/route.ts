import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, lotUsage, projects, stockLots } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * RECALL TRACE — ลูกค้าร้องเรียน → หาว่าล็อตนี้ไปอยู่ในงานไหนบ้าง
 * ?lot=123        → ล็อตนี้ถูกใช้ในโปรเจกต์ไหนบ้าง (forward trace)
 * ?project=PJ-x   → โปรเจกต์นี้ใช้ล็อตอะไรบ้าง (backward trace)
 */
export const GET = handler(async (req: Request) => {
  await requirePerm("stock");
  const u = new URL(req.url);
  const lotId = u.searchParams.get("lot");
  const projectId = u.searchParams.get("project");

  if (lotId) {
    const [lot] = await db.select().from(stockLots)
      .where(eq(stockLots.id, Number(lotId))).limit(1);
    if (!lot) return fail(404, "ไม่พบล็อต");

    const uses = await db.select().from(lotUsage).where(eq(lotUsage.lotId, Number(lotId)));
    const ids = [...new Set(uses.map((x) => x.projectId).filter(Boolean) as string[])];

    const [projs, custs] = await Promise.all([
      ids.length ? db.select().from(projects) : Promise.resolve([]),
      db.select().from(customers),
    ]);

    const affected = ids.map((pid) => {
      const p = projs.find((x) => x.id === pid);
      const used = uses.filter((x) => x.projectId === pid && x.kind === "issue")
        .reduce((a, x) => a + Number(x.qty), 0);
      const returned = uses.filter((x) => x.projectId === pid && x.kind === "return")
        .reduce((a, x) => a + Number(x.qty), 0);
      return {
        projectId: pid,
        name: p?.name ?? "(ถูกลบไปแล้ว)",
        customer: custs.find((c) => c.id === p?.custId)?.name ?? "—",
        qty: p?.qty ?? 0,
        poNo: p?.poNo ?? null,
        phase: p?.phase ?? "—",
        usedQty: used - returned,
      };
    }).filter((x) => x.usedQty > 0);

    return ok({ mode: "lot", lot, uses, affected });
  }

  if (projectId) {
    const uses = await db.select().from(lotUsage).where(eq(lotUsage.projectId, projectId));
    const lotIds = [...new Set(uses.map((x) => x.lotId))];
    const lots = lotIds.length ? await db.select().from(stockLots) : [];
    return ok({
      mode: "project",
      uses,
      lots: lots.filter((l) => lotIds.includes(l.id)),
    });
  }

  return fail(400, "ต้องระบุ ?lot= หรือ ?project=");
});
