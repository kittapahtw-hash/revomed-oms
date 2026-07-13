"use client";
import Link from "next/link";
import { useData } from "@/lib/store";
import { Bar, Empty, Kpi, Panel, Team } from "@/components/ui";
import { currentStage, progress, stagesFor } from "@/lib/domain";
import { dueCls } from "@/lib/utils";

/** ภาพรวมตลอดสาย — Funnel: พัฒนา → พร้อม PO → กำลังผลิต → ผลิตเสร็จ */
export default function SummaryPage() {
  const { data, loading } = useData();
  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const act = data.projects.filter((p) => !p.archived);

  const devAllDone = (p: (typeof act)[number]) =>
    p.stages.length > 0 && p.stages.every((s) => s.status === "done" || s.status === "skip");
  const prodAllDone = (p: (typeof act)[number]) =>
    !!p.prodStages?.length && p.prodStages.every((s) => s.status === "done" || s.status === "skip");

  const inDev = act.filter((p) => p.phase === "dev" && !devAllDone(p)).length;
  const ready = act.filter((p) => p.phase === "dev" && devAllDone(p)).length;   // ครบ dev แล้ว = พร้อมเปิด PO
  const producing = act.filter((p) => p.phase === "prod" && !prodAllDone(p)).length;
  const complete = act.filter((p) => p.phase === "done" || prodAllDone(p)).length;

  const max = Math.max(inDev, ready, producing, complete, 1);
  const funnel: [string, number, string][] = [
    ["Phase 1 · พัฒนา", inDev, "var(--blue)"],
    ["พร้อมเปิด PO", ready, "var(--gold)"],
    ["Phase 2 · กำลังผลิต", producing, "var(--prod)"],
    ["ผลิตเสร็จ", complete, "var(--ok)"],
  ];

  const totalDev = data.workflow.reduce((a, w) => a + w.lead, 0);
  const totalProd = data.production.reduce((a, w) => a + w.lead, 0);
  const nSteps = data.workflow.length + data.production.length;

  return (
    <>
      <Panel title="ภาพรวมตลอดสาย (Funnel)" sub="มีงานค้างอยู่ช่วงไหนบ้าง">
        <div className="funnel" style={{ padding: "8px 14px 14px" }}>
          {funnel.map(([n, c, col]) => (
            <div key={n} className="fstep">
              <div className="fn">{n}</div>
              <div className="fc" style={{ color: col }}>{c}</div>
              <div className="fbar" style={{ background: col, width: `${Math.round((c / max) * 100)}%`, minWidth: 14 }} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="kpi-row three">
        <Kpi k={1} label="Lead time รวมทั้ง Flow"
          value={<>{totalDev + totalProd}<span style={{ fontSize: 15 }}> วัน</span></>}
          delta={`พัฒนา ${totalDev} + ผลิต ${totalProd} ≈ ${((totalDev + totalProd) / 30).toFixed(1)} เดือน`} />
        <Kpi k={4} label="ขั้นตอนทั้งหมด" value={nSteps}
          delta={`Dev ${data.workflow.length} + ผลิต ${data.production.length}`} />
        <Kpi k={5} label="โปรเจกต์ในระบบ" value={act.length} delta="active ทั้งหมด" />
      </div>

      <Panel title="สรุปทุกโปรเจกต์ทั้ง Flow" sub="Dev → PO → ผลิต">
        {!act.length ? <Empty icon="◎">ยังไม่มีโปรเจกต์</Empty> : (
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>สินค้า</th><th>เฟส</th><th>ขั้นปัจจุบัน</th>
                <th>กำหนดส่ง</th><th>ขั้นเสร็จแล้ว</th><th style={{ width: 130 }}>คืบหน้า</th>
              </tr>
            </thead>
            <tbody>
              {act.map((p) => {
                const c = currentStage(p, data);
                const st = stagesFor(p);
                const done = st.filter((s) => s.status === "done" || s.status === "skip").length;
                const badge = p.phase === "prod"
                  ? <Team cls="t-plant">ผลิต</Team>
                  : devAllDone(p)
                    ? <span className="team" style={{ background: "var(--gold-bg)", color: "var(--gold)" }}>พร้อม PO</span>
                    : <Team cls="t-sale">พัฒนา</Team>;
                return (
                  <tr key={p.id} className="clickable">
                    <td><span className="code">{p.id}</span></td>
                    <td><Link href={`/projects/${p.id}`} style={{ fontWeight: 700, color: "var(--navy)" }}>{p.name}</Link></td>
                    <td>{badge}</td>
                    <td style={{ fontSize: 12.5 }}>{c?.meta.th ?? "ครบทุกขั้นตอน"}</td>
                    <td>{p.dueDate ? <span className={`due ${dueCls(p.dueDate)}`}>{p.dueDate}</span> : "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{done}/{st.length}</td>
                    <td>
                      <Bar pct={progress(p)} prod={p.phase === "prod"} />
                      <div className="pmeta">{progress(p)}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
