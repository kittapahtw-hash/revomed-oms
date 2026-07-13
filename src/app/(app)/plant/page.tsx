"use client";
import { useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Kpi, Panel } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { oee, prodAllDone } from "@/lib/domain";
import { daysBetween, today } from "@/lib/utils";

export default function PlantPage() {
  const { data, loading, reload } = useData();
  const toast = useToast();
  const [f, setF] = useState({
    date: today(), lineId: "", projectId: "", qty: 0, hours: 8, downtime: 0, defect: 0, note: "",
  });
  const [busy, setBusy] = useState(false);

  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const td = today();
  const prodProjects = data.projects.filter(
    (p) => !p.archived && p.phase !== "dev" && !prodAllDone(p)
  );

  const todayOut = data.lineOutput.filter((o) => o.date === td).reduce((a, o) => a + o.qty, 0);
  const last7 = data.lineOutput.filter((o) => daysBetween(o.date, td) <= 6 && daysBetween(o.date, td) >= 0);
  const capAll = data.lines.reduce((a, l) => a + l.capacity, 0);
  const cap7 = capAll * 7;
  const eff7 = cap7 ? Math.round((last7.reduce((a, o) => a + o.qty, 0) / cap7) * 100) : 0;

  async function save() {
    if (!f.lineId) { toast("เลือกไลน์ผลิตก่อน", "block"); return; }
    if (!f.qty || f.qty <= 0) { toast("ใส่ยอดผลิตก่อน", "block"); return; }
    setBusy(true);
    try {
      await api("/api/lines/output", "POST", { ...f, projectId: f.projectId || null });
      await reload();
      toast(`บันทึกยอดผลิต ${f.qty.toLocaleString()} ชิ้นแล้ว`, "prod");
      setF({ ...f, qty: 0, defect: 0, downtime: 0, note: "" });
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    await api(`/api/lines/output/${id}`, "DELETE");
    await reload();
    toast("ลบรายการแล้ว", "block");
  }

  return (
    <>
      <div className="kpi-row three">
        <Kpi k={1} label="ไลน์ผลิตทั้งหมด" value={data.lines.length}
          delta={`Capacity รวม ${capAll.toLocaleString()} ชิ้น/วัน`} />
        <Kpi k={5} label="ยอดผลิตวันนี้" value={todayOut.toLocaleString()} delta="ชิ้น (ทุกไลน์รวมกัน)" />
        <Kpi k={2} label="Efficiency 7 วัน"
          value={
            <span style={{ color: eff7 >= 90 ? "var(--ok)" : eff7 >= 70 ? "var(--warn)" : "var(--block)" }}>
              {last7.length ? `${eff7}%` : "—"}
            </span>
          }
          delta="ยอดจริง vs capacity" />
      </div>

      {/* ---------- ฟอร์มกรอกยอด (inline เหมือนเดิม) ---------- */}
      <Panel title="บันทึกยอดผลิตรายวัน" sub="ทีม Plant กรอกยอดจริงต่อไลน์" noPad>
        <div className="plant-form">
          <div className="field" style={{ margin: 0 }}>
            <label>วันที่</label>
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>ไลน์ผลิต</label>
            <select value={f.lineId} onChange={(e) => setF({ ...f, lineId: e.target.value })}>
              <option value="">— เลือก —</option>
              {data.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>โปรเจกต์ (ที่กำลังผลิต)</label>
            <select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
              <option value="">— ไม่ระบุ —</option>
              {prodProjects.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>ยอดผลิต (ชิ้น)</label>
            <input type="number" min={0} value={f.qty || ""} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>ชั่วโมง</label>
            <input type="number" min={0} step={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Downtime (ชม.)</label>
            <input type="number" min={0} step={0.5} value={f.downtime} onChange={(e) => setF({ ...f, downtime: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>ของเสีย (ชิ้น)</label>
            <input type="number" min={0} value={f.defect} onChange={(e) => setF({ ...f, defect: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>หมายเหตุ</label>
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </Panel>

      {/* ---------- OEE 7 วัน ---------- */}
      <Panel title="สรุปต่อไลน์ (7 วันล่าสุด) — OEE"
        sub="OEE = Availability × Performance × Quality · เกณฑ์: 75%+ ดี · 55–75% พอใช้ · ต่ำกว่านั้นต้องหาสาเหตุ">
        <table>
          <thead>
            <tr>
              <th>ไลน์</th><th>ชื่อ</th><th>Capacity มาตรฐาน</th>
              <th>เฉลี่ยจริง</th><th>องค์ประกอบ</th><th style={{ width: 200 }}>OEE</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l) => {
              const outs = last7.filter((o) => o.lineId === l.id);
              const total = outs.reduce((a, o) => a + o.qty, 0);
              const days = new Set(outs.map((o) => o.date)).size || 1;
              const avg = Math.round(total / days);
              const o = oee(outs, l.id, l.capacity);
              const v = o ? o.oee * 100 : 0;
              const col = !o ? "var(--muted)" : v >= 75 ? "var(--ok)" : v >= 55 ? "var(--warn)" : "var(--block)";
              return (
                <tr key={l.id}>
                  <td><span className="code">{l.id}</span></td>
                  <td>
                    <b style={{ color: "var(--navy)" }}>{l.name}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{l.note}</div>
                  </td>
                  <td>{l.capacity.toLocaleString()} / วัน</td>
                  <td style={{ fontWeight: 700 }}>{avg.toLocaleString()} / วัน</td>
                  <td style={{ fontSize: 12 }}>
                    {o
                      ? `A ${(o.availability * 100).toFixed(0)}% · P ${(o.performance * 100).toFixed(0)}% · Q ${(o.quality * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="stk-bar" style={{ flex: 1 }}>
                        <span style={{ width: `${Math.min(100, v)}%`, background: col }} />
                      </div>
                      <b style={{ color: col, minWidth: 46 }}>{o ? `${v.toFixed(0)}%` : "—"}</b>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {/* ---------- ประวัติ 30 ---------- */}
      <Panel title="ประวัติการบันทึก" sub="30 รายการล่าสุด">
        {!data.lineOutput.length ? <Empty icon="⚙">ยังไม่มีการบันทึกยอดผลิต</Empty> : (
          <table>
            <thead>
              <tr>
                <th>วันที่</th><th>ไลน์</th><th>โปรเจกต์</th><th>ยอดผลิต</th>
                <th>ชั่วโมง</th><th>Efficiency</th><th>โดย</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.lineOutput.slice(0, 30).map((o) => {
                const l = data.lines.find((x) => x.id === o.lineId);
                const pj = data.projects.find((p) => p.id === o.projectId);
                const eff = l?.capacity ? Math.round((o.qty / l.capacity) * 100) : null;
                return (
                  <tr key={o.id}>
                    <td style={{ fontSize: 12 }}>{o.date}</td>
                    <td>{l?.name ?? o.lineId}</td>
                    <td>{pj ? <><span className="code">{pj.id}</span> {pj.name}</> : "—"}</td>
                    <td style={{ fontWeight: 800, color: "var(--navy)" }}>{o.qty.toLocaleString()}</td>
                    <td>{o.hours ? `${o.hours} ชม.` : "—"}</td>
                    <td>
                      {eff !== null
                        ? <span className={`age ${eff >= 90 ? "age-ok" : eff >= 70 ? "age-warn" : "age-late"}`}>{eff}%</span>
                        : "—"}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {o.who}{o.note && ` · ${o.note}`}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--block)" }}
                        onClick={() => void del(o.id)}>ลบ</button>
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
