import type { AppData, Kpi } from "./types";
import { daysBetween } from "./utils";

export const KPI_MTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
export const ym = (year: number, m: number) => `${year}-${String(m + 1).padStart(2, "0")}`;
export const nowYm = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export type AutoSrc = {
  label: string;
  unit: "%" | "num";
  fn: (d: AppData, m: string) => number | null;
};

/** แหล่งข้อมูลอัตโนมัติ — คำนวณสดจากโมดูลอื่น ต่อเดือน (m = "2026-01") */
export const KPI_AUTO: Record<string, AutoSrc> = {
  otif: {
    label: "OTIF — % งานผลิตเสร็จทันกำหนด (จาก Production Tracker)",
    unit: "%",
    fn: (d, m) => {
      let tot = 0, ok = 0;
      for (const p of d.projects) {
        const ps = p.prodStages;
        if (!ps?.length) continue;
        if (!ps.every((s) => s.status === "done" || s.status === "skip")) continue;
        const done = ps.reduce((mx, s) => (s.done && s.done > mx ? s.done : mx), "");
        if (!done || done.slice(0, 7) !== m) continue;
        tot++;
        if (!p.dueDate || done <= p.dueDate) ok++;
      }
      return tot ? (ok / tot) * 100 : null;
    },
  },

  oee: {
    label: "OEE เฉลี่ยทุกไลน์ (จาก Plant Output)",
    unit: "%",
    fn: (d, m) => {
      let sum = 0, n = 0;
      for (const ln of d.lines) {
        const outs = d.lineOutput.filter((o) => o.lineId === ln.id && String(o.date).slice(0, 7) === m);
        if (!outs.length || !ln.capacity) continue;
        let hours = 0, dt = 0, qty = 0, def = 0;
        for (const o of outs) {
          hours += Number(o.hours) || 0;
          dt += Number(o.downtime) || 0;
          qty += o.qty || 0;
          def += o.defect || 0;
        }
        if (hours <= 0) continue;
        const run = Math.max(hours - dt, 0);
        const A = run / hours;
        const P = run > 0 ? Math.min(qty / (run * (ln.capacity / 8)), 1) : 0;
        const Q = qty > 0 ? (qty - def) / qty : 0;
        sum += A * P * Q * 100;
        n++;
      }
      return n ? sum / n : null;
    },
  },

  tkOnTime: {
    label: "% Ticket ปิดทันกำหนด (จาก Ticket)",
    unit: "%",
    fn: (d, m) => {
      let tot = 0, ok = 0;
      for (const t of d.tickets) {
        if (t.status !== "done") continue;
        const upd = String(t.updatedAt).slice(0, 10);
        if (upd.slice(0, 7) !== m) continue;
        tot++;
        if (!t.due || upd <= t.due) ok++;
      }
      return tot ? (ok / tot) * 100 : null;
    },
  },

  tkCount: {
    label: "จำนวน Ticket เปิดใหม่ในเดือน (จาก Ticket)",
    unit: "num",
    fn: (d, m) => {
      const n = d.tickets.filter((t) => String(t.createdAt).slice(0, 7) === m).length;
      return n || null;
    },
  },

  slaStage: {
    label: "% ขั้นตอนปิดภายใน Lead Time (จาก Tracker/SLA)",
    unit: "%",
    fn: (d, m) => {
      let tot = 0, ok = 0;
      for (const p of d.projects) {
        for (const [kind, list] of [["dev", p.stages], ["prod", p.prodStages ?? []]] as const) {
          const steps = kind === "dev" ? d.workflow : d.production;
          for (const s of list) {
            if (s.status !== "done" || !s.done || !s.start) continue;
            if (s.done.slice(0, 7) !== m) continue;
            const w = steps.find((x) => x.id === s.sid);
            if (!w) continue;
            tot++;
            if (daysBetween(s.start, s.done) <= (w.lead || 0)) ok++;
          }
        }
      }
      return tot ? (ok / tot) * 100 : null;
    },
  },

  stockMoves: {
    label: "จำนวนรายการเคลื่อนไหวสต็อกในเดือน (จาก Stock)",
    unit: "num",
    fn: (d, m) => {
      const n = d.moves.filter((x) => String(x.ts).slice(0, 7) === m).length;
      return n || null;
    },
  },
};

/** ค่าของ KPI ในเดือนนั้น — AUTO คำนวณสด, manual อ่านจาก vals */
export function kpiValOf(k: Kpi, d: AppData, m: string): number | null {
  if (k.src && k.src !== "manual") {
    const a = KPI_AUTO[k.src];
    if (!a) return null;
    const v = a.fn(d, m);
    return v ?? null;
  }
  const v = k.vals?.[m];
  return v === undefined || v === null ? null : Number(v);
}

/** ผ่านเป้าไหม — null = ยังไม่มีข้อมูล */
export function kpiPass(k: Kpi, v: number | null): boolean | null {
  if (v === null) return null;
  return k.op === "<=" ? v <= Number(k.target) : v >= Number(k.target);
}

export function kpiFmt(k: Kpi, v: number | null): string {
  if (v === null) return "—";
  const r = Math.round(v * 100) / 100;
  return k.unit === "%" ? `${r}%` : String(r);
}

export const isAuto = (k: Kpi) => !!k.src && k.src !== "manual";
