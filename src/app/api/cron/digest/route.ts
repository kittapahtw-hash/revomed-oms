import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { config, departments, productionSteps, projects, stockItems, stockLots, tickets, workflowSteps } from "@/db/schema";
import { sendMail } from "@/lib/mail";
import { handler, ok, fail } from "@/lib/http";
import { daysBetween, today } from "@/lib/utils";
import { curIdx } from "@/lib/stage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = { text: string; late: boolean };

/**
 * แทน dailyDigest() + buildDigest_() ของ Apps Script — ครบ 5 หมวดเหมือนเดิม
 *   1) งานที่รอทีมคุณ  2) ติดปัญหา (blocked)  3) ขั้นที่ข้ามไว้ค้าง
 *   4) เลยกำหนดส่ง     5) สต็อกต่ำกว่า Safety
 * Vercel Cron ยิงตาม vercel.json · กันด้วย CRON_SECRET
 */
export const GET = handler(async (req: Request) => {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) return fail(401, "unauthorized");

  const [all, wf, prod, depts, openTickets, stock, cfg] = await Promise.all([
    db.select().from(projects).where(eq(projects.archived, false)),
    db.select().from(workflowSteps),
    db.select().from(productionSteps),
    db.select().from(departments),
    db.select().from(tickets).where(inArray(tickets.status, ["open", "doing"])),
    db.select().from(stockItems),
    db.select().from(config),
  ]);

  // ล็อตที่หมดอายุ / ใกล้หมดอายุ (GMP — ต้องเตือนทุกวัน)
  const lots = await db.select().from(stockLots);
  const td = today();
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);
  const in30s = in30.toISOString().slice(0, 10);
  const liveLots = lots.filter((l) => Number(l.qty) > 0);
  const expired = liveLots.filter((l) => l.expiry && l.expiry < td);
  const expSoon = liveLots.filter((l) => l.expiry && l.expiry >= td && l.expiry <= in30s);
  const qcHold = liveLots.filter((l) => l.qcStatus === "pending" || l.qcStatus === "quarantine");

  const stepOf = new Map<number, { team: string; th: string; lead: number }>();
  [...wf, ...prod].forEach((s) => stepOf.set(s.id, { team: s.team, th: s.th, lead: s.lead }));

  const waiting = new Map<string, Row[]>();   // งานที่รอทีมนี้
  const blocked = new Map<string, Row[]>();   // ติดปัญหา
  const skipped = new Map<string, Row[]>();   // ข้ามไว้ค้าง
  const lateShip: Row[] = [];                 // เลยกำหนดส่ง (ส่งทุกทีม)

  const push = (m: Map<string, Row[]>, team: string, r: Row) => {
    const a = m.get(team) ?? [];
    a.push(r);
    m.set(team, a);
  };

  for (const p of all) {
    // สแกน "ทุกขั้น" ของทั้ง dev + prod — ไม่ใช่แค่ขั้นปัจจุบัน
    // (ขั้นที่ block ค้างใน dev ตอนโปรเจกต์ไป prod แล้ว ต้องยังโผล่ในเมล)
    for (const arr of [p.stages, p.prodStages ?? []]) {
      if (!arr.length) continue;
      const cur = arr[curIdx(arr)];

      for (const s of arr) {
        const meta = stepOf.get(s.sid);
        if (!meta) continue;
        const age = s.start ? daysBetween(s.start, today()) : 0;
        const late = age > meta.lead;
        const txt = `${p.id} · ${p.name} — ${meta.th} (${age} วัน${late ? ` ⚠️ เกิน lead ${meta.lead}` : ""})`;

        if (s.status === "block") {
          push(blocked, meta.team, { text: txt, late: true });
        } else if (s.status === "skip") {
          push(skipped, meta.team, { text: `${p.id} · ${p.name} — ${meta.th}`, late: false });
        } else if (s === cur && s.status !== "done" && s.status !== "wait") {
          push(waiting, meta.team, { text: txt, late });
        }
      }
    }

    // 4) เลยกำหนดส่ง
    if (p.dueDate && daysBetween(today(), p.dueDate) < 0 && p.phase !== "done") {
      lateShip.push({
        text: `${p.id} · ${p.name} — เลยกำหนด ${-daysBetween(today(), p.dueDate)} วัน (ส่ง ${p.dueDate})`,
        late: true,
      });
    }
  }

  // 5) สต็อกต่ำ
  const lowStock = stock.filter((s) => Number(s.qty) - Number(s.reserved) < Number(s.safety));

  const globalTo = (cfg.find((c) => c.key === "notifyEmails")?.value || "")
    .split(/[,;\s]+/).filter(Boolean);

  const sec = (title: string, rows: Row[], color = "#15325b") =>
    rows.length
      ? `<h3 style="color:${color};margin:18px 0 6px;font-size:15px">${title} (${rows.length})</h3>
         <ul style="margin:0;padding-left:20px;color:#3a4149;font-size:13px;line-height:1.9">
           ${rows.map((r) => `<li${r.late ? ' style="color:#b23324;font-weight:600"' : ""}>${r.text}</li>`).join("")}
         </ul>`
      : "";

  const sent: string[] = [];
  for (const d of depts) {
    const w = waiting.get(d.key) ?? [];
    const b = blocked.get(d.key) ?? [];
    const s = skipped.get(d.key) ?? [];
    // Ticket ที่ค้างอยู่ที่ทีมนี้
    const tk: Row[] = openTickets
      .filter((t) => t.toTeam === d.key)
      .map((t) => ({
        text: `${t.id} · ${t.title} — ${t.assignee || "ยังไม่มีผู้รับผิดชอบ"}`
          + ` [${t.priority}]${t.due ? ` ครบ ${t.due}` : ""}`,
        late: !!(t.due && daysBetween(today(), t.due) < 0),
      }));

    // ส่งเฉพาะอีเมลทีม — สำเนาส่วนกลางส่งทีเดียวท้ายลูป ไม่งั้นแอดมินได้เมลซ้ำ 8 ฉบับ
    const to = [d.email].filter(Boolean);

    if (!to.length) continue;
    if (!w.length && !b.length && !s.length && !tk.length && !lateShip.length && !lowStock.length) continue;

    const html = `
      <div style="font-family:Sarabun,Arial,sans-serif;max-width:660px">
        <h2 style="color:#15325b;margin:0 0 2px">Revomed OMS — สรุปงานประจำวัน</h2>
        <p style="color:#8a9099;margin:0 0 4px;font-size:13px">ทีม ${d.th} · ${today()}</p>

        ${sec("📋 งานที่รอทีมคุณ", w)}
        ${b.length ? sec("⚠️ ติดปัญหา — ต้องเข้าไปเคลียร์", b, "#b23324") : ""}
        ${s.length ? sec("» ขั้นที่ข้ามไว้ ยังไม่ได้กลับมาทำ", s, "#946008") : ""}
        ${tk.length ? sec("✎ Ticket ที่ยังเปิดค้างอยู่ที่ทีมคุณ", tk, "#8a4fbf") : ""}
        ${lateShip.length ? sec("🔴 เลยกำหนดส่งลูกค้า (ทั้งระบบ)", lateShip, "#b23324") : ""}
        ${lowStock.length
          ? `<h3 style="color:#b23324;margin:18px 0 6px;font-size:15px">📦 สต็อกต่ำกว่า Safety (${lowStock.length})</h3>
             <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.9">
               ${lowStock.map((x) => `<li>${x.name} — ใช้ได้ ${Number(x.qty) - Number(x.reserved)} ${x.unit} (safety ${x.safety})</li>`).join("")}
             </ul>`
          : ""}
        ${expired.length
          ? `<h3 style="color:#b23324;margin:18px 0 6px;font-size:15px">☠️ ล็อตหมดอายุ ยังมีของค้างในคลัง (${expired.length})</h3>
             <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.9;color:#b23324;font-weight:600">
               ${expired.map((l) => `<li>${l.itemId} · ล็อต ${l.lotNo} — หมดอายุ ${l.expiry} · เหลือ ${l.qty}</li>`).join("")}
             </ul>`
          : ""}
        ${expSoon.length
          ? `<h3 style="color:#946008;margin:18px 0 6px;font-size:15px">⏳ ล็อตใกล้หมดอายุใน 30 วัน (${expSoon.length})</h3>
             <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.9">
               ${expSoon.map((l) => `<li>${l.itemId} · ล็อต ${l.lotNo} — หมดอายุ ${l.expiry} · เหลือ ${l.qty}</li>`).join("")}
             </ul>`
          : ""}
        ${qcHold.length
          ? `<h3 style="color:#6f3b9c;margin:18px 0 6px;font-size:15px">⏸ ล็อตรอ QC / กักกัน — เบิกไม่ได้ (${qcHold.length})</h3>
             <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.9">
               ${qcHold.map((l) => `<li>${l.itemId} · ล็อต ${l.lotNo} — ${l.qcStatus}</li>`).join("")}
             </ul>`
          : ""}
        ${!w.length && !b.length && !s.length && !tk.length ? '<p style="color:#00a65a;font-weight:600">ทีมคุณไม่มีงานค้าง 🎉</p>' : ""}

        <p style="color:#8a9099;font-size:12px;margin-top:22px;border-top:1px solid #e0e3e6;padding-top:12px">
          Ticket ค้างทั้งระบบ: ${openTickets.length} ใบ · อีเมลนี้ส่งอัตโนมัติทุกเช้า
        </p>
      </div>`;

    await sendMail(to, `[OMS] สรุปงานประจำวัน — ทีม ${d.th}`, html);
    sent.push(d.key);
  }

  /* สำเนาส่วนกลาง (notifyEmails) — ส่งฉบับเดียว รวมทุกทีม */
  if (globalTo.length) {
    const allRows = (m: Map<string, Row[]>) =>
      [...m.entries()].flatMap(([team, rows]) => rows.map((r) => ({ ...r, text: `[${team}] ${r.text}` })));

    const html = `
      <div style="font-family:Sarabun,Arial,sans-serif;max-width:680px">
        <h2 style="color:#15325b;margin:0 0 2px">Revomed OMS — สรุปทั้งบริษัท</h2>
        <p style="color:#8a9099;margin:0 0 4px;font-size:13px">${today()}</p>
        ${sec("📋 งานค้างทุกทีม", allRows(waiting))}
        ${sec("⚠️ ติดปัญหา", allRows(blocked), "#b23324")}
        ${sec("» ขั้นที่ข้ามไว้", allRows(skipped), "#946008")}
        ${sec("🔴 เลยกำหนดส่งลูกค้า", lateShip, "#b23324")}
        ${lowStock.length
          ? `<h3 style="color:#b23324;margin:18px 0 6px;font-size:15px">📦 สต็อกต่ำกว่า Safety (${lowStock.length})</h3>
             <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.9">
               ${lowStock.map((x) => `<li>${x.name} — ใช้ได้ ${Number(x.qty) - Number(x.reserved)} ${x.unit}</li>`).join("")}
             </ul>` : ""}
        <p style="color:#8a9099;font-size:12px;margin-top:22px">Ticket ค้างทั้งระบบ: ${openTickets.length} ใบ</p>
      </div>`;
    await sendMail(globalTo, `[OMS] สรุปงานประจำวัน — ทั้งบริษัท`, html);
    sent.push("(global)");
  }

  return ok({
    sent,
    stats: {
      waiting: [...waiting.values()].reduce((a, x) => a + x.length, 0),
      blocked: [...blocked.values()].reduce((a, x) => a + x.length, 0),
      skipped: [...skipped.values()].reduce((a, x) => a + x.length, 0),
      lateShip: lateShip.length,
      lowStock: lowStock.length,
    },
  });
});
