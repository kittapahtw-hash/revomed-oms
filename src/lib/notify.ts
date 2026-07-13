import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { config, departments, users } from "@/db/schema";
import { sendMail } from "./mail";
import type { Step } from "./types";

async function teamEmails(teamKey: string): Promise<string[]> {
  const [d] = await db.select().from(departments).where(eq(departments.key, teamKey)).limit(1);
  const cfg = await db.select().from(config);
  const global = (cfg.find((c) => c.key === "notifyEmails")?.value || "")
    .split(/[,;\s]+/).filter(Boolean);
  return [...new Set([d?.email, ...global].filter(Boolean) as string[])];
}

const wrap = (title: string, body: string) => `
  <div style="font-family:Sarabun,Arial,sans-serif;max-width:600px">
    <h2 style="color:#15325b;margin:0 0 12px">${title}</h2>
    ${body}
    <p style="color:#8a9099;font-size:12px;margin-top:24px;border-top:1px solid #e0e3e6;padding-top:12px">
      Revomed OMS — อีเมลนี้ส่งอัตโนมัติจากระบบ
    </p>
  </div>`;

/** แทน notifyStage() เดิม — งานส่งต่อถึงทีมไหน ยิงเมลบอกทีมนั้น */
export async function notifyStage(
  project: { id: string; name: string; dueDate: string | null },
  step: Step,
  reason: string
) {
  const to = await teamEmails(step.team);
  if (!to.length) return;
  await sendMail(to, `[OMS] ${reason} — ${project.name}`, wrap(reason, `
    <p><b>โปรเจกต์:</b> ${project.id} · ${project.name}</p>
    <p><b>ขั้นตอน:</b> ${step.th} <span style="color:#8a9099">(${step.en})</span></p>
    <p><b>ทีมรับผิดชอบ:</b> ${step.team}</p>
    <p><b>Lead time มาตรฐาน:</b> ${step.lead} วัน</p>
    ${project.dueDate ? `<p><b>กำหนดส่งลูกค้า:</b> ${project.dueDate}</p>` : ""}
    ${step.gate ? `<p style="color:#8a4fbf"><b>🚦 ต้องรอลูกค้าเคาะ:</b> ${step.gate}</p>` : ""}
  `));
}

/** แทน notifyTicket() เดิม — ถูกมอบหมาย ticket แล้วได้เมล */
export async function notifyTicket(
  t: { id: string; title: string; desc: string; toTeam: string; assignee: string; priority: string; due: string | null },
  kind: "new" | "assign" | "done"
) {
  const to = new Set<string>(await teamEmails(t.toTeam));
  if (t.assignee) {
    const all = await db.select().from(users);
    const u = all.find((x) => x.name === t.assignee);
    if (u?.email) to.add(u.email);
  }
  if (!to.size) return;

  const title = kind === "new" ? "มี Ticket ใหม่ถึงทีมคุณ"
    : kind === "assign" ? "คุณถูกมอบหมาย Ticket"
    : "Ticket ถูกปิดแล้ว";

  await sendMail([...to], `[OMS] ${title} — ${t.title}`, wrap(title, `
    <p><b>${t.id}</b> · ${t.title}</p>
    ${t.desc ? `<p style="color:#5b636b">${t.desc}</p>` : ""}
    <p><b>ทีม:</b> ${t.toTeam || "—"} · <b>ผู้รับผิดชอบ:</b> ${t.assignee || "ยังไม่ระบุ"}</p>
    <p><b>ความสำคัญ:</b> ${t.priority}${t.due ? ` · <b>กำหนดเสร็จ:</b> ${t.due}` : ""}</p>
  `));
}
