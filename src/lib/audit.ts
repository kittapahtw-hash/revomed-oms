import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(user: string, action: string, detail = "") {
  await db.insert(auditLog).values({ user, action, detail });
}
