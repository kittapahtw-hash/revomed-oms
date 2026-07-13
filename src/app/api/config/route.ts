import { z } from "zod";
import { db } from "@/db";
import { config } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { audit } from "@/lib/audit";

const Body = z.record(z.string());

export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const b = Body.parse(await req.json());

  for (const [key, value] of Object.entries(b)) {
    await db.insert(config).values({ key, value })
      .onConflictDoUpdate({ target: config.key, set: { value } });
  }
  await audit(me.username, "config.save", Object.keys(b).join(","));
  return ok({});
});
