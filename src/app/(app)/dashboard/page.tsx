"use client";
import Link from "next/link";
import { useData } from "@/lib/store";
import { Empty, Kpi, Panel } from "@/components/ui";
import { ProjectRow } from "@/components/ProjectRow";
import {
  allSkips, daysLeft, devAllDone, isBreach, isProdPhase, lowStock, prodAllDone, projStatus,
} from "@/lib/domain";

export default function Dashboard() {
  const { data, loading } = useData();
  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const act = data.projects.filter((p) => !p.archived);

  const inDev = act.filter((p) => p.phase === "dev" && !devAllDone(p)).length;
  const producing = act.filter((p) => isProdPhase(p) && !prodAllDone(p)).length;
  const breach = act.filter((p) => isBreach(p, data)).length;
  const blocked = act.filter((p) => projStatus(p) === "block").length;
  const overdue = act.filter(
    (p) => isProdPhase(p) && !prodAllDone(p) && (daysLeft(p.dueDate) ?? 999) < 0
  ).length;

  const lows = lowStock(data);
  const skippedTotal = act.reduce((a, p) => a + allSkips(p), 0);

  return (
    <>
      {!!lows.length && (
        <div className="alert-strip">
          <span>⚠</span>
          <span>
            สต็อกต่ำกว่า Safety Stock {lows.length} รายการ: {lows.slice(0, 3).map((x) => x.name).join(", ")}
            {lows.length > 3 && ` และอีก ${lows.length - 3} รายการ`}
          </span>
          <Link href="/stock" className="btn btn-sm">ไปหน้าสต็อก</Link>
        </div>
      )}
      {!!skippedTotal && (
        <div className="alert-strip" style={{ background: "var(--skip-bg)", borderColor: "#e3cf8e", color: "var(--skip)" }}>
          <span>»</span>
          <span>มีขั้นตอนที่ข้ามไว้ {skippedTotal} ขั้น — ต้องกลับมาทำให้ครบก่อนปิดงาน</span>
        </div>
      )}

      <div className="kpi-row five">
        <Kpi k={1} label="กำลังพัฒนา" value={inDev} delta="Phase 1 (ก่อน PO)" />
        <Kpi k={5} label="กำลังผลิต" value={producing} delta="อยู่ในโรงงาน" />
        <Kpi k={3} label="ดองเกิน SLA"
          value={<span style={{ color: breach ? "var(--block)" : "var(--navy)" }}>{breach}</span>}
          delta="ค้างเกิน lead time" />
        <Kpi k={2} label="ติดปัญหา" value={blocked} delta="ต้องเคลียร์" />
        <Kpi k={4} label="เลยกำหนดส่ง"
          value={<span style={{ color: overdue ? "var(--block)" : "var(--navy)" }}>{overdue}</span>}
          delta="งานผลิต overdue" />
      </div>

      <Panel title="โปรเจกต์ทั้งหมด" sub={`${act.length} รายการ`}
        right={<Link href="/projects" className="btn btn-sm">ดูทั้งหมด →</Link>}>
        {!act.length ? <Empty icon="▤">ยังไม่มีโปรเจกต์</Empty> : (
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>โปรเจกต์ / ลูกค้า</th><th>ขั้นปัจจุบัน</th>
                <th>ทีม</th><th>สถานะ / SLA</th>
                <th style={{ width: 170 }}>คืบหน้า ({data.workflow.length + data.production.length} ขั้น)</th>
              </tr>
            </thead>
            <tbody>
              {act.map((p) => <ProjectRow key={p.id} p={p} d={data} />)}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
