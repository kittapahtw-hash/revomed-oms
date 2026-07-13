import { desc } from "drizzle-orm";
import { db } from "@/db";
import { lineOutput, projects, stockItems, stockMoves, tickets } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { handler } from "@/lib/http";
import { curIdx } from "@/lib/stage";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (head: string[], rows: unknown[][]) =>
  [head.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");

/** แทน exportReport() ที่เดิม export เป็น Google Sheets — ตอนนี้เป็น CSV ให้ดาวน์โหลดตรงๆ
 *  ?sheet=projects|stock|moves|lineOutput|tickets */
export const GET = handler(async (req: Request) => {
  await requirePerm("report");
  const sheet = new URL(req.url).searchParams.get("sheet") ?? "projects";

  let out = "", name = sheet;

  switch (sheet) {
    case "projects": {
      const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
      out = csv(
        ["id", "ชื่อ", "ลูกค้า", "ประเภทงาน", "เฟส", "PM", "ความสำคัญ", "จำนวน", "PO", "กำหนดส่ง", "ขั้นปัจจุบัน", "สถานะ BOM", "Archived"],
        rows.map((p) => {
          const arr = p.phase === "prod" ? (p.prodStages ?? []) : p.stages;
          const cur = arr.length ? arr[curIdx(arr)] : null;
          return [p.id, p.name, p.custId, p.kind, p.phase, p.pm, p.priority, p.qty,
            p.poNo ?? "", p.dueDate ?? "", cur ? `#${cur.sid} ${cur.status}` : "", p.bomState, p.archived];
        })
      );
      break;
    }
    case "stock": {
      const rows = await db.select().from(stockItems).orderBy(stockItems.id);
      out = csv(
        ["รหัส", "ชื่อ", "ประเภท", "หน่วย", "คงเหลือจริง", "จอง", "ใช้ได้", "Safety", "ต้นทุน/หน่วย", "มูลค่า", "ผู้ขาย"],
        rows.map((s) => [s.id, s.name, s.type, s.unit, s.qty, s.reserved,
          Number(s.qty) - Number(s.reserved), s.safety, s.cost,
          Number(s.qty) * Number(s.cost), s.supplier])
      );
      break;
    }
    case "moves": {
      const rows = await db.select().from(stockMoves).orderBy(desc(stockMoves.ts)).limit(2000);
      out = csv(["เวลา", "รหัส", "รายการ", "ประเภท", "จำนวน", "อ้างอิง", "โดย", "หมายเหตุ"],
        rows.map((m) => [m.ts, m.itemId, m.itemName, m.dir, m.qty, m.ref, m.who, m.note]));
      break;
    }
    case "lineOutput": {
      const rows = await db.select().from(lineOutput).orderBy(desc(lineOutput.date)).limit(2000);
      out = csv(["วันที่", "ไลน์", "โปรเจกต์", "ผลิตได้", "ของเสีย", "ชั่วโมง", "Downtime", "โดย"],
        rows.map((r) => [r.date, r.lineId, r.projectId ?? "", r.qty, r.defect, r.hours, r.downtime, r.who]));
      break;
    }
    case "tickets": {
      const rows = await db.select().from(tickets).orderBy(desc(tickets.updatedAt));
      out = csv(["id", "หัวข้อ", "ทีม", "ผู้รับผิดชอบ", "ความสำคัญ", "สถานะ", "กำหนดเสร็จ", "สร้างโดย", "สร้างเมื่อ"],
        rows.map((t) => [t.id, t.title, t.toTeam, t.assignee, t.priority, t.status, t.due ?? "", t.createdBy, t.createdAt]));
      break;
    }
    default:
      name = "unknown";
  }

  return new Response("﻿" + out, {   // BOM — กัน Excel อ่านภาษาไทยเพี้ยน
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="revomed-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
