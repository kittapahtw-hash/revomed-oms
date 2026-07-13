import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { announcements, events, lineOutput, projects, stockItems, stockMoves, tickets } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { audit } from "@/lib/audit";

const Body = z.object({
  scopes: z.array(z.enum(["projects", "tickets", "stock", "announcements", "events", "lineOutput"])).min(1),
  confirm: z.literal("ลบเลย"),   // ต้องพิมพ์ยืนยัน — กันมือลั่น
});

/** แทน clearData() เดิม — ลบข้อมูลตัวอย่างเป็นชุด Admin เท่านั้น */
export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const { scopes } = Body.parse(await req.json());
  const done: string[] = [];

  for (const s of scopes) {
    switch (s) {
      case "projects":
        await db.delete(projects);
        // โปรเจกต์หาย = ยอดจองต้องหายด้วย ไม่งั้นสต็อกค้างจองถาวร
        await db.update(stockItems).set({ reserved: "0" });
        done.push("โปรเจกต์ (+ ล้างยอดจองสต็อก)");
        break;
      case "tickets":
        await db.delete(tickets); done.push("Ticket"); break;
      case "stock":
        await db.delete(stockMoves);
        await db.delete(stockItems);
        done.push("สต็อก + ประวัติเคลื่อนไหว");
        break;
      case "announcements":
        await db.delete(announcements); done.push("ประกาศ"); break;
      case "events":
        await db.delete(events); done.push("อีเวนต์/วันหยุด"); break;
      case "lineOutput":
        await db.delete(lineOutput); done.push("บันทึกผลผลิตไลน์"); break;
    }
  }

  // จำไว้ว่าล้างแล้ว — seed จะไม่ยัดข้อมูลตัวอย่างกลับมาอีก (เหมือน Config.noSeed เดิม)
  await db.execute(sql`
    INSERT INTO config (key, value) VALUES ('noSeed','1')
    ON CONFLICT (key) DO UPDATE SET value = '1'
  `);

  await audit(me.username, "admin.clear", scopes.join(","));
  return ok({ done });
});
