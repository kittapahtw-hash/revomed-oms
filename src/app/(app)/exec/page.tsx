"use client";
import Link from "next/link";
import { useData } from "@/lib/store";
import { Empty, Kpi, Panel } from "@/components/ui";
import { devAllDone, isProdPhase, lowStock, prodAllDone, slaInfo } from "@/lib/domain";
import { daysBetween, money, today } from "@/lib/utils";
import type { AppData, Project } from "@/lib/types";

const EXPORTS: [string, string][] = [
  ["projects", "โปรเจกต์"], ["stock", "สต็อก"], ["moves", "ประวัติสต็อก"],
  ["lineOutput", "ผลผลิตไลน์"], ["tickets", "Ticket"],
];

export default function ExecPage() {
  const { data, loading } = useData();
  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const act = data.projects.filter((p) => !p.archived);
  const inDev = act.filter((p) => p.phase === "dev" && !devAllDone(p));
  const producing = act.filter((p) => isProdPhase(p) && !prodAllDone(p));
  const completed = data.projects.filter((p) => prodAllDone(p));

  /** OTIF — งานที่ผลิตเสร็จ และขั้นสุดท้ายปิดไม่เกิน dueDate */
  const onTime = completed.filter((p) => {
    if (!p.dueDate || !p.prodStages?.length) return true;
    const last = p.prodStages[p.prodStages.length - 1];
    return !!last.done && last.done <= p.dueDate;
  });
  const otif = completed.length ? Math.round((onTime.length / completed.length) * 100) : null;

  const bomCost = (p: Project, d: AppData) =>
    p.bom.reduce((s, b) => {
      const it = d.stock.find((x) => x.id === b.itemId);
      return s + (it ? Number(it.cost) * b.qtyPerUnit * p.qty : 0);
    }, 0);

  const pipeCost = act.reduce((a, p) => a + bomCost(p, data), 0);

  const td = today();
  const out30 = data.lineOutput
    .filter((o) => daysBetween(o.date, td) <= 29 && daysBetween(o.date, td) >= 0)
    .reduce((a, o) => a + o.qty, 0);

  const stockVal = data.stock.reduce((a, s) => a + Number(s.qty) * Number(s.cost), 0);
  const tkOpen = data.tickets.filter((t) => t.status === "open" || t.status === "doing").length;
  const lows = lowStock(data).length;

  /** ลูกค้า Top 5 — ตามจำนวนโปรเจกต์ active */
  const cnt = new Map<string, number>();
  act.forEach((p) => { if (p.custId) cnt.set(p.custId, (cnt.get(p.custId) ?? 0) + 1); });
  const topCust = [...cnt.entries()]
    .map(([id, n]) => ({
      c: data.customers.find((x) => x.id === id),
      n,
      cost: act.filter((p) => p.custId === id).reduce((a, p) => a + bomCost(p, data), 0),
    }))
    .filter((x) => x.c)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  /** งานเสี่ยงสุด 5 อันดับ */
  const risky = act
    .map((p) => ({ p, sla: slaInfo(p, data) }))
    .filter((x): x is { p: Project; sla: NonNullable<ReturnType<typeof slaInfo>> } => !!x.sla && x.sla.over > 0)
    .sort((a, b) => b.sla.over - a.sla.over)
    .slice(0, 5);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", alignSelf: "center", marginRight: 4 }}>
          Export รายงาน (CSV เปิดใน Excel ได้เลย):
        </span>
        {EXPORTS.map(([k, label]) => (
          <a key={k} className="btn btn-sm" href={`/api/export?sheet=${k}`}>⬇ {label}</a>
        ))}
      </div>

      <div className="kpi-row">
        <Kpi k={1} label="Pipeline (ต้นทุนวัตถุดิบ)"
          value={<span style={{ fontSize: 22 }}>{money(pipeCost)} ฿</span>}
          delta={`${act.length} โปรเจกต์ active`} />
        <Kpi k={5} label="ยอดผลิต 30 วัน"
          value={<span style={{ fontSize: 22 }}>{out30.toLocaleString()}</span>}
          delta="ชิ้น (ทุกไลน์)" />
        <Kpi k={otif !== null && otif < 80 ? 2 : 4} label="ส่งตรงเวลา (OTIF)"
          value={otif === null ? "—" : `${otif}%`}
          delta={`จากงานปิดแล้ว ${completed.length} งาน`} />
        <Kpi k={3} label="มูลค่าสต็อกคงคลัง"
          value={<span style={{ fontSize: 22 }}>{money(stockVal)} ฿</span>}
          delta={lows ? `${lows} รายการต่ำกว่า Safety` : "สต็อกปกติ"} />
      </div>

      <div className="kpi-row three">
        <Kpi k={1} label="กำลังพัฒนา (Phase 1)" value={inDev.length} delta="ก่อนเปิด PO" />
        <Kpi k={5} label="กำลังผลิต (Phase 2)" value={producing.length} delta="ในโรงงาน" />
        <Kpi k={2} label="Ticket ค้าง" value={tkOpen} delta="ทุกแผนกรวมกัน" />
      </div>

      <div className="grid2">
        <Panel title="ลูกค้า Top 5" sub="ตามจำนวนโปรเจกต์ active">
          {!topCust.length ? <Empty icon="◎">ยังไม่มีข้อมูล</Empty> : (
            <table>
              <thead><tr><th></th><th>ลูกค้า</th><th>งาน</th><th>ต้นทุนวัตถุดิบ</th></tr></thead>
              <tbody>
                {topCust.map((x, i) => (
                  <tr key={x.c!.id}>
                    <td style={{ fontWeight: 800, color: "var(--muted)" }}>{i + 1}</td>
                    <td>
                      <b style={{ color: "var(--navy)" }}>{x.c!.name}</b>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{x.c!.type} · {x.c!.contact}</div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{x.n} โปรเจกต์</td>
                    <td>{money(x.cost)} ฿</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="งานเสี่ยงสุด 5 อันดับ" sub="เกิน SLA มากสุด">
          {!risky.length ? <Empty icon="🎉">ไม่มีงานเกิน SLA — สวยงาม</Empty> : (
            <table>
              <thead><tr><th>รหัส</th><th>โปรเจกต์</th><th>ขั้นที่ค้าง</th><th>เกิน</th></tr></thead>
              <tbody>
                {risky.map(({ p, sla }) => (
                  <tr key={p.id} className="clickable">
                    <td><span className="code">{p.id}</span></td>
                    <td>
                      <Link href={`/projects/${p.id}`} style={{ fontWeight: 700, color: "var(--navy)" }}>{p.name}</Link>
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {sla.step.th}
                      {sla.blocked && <span className="lowflag" style={{ marginLeft: 6 }}>ติดปัญหา</span>}
                    </td>
                    <td><span className="age age-late">เกิน {sla.over} วัน</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
