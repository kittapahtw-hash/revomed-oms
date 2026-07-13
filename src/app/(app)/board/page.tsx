"use client";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/store";
import { Team } from "@/components/ui";
import { curIdx } from "@/lib/stage";
import { TEAM_CLS, daysBetween, today } from "@/lib/utils";
import type { AppData } from "@/lib/types";

/** บอร์ดทีม — แยก 2 เฟส นับ "รายขั้นตอน" ไม่ใช่รายโปรเจกต์
 *  On process = กำลังทำปกติ · At Risk = ติดปัญหา/ดองเกิน SLA/ข้ามไว้ · Done = ปิดแล้ว */
export default function BoardPage() {
  const { data, loading } = useData();
  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  return (
    <>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
        แยกตามเฟส · <b style={{ color: "var(--run)" }}>On process</b> กำลังทำปกติ ·{" "}
        <b style={{ color: "var(--block)" }}>At Risk</b> ติดปัญหา / ดองเกิน SLA / ข้ามไว้ ·{" "}
        <b style={{ color: "var(--ok)" }}>Done</b> เสร็จแล้ว
      </div>
      <BoardBox d={data} phase="dev" title="Pre-production"
        subtitle={`ก่อนเปิด PO · ${data.workflow.length} ขั้น`} />
      <BoardBox d={data} phase="prod" title="Production"
        subtitle={`หลังเปิด PO · ${data.production.length} ขั้น`} />
    </>
  );
}

function BoardBox({ d, phase, title, subtitle }: {
  d: AppData; phase: "dev" | "prod"; title: string; subtitle: string;
}) {
  const router = useRouter();
  const isProd = phase === "prod";
  const steps = isProd ? d.production : d.workflow;

  // ทีมที่โผล่ในเฟสนี้ — ดึงจาก workflow จริง ไม่ hardcode
  const teams = [...new Set(steps.map((s) => s.team))];

  const projs = d.projects.filter(
    (p) => !p.archived && (isProd ? p.phase !== "dev" && !!p.prodStages?.length : p.phase === "dev")
  );

  const tally: Record<string, { on: number; risk: number; done: number }> = {};
  teams.forEach((t) => { tally[t] = { on: 0, risk: 0, done: 0 }; });

  for (const p of projs) {
    const arr = isProd ? (p.prodStages ?? []) : p.stages;
    if (!arr.length) continue;
    const ci = curIdx(arr);

    arr.forEach((s, i) => {
      const w = steps.find((x) => x.id === s.sid);
      if (!w || !tally[w.team]) return;

      if (s.status === "done") tally[w.team].done++;
      else if (s.status === "skip") tally[w.team].risk++;
      else if (i === ci && s.status !== "wait") {
        const breach = !!s.start && daysBetween(s.start, today()) > w.lead;
        if (s.status === "block" || breach) tally[w.team].risk++;
        else tally[w.team].on++;
      }
    });
  }

  const total = teams.reduce(
    (a, t) => ({ on: a.on + tally[t].on, risk: a.risk + tally[t].risk, done: a.done + tally[t].done }),
    { on: 0, risk: 0, done: 0 }
  );

  const Cell = ({ v, type }: { v: number; type: "on" | "risk" | "done" }) => {
    const cls = v === 0 ? "bd-zero" : type === "on" ? "bd-on" : type === "risk" ? "bd-risk" : "bd-done";
    const clickable = v > 0 && type !== "done";
    return (
      <div className="bd-cell num">
        <span className={`bd-num-pill ${cls}${clickable ? " click" : ""}`}
          onClick={clickable ? () => router.push("/aging") : undefined}
          title={clickable ? "ดูรายละเอียดที่หน้างานดอง/SLA" : undefined}>
          {v}
        </span>
      </div>
    );
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        <span className="sub">{subtitle} · {projs.length} โปรเจกต์</span>
      </div>
      <div className="bd-grid">
        <div className="bd-cell bd-head-c main">ทีม / Team</div>
        <div className="bd-cell bd-head-c num">On process</div>
        <div className="bd-cell bd-head-c num">At Risk</div>
        <div className="bd-cell bd-head-c num">Done</div>

        {teams.map((t) => (
          <div key={t} style={{ display: "contents" }}>
            <div className="bd-cell"><Team cls={TEAM_CLS[t] ?? "t-plant"}>{t}</Team></div>
            <Cell v={tally[t].on} type="on" />
            <Cell v={tally[t].risk} type="risk" />
            <Cell v={tally[t].done} type="done" />
          </div>
        ))}

        <div className="bd-total" style={{ display: "contents" }}>
          <div className="bd-cell">รวม / Total</div>
          <Cell v={total.on} type="on" />
          <Cell v={total.risk} type="risk" />
          <Cell v={total.done} type="done" />
        </div>
      </div>
    </div>
  );
}
