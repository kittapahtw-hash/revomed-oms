import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** สำหรับ uptime monitor (UptimeRobot / BetterStack) — เช็คว่าแอป + DB ยังหายใจอยู่ */
export async function GET() {
  const t0 = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - t0,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json(
      { ok: false, db: "down", error: e instanceof Error ? e.message : "unknown" },
      { status: 503 }
    );
  }
}
