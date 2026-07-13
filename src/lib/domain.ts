import type { AppData, Project, Step } from "./types";
import type { StageState } from "@/db/schema";
import { allDone, allPassed, curIdx, skipsOf } from "./stage";
import { daysBetween, today } from "./utils";

/** โปรเจกต์อยู่ในสายผลิตหรือยัง — phase "done" ก็ยังต้องอ่าน prodStages นะเว้ย
 *  (เคยพลาดตรงนี้: เช็คแค่ === "prod" แล้ว phase done ตกไปอ่าน dev stages ทั้งระบบเพี้ยน) */
export const isProdPhase = (p: Project) => p.phase !== "dev" && !!p.prodStages?.length;

export function stepsFor(p: Project, d: AppData): Step[] {
  return isProdPhase(p) ? d.production : d.workflow;
}
export function stagesFor(p: Project): StageState[] {
  return isProdPhase(p) ? (p.prodStages ?? []) : p.stages;
}

/** ขั้นที่กำลังทำอยู่ + นิยามของขั้นนั้น */
export function currentStage(p: Project, d: AppData) {
  const arr = stagesFor(p);
  if (!arr.length) return null;
  const i = curIdx(arr);
  const stage = arr[i];
  const meta = stepsFor(p, d).find((x) => x.id === stage.sid);
  return meta ? { stage, meta, idx: i } : null;
}

/** สถานะรวมของโปรเจกต์ — ตรงกับ projStatus() เดิม */
export function projStatus(p: Project): string {
  const arr = stagesFor(p);
  if (!arr.length) return "wait";
  if (isProdPhase(p)) {
    if (allDone(arr)) return "complete";
    if (allPassed(arr)) return "skip";
    return arr[curIdx(arr)].status;
  }
  if (allDone(arr)) return "ready";          // dev ครบ = พร้อมเปิด PO
  if (allPassed(arr)) return "skip";
  return arr[curIdx(arr)].status;
}

/** pill สถานะ — ตรงกับ statusPill() เดิม */
export const STATUS_PILL: Record<string, [string, string]> = {
  done: ["done", "เสร็จ"],
  run: ["run", "กำลังทำ"],
  wait: ["wait", "รอคิว"],
  block: ["block", "ติดปัญหา"],
  gate: ["gate", "รอตัดสินใจ"],
  ready: ["ready", "พร้อมเปิด PO"],
  prod: ["prod", "กำลังผลิต"],
  prodrun: ["prod", "กำลังผลิต"],
  complete: ["complete", "ผลิตเสร็จ"],
  skip: ["skip", "ข้ามไว้"],
};

export function devDone(p: Project) { return p.stages.filter((s) => s.status === "done").length; }
export function prodDoneN(p: Project) { return (p.prodStages ?? []).filter((s) => s.status === "done").length; }

/** % รวมทั้ง flow — dev + prod เทียบจำนวนขั้นทั้งหมด */
export function overallPct(p: Project, d: AppData) {
  const total = d.workflow.length + d.production.length;
  if (!total) return 0;
  return Math.round(((devDone(p) + prodDoneN(p)) / total) * 100);
}

/** % ของเฟสปัจจุบัน */
export function progress(p: Project) {
  const arr = stagesFor(p);
  if (!arr.length) return 0;
  return Math.round((arr.filter((s) => s.status === "done").length / arr.length) * 100);
}

export const devAllDone = (p: Project) => allDone(p.stages);
export const prodAllDone = (p: Project) => allDone(p.prodStages ?? []);
export const pendingSkips = (p: Project) => skipsOf(stagesFor(p)).length;

/** SLA ของขั้นที่กำลังทำ — null ถ้าปิดครบ / ยังไม่เริ่ม / ข้ามไว้ */
export function slaInfo(p: Project, d: AppData) {
  const c = currentStage(p, d);
  if (!c) return null;
  const arr = stagesFor(p);
  if (allDone(arr)) return null;
  const { stage, meta } = c;
  if (!stage.start || stage.status === "wait" || stage.status === "skip") return null;
  const age = daysBetween(stage.start, today());
  const over = age - meta.lead;
  return {
    age, lead: meta.lead, over,
    breach: over > 0,
    blocked: stage.status === "block",
    step: meta, team: meta.team, status: stage.status,
  };
}

export function aging(p: Project, d: AppData) {
  const s = slaInfo(p, d);
  if (!s) return { days: 0, late: false, lead: 0, blocked: false };
  return { days: s.age, late: s.breach, lead: s.lead, blocked: s.blocked };
}

