import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.ts)).limit(200);
  return ok({ rows });
});
