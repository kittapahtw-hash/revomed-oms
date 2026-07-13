"use client";
import { useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Field, Modal, Pill } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { KPI_AUTO, KPI_MTH, isAuto, kpiFmt, kpiPass, kpiValOf, nowYm, ym } from "@/lib/kpi";
import type { Kpi } from "@/lib/types";

export default function KpiPage() {
  const { data, loading, reload, me, can } = useData();
  const toast = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCut, setShowCut] = useState(false);
  const [edit, setEdit] = useState<Partial<Kpi> | null>(null);
  const [cell, setCell] = useState<{ k: Kpi; m: string } | null>(null);

  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const admin = me.admin;
  const canEditVal = admin || can("kpi");

  const rows = [...data.kpis]
    .sort((a, b) => (a.team || "").localeCompare(b.team || "") || a.ord - b.ord)
    .filter((k) => (showCut ? true : k.active));

  // สรุปเดือนปัจจุบัน (เฉพาะ KPI ที่ใช้งาน)
  let pass = 0, fail = 0, wait = 0;
  for (const k of data.kpis.filter((x) => x.active)) {
    const p = kpiPass(k, kpiValOf(k, data, nowYm()));
    if (p === true) pass++;
    else if (p === false) fail++;
    else wait++;
  }

  async function toggleCut(k: Kpi) {
    await api("/api/kpis", "POST", { ...k, target: Number(k.target), active: !k.active });
    await reload();
    toast(k.active ? `ตัด "${k.topic}" ออกแล้ว` : `เปิดใช้ "${k.topic}" แล้ว`, "ok");
  }
  async function del(k: Kpi) {
    await api("/api/kpis", "DELETE", { id: k.id });
    await reload();
    toast(`ลบ ${k.topic} แล้ว`, "block");
  }

  return (
    <>
      <div className="kpi-bar">
        <button className="btn btn-sm" onClick={() => setYear((y) => y - 1)}>‹</button>
        <b style={{ fontSize: 16, color: "var(--navy)" }}>ปี {year}</b>
        <button className="btn btn-sm" onClick={() => setYear((y) => y + 1)}>›</button>

        <Pill kind="done">ผ่าน {pass}</Pill>
        <Pill kind="block">ตก {fail}</Pill>
        <Pill kind="wait">รอข้อมูล {wait}</Pill>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>(เดือนปัจจุบัน · เฉพาะ KPI ที่ใช้งาน)</span>

        <span style={{ marginLeft: "auto" }} />
        {admin && (
          <>
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showCut} onChange={(e) => setShowCut(e.target.checked)} />
              แสดงที่ตัดออก
            </label>
            <button className="btn btn-primary btn-sm" onClick={() => setEdit({ op: ">=", unit: "%", src: "manual", active: true })}>
              + เพิ่ม KPI
            </button>
          </>
        )}
      </div>

      {!rows.length ? (
        <Empty icon="◎">
          ยังไม่มี KPI ในระบบ
          {admin
            ? ' — กด "+ เพิ่ม KPI" เพื่อเริ่ม เลือกได้ว่าจะกรอกมือรายเดือน หรือดึงค่าอัตโนมัติจากโมดูลอื่น (OTIF / OEE / Ticket / SLA)'
            : " — รอ Admin ตั้งค่า"}
        </Empty>
      ) : (
        <>
          <div className="kpi-scroll">
            <table className="kpi-tbl">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>KPI · วิธีคำนวณ</th>
                  <th>เป้า</th>
                  {KPI_MTH.map((n) => <th key={n}>{n} {String(year).slice(2)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((k, i) => {
                  const prevTeam = i > 0 ? (rows[i - 1].team || "") : null;
                  const showTeam = (k.team || "") !== prevTeam;
                  const auto = isAuto(k);
                  return (
                    <tbody key={k.id} style={{ display: "contents" }}>
                      {showTeam && (
                        <tr className="kpi-team">
                          <td colSpan={14}>{k.team || "ไม่ระบุทีม"}</td>
                        </tr>
                      )}
                      <tr className={k.active ? "" : "kpi-cut"}>
                        <td className="top">
                          <b>{k.topic}</b>
                          {auto && <span className="kpi-auto">AUTO · {KPI_AUTO[k.src]?.label ?? k.src}</span>}
                          {k.how && <div className="kpi-how">{k.how}</div>}
                          {admin && (
                            <div className="kpi-act">
                              <a onClick={() => setEdit(k)}>แก้ไข</a>
                              <a onClick={() => void toggleCut(k)}>{k.active ? "ตัดออก" : "ใช้งาน"}</a>
                              <a style={{ color: "#a02323" }} onClick={() => void del(k)}>ลบ</a>
                            </div>
                          )}
                        </td>
                        <td><b>{k.op === "<=" ? "≤" : "≥"} {Number(k.target)}{k.unit === "%" ? "%" : ""}</b></td>
                        {KPI_MTH.map((_, m) => {
                          const key = ym(year, m);
                          const v = kpiValOf(k, data, key);
                          const p = kpiPass(k, v);
                          const cls = p === true ? "kpi-pass" : p === false ? "kpi-fail" : "kpi-na";
                          const editable = !auto && canEditVal;
                          return (
                            <td key={m} className={`${cls} ${editable ? "kpi-cell-edit" : ""}`}
                              title={editable ? "คลิกเพื่อกรอกค่า" : auto ? "คำนวณอัตโนมัติ แก้มือไม่ได้" : ""}
                              onClick={editable ? () => setCell({ k, m: key }) : undefined}>
                              {kpiFmt(k, v)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            เขียว = ผ่านเป้า · แดง = ตกเป้า · เทา = ยังไม่มีข้อมูล · ช่อง <b>AUTO</b> คำนวณสดจากข้อมูลในระบบ แก้มือไม่ได้
          </div>
        </>
      )}

      <KpiEdit k={edit} close={() => setEdit(null)} onDone={reload} />
      <CellEdit cell={cell} close={() => setCell(null)} onDone={reload} />
    </>
  );
}

function KpiEdit({ k, close, onDone }: {
  k: Partial<Kpi> | null; close: () => void; onDone: () => Promise<void>;
}) {
  const { data } = useData();
  const toast = useToast();
  const [f, setF] = useState<Partial<Kpi>>(k ?? {});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const key = k ? (k.id ?? "__new__") : null;
  if (key !== lastId) { setLastId(key); if (k) setF({ ...k }); }

  if (!k) return null;

  const src = f.src ?? "manual";
  const auto = src !== "manual";

  async function save() {
    setBusy(true); setErr("");
    try {
      await api("/api/kpis", "POST", {
        ...f,
        target: Number(f.target ?? 0),
        ord: Number(f.ord ?? 0),
        active: f.active ?? true,
        unit: auto ? (KPI_AUTO[src]?.unit ?? "%") : (f.unit ?? "%"),
      });
      await onDone();
      toast("บันทึก KPI เรียบร้อย", "ok");
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={close} title={f.id ? `แก้ไข ${f.topic}` : "เพิ่ม KPI"} wide
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}

      <div className="grid2">
        <Field label="ทีม / แผนก">
          <select value={f.team ?? ""} onChange={(e) => setF({ ...f, team: e.target.value })}>
            <option value="">— ไม่ระบุทีม —</option>
            {data?.departments.map((d) => <option key={d.key} value={d.key}>{d.th} ({d.key})</option>)}
          </select>
        </Field>
        <Field label="ลำดับแสดงผลในทีม">
          <input type="number" value={f.ord ?? 0} onChange={(e) => setF({ ...f, ord: Number(e.target.value) })} />
        </Field>
      </div>

      <Field label="ชื่อ KPI">
        <input value={f.topic ?? ""} onChange={(e) => setF({ ...f, topic: e.target.value })} autoFocus />
      </Field>

      <Field label="แหล่งข้อมูล">
        <select value={src} onChange={(e) => setF({ ...f, src: e.target.value })}>
          <option value="manual">กรอกมือรายเดือน</option>
          {Object.entries(KPI_AUTO).map(([s, a]) => (
            <option key={s} value={s}>AUTO · {a.label}</option>
          ))}
        </select>
      </Field>

      {auto && (
        <div className="alert-strip" style={{ background: "var(--prod-bg)", borderColor: "#8fd3e2", color: "#0b6f88" }}>
          <span>⚙</span>
          <span>KPI นี้ <b>คำนวณสด</b>จากข้อมูลในระบบทุกครั้งที่เปิดหน้า — ไม่ต้องกรอกมือ และแก้ค่าไม่ได้</span>
        </div>
      )}

      <Field label="วิธีคำนวณ (อธิบายให้คนอ่านเข้าใจ)">
        <textarea rows={2} value={f.how ?? ""} onChange={(e) => setF({ ...f, how: e.target.value })} />
      </Field>

      <div className="grid2">
        <Field label="เงื่อนไขผ่านเป้า">
          <select value={f.op ?? ">="} onChange={(e) => setF({ ...f, op: e.target.value })}>
            <option value=">=">≥ มากกว่าหรือเท่ากับเป้า (ยิ่งมากยิ่งดี)</option>
            <option value="<=">≤ น้อยกว่าหรือเท่ากับเป้า (ยิ่งน้อยยิ่งดี)</option>
          </select>
        </Field>
        <Field label="ค่าเป้าหมาย">
          <input type="number" step="0.01" value={Number(f.target ?? 0)}
            onChange={(e) => setF({ ...f, target: e.target.value })} />
        </Field>
      </div>

      <Field label="หน่วย">
        <select value={auto ? (KPI_AUTO[src]?.unit ?? "%") : (f.unit ?? "%")} disabled={auto}
          onChange={(e) => setF({ ...f, unit: e.target.value })}>
          <option value="%">เปอร์เซ็นต์ (%)</option>
          <option value="num">ตัวเลข (จำนวน)</option>
        </select>
      </Field>
    </Modal>
  );
}

function CellEdit({ cell, close, onDone }: {
  cell: { k: Kpi; m: string } | null; close: () => void; onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [v, setV] = useState("");
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = cell ? `${cell.k.id}|${cell.m}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (cell) setV(String(cell.k.vals?.[cell.m] ?? ""));
  }

  if (!cell) return null;

  async function save(clear = false) {
    if (!cell) return;
    await api("/api/kpis", "PATCH", {
      id: cell.k.id, ym: cell.m, value: clear || v === "" ? null : Number(v),
    });
    await onDone();
    toast(clear ? "ล้างค่าแล้ว" : `บันทึก ${cell.m} = ${v}${cell.k.unit === "%" ? "%" : ""}`, "ok");
    close();
  }

  return (
    <Modal open onClose={close} title={`${cell.k.topic} — ${cell.m}`}
      foot={<>
        <button className="btn" onClick={() => void save(true)}>ล้างค่า</button>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={() => void save()}>บันทึก</button>
      </>}>
      <div className="pj-sub" style={{ marginBottom: 12 }}>
        เป้า: <b>{cell.k.op === "<=" ? "≤" : "≥"} {Number(cell.k.target)}{cell.k.unit === "%" ? "%" : ""}</b>
        {cell.k.how && <> · {cell.k.how}</>}
      </div>
      <Field label={`ค่าจริงเดือนนี้ (${cell.k.unit === "%" ? "%" : "จำนวน"})`}>
        <input type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)} autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") void save(); }} />
      </Field>
    </Modal>
  );
}