/** คาดการณ์วันเสร็จ = วันนี้ + ผลรวม lead ของขั้นที่ยังไม่ปิด */
export function eta(p: Project, d: AppData): string | null {
  const arr = stagesFor(p);
  const steps = stepsFor(p, d);
  const remaining = arr.filter((s) => s.status !== "done");
  if (!remaining.length) return null;
  const days = remaining.reduce((sum, s) => sum + (steps.find((x) => x.id === s.sid)?.lead ?? 0), 0);
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysLeft(due: string | null): number | null {
  if (!due) return null;
  return daysBetween(today(), due);
}

/** OEE = Availability × Performance × Quality */
export function oee(rows: AppData["lineOutput"], lineId: string, capacityPerDay: number) {
  const mine = rows.filter((r) => r.lineId === lineId);
  if (!mine.length) return null;
  const hours = mine.reduce((s, r) => s + Number(r.hours), 0);
  const downtime = mine.reduce((s, r) => s + Number(r.downtime), 0);
  const qty = mine.reduce((s, r) => s + r.qty, 0);
  const defect = mine.reduce((s, r) => s + r.defect, 0);
  const runTime = hours - downtime;
  if (hours <= 0 || runTime <= 0 || !capacityPerDay) return null;

  const availability = runTime / hours;
  const idealRate = capacityPerDay / 8;             // ชิ้น/ชม. อ้างอิงกะ 8 ชม.
  const performance = Math.min(1.5, qty / (idealRate * runTime));   // เดิม cap ที่ 1.5 ไม่ใช่ 1
  const quality = qty > 0 ? (qty - defect) / qty : 1;                // ไม่มีของ = ยังไม่มีของเสีย
  return {
    availability, performance, quality,
    oee: availability * performance * quality,
    qty, defect, hours, downtime,
  };
}

export function lowStock(d: AppData) {
  // ของเดิมใช้ <= (เท่ากับ safety พอดี = เตือน) อย่าเปลี่ยนเป็น < นะเว้ย
  return d.stock.filter((s) => Number(s.available) <= Number(s.safety));
}

/** คอขวด — เวลาเฉลี่ยจริงต่อขั้น เทียบ lead มาตรฐาน */
export function bottlenecks(d: AppData) {
  const acc = new Map<number, { sum: number; n: number }>();
  for (const p of d.projects) {
    for (const list of [p.stages, p.prodStages ?? []]) {
      for (const s of list) {
        if (s.status !== "done" || !s.start || !s.done) continue;
        const cur = acc.get(s.sid) ?? { sum: 0, n: 0 };
        cur.sum += daysBetween(s.start, s.done);
        cur.n++;
        acc.set(s.sid, cur);
      }
    }
  }
  const all = [...d.workflow, ...d.production];
  return [...acc.entries()]
    .map(([id, v]) => {
      const w = all.find((x) => x.id === id);
      if (!w) return null;
      const avg = v.sum / v.n;
      return { step: w, n: v.n, avg, diff: avg - w.lead, isProd: id > 100 };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.diff - a.diff);
}

/** ป้ายขั้นปัจจุบัน — ตรงกับ currentStepInfo() เดิม
 *  dev  : "#3 เคาะราคาวัตถุดิบ"  |  "Dev ครบ — พร้อมเปิด PO"
 *  prod : "ผลิต #2 Planning ทำ BOM"  |  "ผลิตเสร็จสมบูรณ์"
 *  ถ้าขั้นนั้นถูกข้ามไว้ ต่อท้ายด้วย " (ข้ามไว้)" */
export function currentStepInfo(p: Project, d: AppData): { label: string; team: string | null } {
  const st = projStatus(p);
  if (isProdPhase(p)) {
    if (st === "complete") return { label: "ผลิตเสร็จสมบูรณ์", team: null };
    const c = currentStage(p, d);
    if (!c) return { label: "—", team: null };
    return {
      label: `ผลิต #${c.meta.id - 100} ${c.meta.th}${c.stage.status === "skip" ? " (ข้ามไว้)" : ""}`,
      team: c.meta.team,
    };
  }
  if (st === "ready") return { label: "Dev ครบ — พร้อมเปิด PO", team: null };
  const c = currentStage(p, d);
  if (!c) return { label: "—", team: null };
  return {
    label: `#${c.meta.id} ${c.meta.th}${c.stage.status === "skip" ? " (ข้ามไว้)" : ""}`,
    team: c.meta.team,
  };
}

export const isBreach = (p: Project, d: AppData) => !!slaInfo(p, d)?.breach;

/** จำนวนขั้นที่ข้ามไว้ทั้งโปรเจกต์ (dev + prod) */
export const allSkips = (p: Project) =>
  skipsOf(p.stages).length + skipsOf(p.prodStages ?? []).length;

/* ---------- LOT / EXPIRY ---------- */
export const QC_TH: Record<string, string> = {
  pending: "รอ QC", passed: "QC ผ่าน", failed: "QC ไม่ผ่าน", quarantine: "กักกัน",
};
export const QC_PILL: Record<string, string> = {
  pending: "wait", passed: "done", failed: "block", quarantine: "gate",
};

/** ล็อตนี้เบิกได้ไหม (ฝั่ง client — ตรรกะเดียวกับ lotBlockedReason ฝั่ง server) */
export function lotBlocked(l: { expiry: string | null; qcStatus: string; qty: string }): string | null {
  if (Number(l.qty) <= 0) return "หมดแล้ว";
  if (l.qcStatus === "failed") return "QC ไม่ผ่าน";
  if (l.qcStatus === "quarantine") return "กักกัน";
  if (l.qcStatus === "pending") return "รอ QC";
  if (l.expiry && l.expiry < today()) return "หมดอายุ";
  return null;
}

/** เหลืออีกกี่วันหมดอายุ (null = ไม่มีวันหมดอายุ) */
export const daysToExpiry = (l: { expiry: string | null }) =>
  l.expiry ? daysBetween(today(), l.expiry) : null;

/** ล็อตที่ต้องรีบใช้ / หมดแล้ว */
export function expiryAlerts(d: AppData, within = 30) {
  const live = d.lots.filter((l) => Number(l.qty) > 0);
  return {
    expired: live.filter((l) => l.expiry && l.expiry < today()),
    soon: live.filter((l) => {
      const n = daysToExpiry(l);
      return n !== null && n >= 0 && n <= within;
    }),
    quarantine: live.filter((l) => l.qcStatus === "quarantine" || l.qcStatus === "pending"),
    failed: live.filter((l) => l.qcStatus === "failed"),
  };
}
