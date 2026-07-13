"use client";
import Link from "next/link";
import { useData } from "@/lib/store";
import { Empty, Kpi, Panel, Pill, Team } from "@/components/ui";
import { slaInfo } from "@/lib/domain";
import { PHASE_PILL, PHASE_TH, TEAM_CLS } from "@/lib/utils";

/** งานดอง — ขั้นที่ค้างเกิน lead time · เรียงตามค้างนานสุด */
export default function AgingPage() {
  const { data, loading } = useData();
  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const list = data.projects
    .filter((p) => !p.archived)
    .map((p) => ({ p, sla: slaInfo(p, data) }))
    .filter((x): x is { p: typeof x.p; sla: NonNullable<typeof x.sla> } => x.sla !== null)
    .sort((a, b) => b.sla.over - a.sla.over);

  const breached = list.filter((x) => x.sla.breach);
  const lostDays = breached.reduce((a, x) => a + x.sla.over, 0);

  return (
    <>
      <div className="kpi-row three">
        <Kpi k={3} label="ดองเกิน SLA" value={breached.length} delta="ขั้นที่เกิน lead time" />
        <Kpi k={1} label="กำลังทำอยู่ทั้งหมด" value={list.length} delta="ขั้นที่มีคนถืออยู่" />
        <Kpi k={2} label="วันค้างรวม (ส่วนที่เกิน)" value={lostDays} delta="วัน-คนที่เสียไป" />
      </div>

      <Panel title="งานที่กำลังทำ เรียงตามค้างนานสุด" sub="นับวันจริงเทียบ lead time มาตรฐาน">
        {!list.length ? <Empty icon="✓">ไม่มีงานค้าง ทุกขั้นอยู่ในเวลา</Empty> : (
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>โปรเจกต์</th><th>ขั้นที่ค้าง</th>
                <th>ทีมรับผิดชอบ</th><th>เฟส</th><th>ค้าง / Lead</th><th>ผล</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ p, sla }) => (
                <tr key={p.id} className="clickable">
                  <td><span className="code">{p.id}</span></td>
                  <td>
                    <Link href={`/projects/${p.id}`} style={{ fontWeight: 700, color: "var(--navy)" }}>{p.name}</Link>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{sla.step.th}</td>
                  <td><Team cls={TEAM_CLS[sla.team]}>{sla.team}</Team></td>
                  <td><Pill kind={PHASE_PILL[p.phase]}>{PHASE_TH[p.phase]}</Pill></td>
                  <td style={{ fontWeight: 700, color: "var(--navy)" }}>{sla.age} / {sla.lead} วัน</td>
                  <td>
                    {sla.over > 0 ? <span className="age age-late">เกิน {sla.over} วัน</span>
                      : sla.over >= -1 ? <span className="age age-warn">ใกล้ครบ</span>
                      : <span className="age age-ok">ปกติ</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
