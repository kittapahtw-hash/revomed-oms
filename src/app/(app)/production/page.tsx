"use client";
import Link from "next/link";
import { useData } from "@/lib/store";
import { Bar, Empty, Kpi, Panel, Team } from "@/components/ui";
import { currentStage, daysLeft, progress } from "@/lib/domain";
import { TEAM_CLS, dueCls } from "@/lib/utils";

/** โรงงานกำลังผลิตอะไรอยู่ · เหลืออีกกี่วัน — เรียงตามใกล้ครบกำหนดสุด */
export default function ProductionPage() {
  const { data, loading } = useData();
  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const prod = data.projects.filter(
    (p) => p.phase === "prod" && !p.archived &&
      !(p.prodStages ?? []).every((s) => s.status === "done" || s.status === "skip")
  );

  const onLine = prod.filter((p) => currentStage(p, data)?.meta.id === 106).length;
  const overdue = prod.filter((p) => (daysLeft(p.dueDate) ?? 999) < 0).length;
  const soon = prod.filter((p) => {
    const d = daysLeft(p.dueDate);
    return d !== null && d >= 0 && d <= 3;
  }).length;

  const rows = [...prod].sort(
    (a, b) => (daysLeft(a.dueDate) ?? 999) - (daysLeft(b.dueDate) ?? 999)
  );

  return (
    <>
      <div className="kpi-row">
        <Kpi k={5} label="กำลังผลิตในโรงงาน" value={prod.length} delta="งานที่เข้าเฟสผลิตแล้ว" />
        <Kpi k={1} label="เดินไลน์ผลิตอยู่" value={onLine} delta="อยู่ขั้น Production Run" />
        <Kpi k={3} label="ใกล้ครบกำหนด (≤3 วัน)" value={soon} delta="เร่งได้แล้ว" />
        <Kpi k={2} label="เลยกำหนดส่ง" value={overdue} delta={overdue ? "overdue — ต้องเคลียร์" : "ไม่มี overdue"} />
      </div>

      <Panel title="งานที่กำลังผลิต" sub="เรียงตามใกล้ครบกำหนดสุด">
        {!rows.length ? <Empty icon="🏭">ยังไม่มีงานที่เข้าสู่การผลิต</Empty> : (
          <table>
            <thead>
              <tr>
                <th>รหัส / PO</th><th>สินค้า / ลูกค้า</th><th>ขั้นผลิตปัจจุบัน</th>
                <th>ทีม</th><th>กำหนดเสร็จ</th><th>เหลือ</th><th style={{ width: 140 }}>คืบหน้าผลิต</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const c = currentStage(p, data);
                const cust = data.customers.find((x) => x.id === p.custId);
                const left = daysLeft(p.dueDate);
                const ps = p.prodStages ?? [];
                const done = ps.filter((s) => s.status === "done" || s.status === "skip").length;
                return (
                  <tr key={p.id} className="clickable">
                    <td>
                      <span className="code">{p.id}</span>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.poNo || "ยังไม่มี PO"}</div>
                    </td>
                    <td>
                      <Link href={`/projects/${p.id}`} style={{ fontWeight: 700, color: "var(--navy)" }}>{p.name}</Link>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{cust?.name ?? "—"}</div>
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {c ? <>ผลิต #{c.meta.id - 100} {c.meta.th}</> : "—"}
                    </td>
                    <td>{c && <Team cls={TEAM_CLS[c.meta.team]}>{c.meta.team}</Team>}</td>
                    <td>{p.dueDate ? <span className={`due ${dueCls(p.dueDate)}`}>{p.dueDate}</span> : "—"}</td>
                    <td>
                      {left === null ? "—" : (
                        <span className={`age ${left < 0 ? "age-late" : left <= 3 ? "age-warn" : "age-ok"}`}>
                          {left < 0 ? `เลย ${-left} วัน` : `${left} วัน`}
                        </span>
                      )}
                    </td>
                    <td>
                      <Bar pct={progress(p)} prod />
                      <div className="pmeta">{done}/{ps.length} ขั้นผลิต</div>
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
