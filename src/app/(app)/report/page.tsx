"use client";
import { useData } from "@/lib/store";
import { Empty, Kpi, Panel, Team } from "@/components/ui";
import { bottlenecks } from "@/lib/domain";
import { TEAM_CLS } from "@/lib/utils";

/** คอขวด — เวลาเฉลี่ยจริง vs lead มาตรฐาน (จากงานที่ปิดแล้ว) */
export default function ReportPage() {
  const { data, loading } = useData();
  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const rows = bottlenecks(data);
  const maxAvg = Math.max(...rows.map((r) => Math.max(r.avg, r.step.lead)), 1);
  const tDev = data.workflow.reduce((a, w) => a + w.lead, 0);
  const tProd = data.production.reduce((a, w) => a + w.lead, 0);
  const worst = rows[0];

  return (
    <>
      <div className="kpi-row three">
        <Kpi k={1} label="Lead time รวมทั้ง Flow"
          value={<>{tDev + tProd}<span style={{ fontSize: 15 }}> วัน</span></>}
          delta={`≈ ${((tDev + tProd) / 30).toFixed(1)} เดือน`} />
        <Kpi k={3} label="คอขวดอันดับ 1"
          value={<span style={{ fontSize: 18 }}>{worst?.step.th ?? "—"}</span>}
          delta={worst && worst.diff > 0 ? `ช้ากว่ามาตรฐาน ${worst.diff.toFixed(1)} วัน` : "ยังไม่มีข้อมูลพอ"} />
        <Kpi k={5} label="ขั้นที่มีข้อมูลจริง" value={rows.length} delta="จากงานที่ปิดแล้ว" />
      </div>

      <Panel title="คอขวด (Bottleneck) — เวลาเฉลี่ยจริง vs มาตรฐาน" sub="เรียงจากช้ากว่ามาตรฐานมากสุด">
        {!rows.length ? (
          <Empty icon="▮">
            ยังไม่มีขั้นตอนที่ปิดแล้ว — ระบบต้องมีงานที่ปิดขั้นตอนจริงก่อน ถึงจะคำนวณเวลาเฉลี่ยได้
          </Empty>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>ขั้น</th><th>งาน</th><th>ทีม</th>
                  <th>เฉลี่ยจริง</th><th>Lead มาตรฐาน</th>
                  <th style={{ width: 200 }}>เทียบ (+ช้า / −เร็ว)</th><th>n</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const over = r.diff > 0;
                  const cls = over ? "age-late" : r.diff <= -2 ? "age-ok" : "age-warn";
                  return (
                    <tr key={r.step.id}>
                      <td><span className="code">{r.isProd ? `P${r.step.id - 100}` : `#${r.step.id}`}</span></td>
                      <td><b style={{ color: "var(--navy)" }}>{r.step.th}</b></td>
                      <td><Team cls={TEAM_CLS[r.step.team]}>{r.step.team}</Team></td>
                      <td style={{ fontWeight: 700 }}>{r.avg.toFixed(1)} วัน</td>
                      <td>{r.step.lead} วัน</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 90, background: "var(--line)", borderRadius: 3, height: 16, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", width: `${(r.avg / maxAvg) * 100}%`,
                              background: over ? "var(--block)" : "var(--ok)",
                            }} />
                          </div>
                          <span className={`age ${cls}`}>{over ? "+" : ""}{r.diff.toFixed(1)}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.n} งาน</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="legend">
              <span><b style={{ color: "var(--block)" }}>แดง</b> = ช้ากว่า lead มาตรฐาน (คอขวดจริง)</span>
              <span><b style={{ color: "var(--ok)" }}>เขียว</b> = เร็วกว่ามาตรฐาน (ตั้ง lead เผื่อไว้เยอะเกินไป)</span>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
