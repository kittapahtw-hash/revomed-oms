"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Field, Kpi, Modal, Panel, Pill } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { QC_PILL, QC_TH, daysToExpiry, expiryAlerts, lotBlocked } from "@/lib/domain";
import { money, today } from "@/lib/utils";
import type { StockLot } from "@/lib/types";

type Tab = "all" | "usable" | "soon" | "expired" | "qc";

export default function LotsPage() {
  const { data, loading, reload } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [recv, setRecv] = useState(false);
  const [qc, setQc] = useState<StockLot | null>(null);

  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const al = expiryAlerts(data);
  const live = data.lots.filter((l) => Number(l.qty) > 0);

  let list =
    tab === "usable" ? live.filter((l) => !lotBlocked(l))
    : tab === "soon" ? al.soon
    : tab === "expired" ? al.expired
    : tab === "qc" ? [...al.quarantine, ...al.failed]
    : data.lots;

  if (q) {
    const s = q.toLowerCase();
    list = list.filter((l) => {
      const it = data.stock.find((x) => x.id === l.itemId);
      return l.lotNo.toLowerCase().includes(s)
        || l.itemId.toLowerCase().includes(s)
        || (it?.name.toLowerCase().includes(s) ?? false)
        || l.supplier.toLowerCase().includes(s);
    });
  }

  return (
    <>
      {!!al.expired.length && (
        <div className="alert-strip">
          <span>☠</span>
          <span>
            <b>{al.expired.length} ล็อตหมดอายุแล้ว แต่ยังมีของค้างอยู่ในคลัง</b> —
            ระบบบล็อกไม่ให้เบิกแล้ว แต่ต้องทำลาย/ส่งคืนซัพพลายเออร์ + บันทึกให้เรียบร้อย (GMP บังคับ)
          </span>
        </div>
      )}
      {!!al.soon.length && (
        <div className="alert-strip" style={{ background: "var(--warn-bg)", borderColor: "#e3cf8e", color: "#946008" }}>
          <span>⏳</span>
          <span>
            {al.soon.length} ล็อตจะหมดอายุใน 30 วัน — {al.soon.slice(0, 3).map((l) => `${l.lotNo} (${l.expiry})`).join(", ")}
            {al.soon.length > 3 && ` และอีก ${al.soon.length - 3} ล็อต`} · รีบใช้ก่อน (ระบบเบิกแบบ FEFO ให้อยู่แล้ว)
          </span>
        </div>
      )}

      <div className="kpi-row">
        <Kpi k={1} label="ล็อตที่มีของ" value={live.length} delta={`ทั้งหมด ${data.lots.length} ล็อต`} />
        <Kpi k={2} label="เบิกได้ (QC ผ่าน · ไม่หมดอายุ)" value={live.filter((l) => !lotBlocked(l)).length} />
        <Kpi k={3} label="ใกล้หมดอายุ (≤30 วัน)"
          value={<span style={{ color: al.soon.length ? "var(--warn)" : "var(--navy)" }}>{al.soon.length}</span>}
          delta="FEFO จะหยิบตัวนี้ก่อน" />
        <Kpi k={4} label="ติด QC / หมดอายุ"
          value={<span style={{ color: (al.expired.length + al.failed.length) ? "var(--block)" : "var(--navy)" }}>
            {al.expired.length + al.failed.length + al.quarantine.length}
          </span>}
          delta="เบิกไม่ได้ ระบบบล็อกให้" />
      </div>

      <Panel title="ล็อตวัตถุดิบ (Lot / Batch)" sub={`${list.length} ล็อต`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <input className="search" placeholder="ค้นหา ล็อต / รหัส / ซัพพลายเออร์…"
              value={q} onChange={(e) => setQ(e.target.value)} />
            <Link href="/recall" className="btn btn-sm">🔍 Recall Trace</Link>
            <button className="btn btn-primary btn-sm" onClick={() => setRecv(true)}>+ รับวัตถุดิบเข้าคลัง</button>
          </div>
        }>
        <div className="stk-tabs">
          {([
            ["all", `ทั้งหมด (${data.lots.length})`],
            ["usable", `เบิกได้ (${live.filter((l) => !lotBlocked(l)).length})`],
            ["soon", `ใกล้หมดอายุ (${al.soon.length})`],
            ["expired", `หมดอายุ (${al.expired.length})`],
            ["qc", `ติด QC (${al.quarantine.length + al.failed.length})`],
          ] as [Tab, string][]).map(([k, label]) => (
            <button key={k} className={`stk-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {!list.length ? <Empty icon="▣">ไม่มีล็อตในมุมมองนี้</Empty> : (
          <table>
            <thead>
              <tr>
                <th>เลขล็อต</th><th>วัตถุดิบ</th>
                <th style={{ textAlign: "right" }}>คงเหลือ</th>
                <th style={{ textAlign: "right" }}>รับเข้า</th>
                <th>วันหมดอายุ</th><th>QC</th><th>COA</th>
                <th>ซัพพลายเออร์</th><th>สถานะ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const it = data.stock.find((x) => x.id === l.itemId);
                const dte = daysToExpiry(l);
                const blocked = lotBlocked(l);
                const expCls = dte === null ? "" : dte < 0 ? "due-late" : dte <= 30 ? "due-warn" : "due-ok";
                return (
                  <tr key={l.id} style={Number(l.qty) <= 0 ? { opacity: 0.45 } : undefined}>
                    <td><span className="code">{l.lotNo}</span></td>
                    <td>
                      <b style={{ color: "var(--navy)" }}>{it?.name ?? l.itemId}</b>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{l.itemId}</div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{money(l.qty)} {it?.unit}</td>
                    <td style={{ textAlign: "right", color: "var(--muted)" }}>{money(l.received)}</td>
                    <td>
                      {l.expiry
                        ? <>
                            <span className={`due ${expCls}`}>{l.expiry}</span>
                            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                              {dte! < 0 ? `เลยมา ${-dte!} วัน` : `เหลือ ${dte} วัน`}
                            </div>
                          </>
                        : <span style={{ color: "var(--muted)" }}>ไม่มีวันหมดอายุ</span>}
                    </td>
                    <td><Pill kind={QC_PILL[l.qcStatus]}>{QC_TH[l.qcStatus]}</Pill></td>
                    <td>
                      {l.coaUrl
                        ? <a href={l.coaUrl} target="_blank" rel="noreferrer" className="filechip">📄 COA</a>
                        : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{l.supplier || "—"}</td>
                    <td>
                      {blocked
                        ? <span className="lowflag">{blocked}</span>
                        : <span className="age age-ok">เบิกได้</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => setQc(l)}>QC / COA</button>{" "}
                      <Link href={`/recall?lot=${l.id}`} className="btn btn-sm">สืบย้อน</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="legend">
          <span><b>FEFO</b> — ระบบเบิกล็อตที่ <b>ใกล้หมดอายุก่อน</b> อัตโนมัติ (ไม่ใช่มาก่อนใช้ก่อน)</span>
          <span>ล็อตที่ยังไม่ผ่าน QC / หมดอายุ / กักกัน — <b>เบิกไม่ได้</b> ระบบบล็อกให้</span>
        </div>
      </Panel>

      <ReceiveModal open={recv} close={() => setRecv(false)} onDone={reload} toast={toast} />
      <QcModal lot={qc} close={() => setQc(null)} onDone={reload} toast={toast} />
    </>
  );
}

/* ---------------- รับเข้าคลัง (ต้องมีล็อต) ---------------- */
function ReceiveModal({ open, close, onDone, toast }: {
  open: boolean; close: () => void; onDone: () => Promise<void>;
  toast: (m: string, k?: "ok" | "block" | "gold" | "prod" | "gate") => void;
}) {
  const { data } = useData();
  const ref = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    itemId: "", lotNo: "", qty: 0, expiry: "", mfgDate: "",
    supplier: "", poNo: "", coaUrl: "", qcStatus: "pending", note: "",
  });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function uploadCoa(file: File) {
    const fd = new FormData();
    fd.append("file", file); fd.append("ref", "coa");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (j.ok) { setF((v) => ({ ...v, coaUrl: j.url })); toast(`แนบ COA: ${j.name}`, "ok"); }
    else setErr(j.error);
  }

  async function save() {
    setBusy(true); setErr("");
    try {
      await api("/api/lots", "POST", {
        ...f,
        expiry: f.expiry || null,
        mfgDate: f.mfgDate || null,
      });
      await onDone();
      toast(`รับเข้าล็อต ${f.lotNo} เรียบร้อย`, "ok");
      setF({ itemId: "", lotNo: "", qty: 0, expiry: "", mfgDate: "", supplier: "", poNo: "", coaUrl: "", qcStatus: "pending", note: "" });
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  const it = data?.stock.find((x) => x.id === f.itemId);

  return (
    <Modal open={open} onClose={close} title="รับวัตถุดิบเข้าคลัง (ต้องระบุล็อต)" wide
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-ok" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : "รับเข้าคลัง"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}

      <div className="alert-strip" style={{ background: "var(--gate-bg)", borderColor: "#cdb3e3", color: "var(--gate)" }}>
        <span>ℹ</span>
        <span>
          <b>ทุกล็อตต้องมีเลขล็อต + วันหมดอายุ</b> — ไม่งั้นสืบย้อนไม่ได้ตอนลูกค้าร้องเรียน และ อย./GMP ตรวจแล้วตก
        </span>
      </div>

      <div className="grid2">
        <Field label="วัตถุดิบ / แพ็กเกจจิ้ง *">
          <select value={f.itemId} onChange={(e) => {
            const x = data?.stock.find((s) => s.id === e.target.value);
            setF({ ...f, itemId: e.target.value, supplier: x?.supplier ?? f.supplier });
          }}>
            <option value="">— เลือก —</option>
            {data?.stock.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
          </select>
        </Field>
        <Field label="เลขล็อต (Lot / Batch No.) *">
          <input value={f.lotNo} onChange={(e) => setF({ ...f, lotNo: e.target.value })}
            placeholder="เช่น LOT-2026-0714-A" />
        </Field>
        <Field label={`จำนวนที่รับเข้า (${it?.unit ?? ""}) *`}>
          <input type="number" step="any" min={0} value={f.qty || ""}
            onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
        </Field>
        <Field label="เลขที่ PO">
          <input value={f.poNo} onChange={(e) => setF({ ...f, poNo: e.target.value })} />
        </Field>
        <Field label="วันผลิต (MFG)">
          <input type="date" value={f.mfgDate} onChange={(e) => setF({ ...f, mfgDate: e.target.value })} />
        </Field>
        <Field label="วันหมดอายุ (EXP) *">
          <input type="date" min={today()} value={f.expiry}
            onChange={(e) => setF({ ...f, expiry: e.target.value })} />
        </Field>
        <Field label="ซัพพลายเออร์">
          <input value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
        </Field>
        <Field label="สถานะ QC">
          <select value={f.qcStatus} onChange={(e) => setF({ ...f, qcStatus: e.target.value })}>
            <option value="pending">รอ QC (เบิกไม่ได้จนกว่าจะผ่าน)</option>
            <option value="quarantine">กักกัน (Quarantine)</option>
            <option value="passed">QC ผ่านแล้ว — เบิกได้เลย</option>
          </select>
        </Field>
      </div>

      <Field label="ใบ COA (Certificate of Analysis)">
        <input ref={ref} type="file"
          onChange={(e) => { const x = e.target.files?.[0]; if (x) void uploadCoa(x); }} />
      </Field>
      {f.coaUrl && <span className="filechip">📄 แนบ COA แล้ว</span>}

      <Field label="หมายเหตุ">
        <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </Field>
    </Modal>
  );
}

/* ---------------- อัปเดต QC / COA ---------------- */
function QcModal({ lot, close, onDone, toast }: {
  lot: StockLot | null; close: () => void; onDone: () => Promise<void>;
  toast: (m: string, k?: "ok" | "block" | "gold" | "prod" | "gate") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [coa, setCoa] = useState("");
  if (!lot) return null;

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      await api(`/api/lots/${lot!.id}`, "PATCH", body);
      await onDone();
      toast(msg, body.qcStatus === "failed" ? "block" : "ok");
      close();
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
    finally { setBusy(false); }
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file); fd.append("ref", "coa");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (j.ok) { setCoa(j.url); await patch({ coaUrl: j.url }, "แนบ COA แล้ว"); }
  }

  return (
    <Modal open onClose={close} title={`QC / COA — ล็อต ${lot.lotNo}`}
      foot={<button className="btn" onClick={close}>ปิด</button>}>
      <div className="info-grid" style={{ gridTemplateColumns: "repeat(2,1fr)", marginBottom: 14 }}>
        <div className="info"><div className="l">คงเหลือในล็อต</div><div className="v">{money(lot.qty)}</div></div>
        <div className="info"><div className="l">วันหมดอายุ</div><div className="v">{lot.expiry ?? "—"}</div></div>
      </div>

      <Field label="ผลตรวจ QC">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="btn btn-ok btn-sm" disabled={busy}
            onClick={() => void patch({ qcStatus: "passed" }, "QC ผ่าน — เบิกได้แล้ว")}>✓ ผ่าน</button>
          <button className="btn btn-gold btn-sm" disabled={busy}
            onClick={() => void patch({ qcStatus: "quarantine" }, "ตั้งเป็นกักกัน — เบิกไม่ได้")}>⏸ กักกัน</button>
          <button className="btn btn-block btn-sm" disabled={busy}
            onClick={() => void patch({ qcStatus: "failed" }, "QC ไม่ผ่าน — บล็อกการเบิกแล้ว")}>✕ ไม่ผ่าน</button>
        </div>
      </Field>

      <Field label="ใบ COA">
        {lot.coaUrl || coa
          ? <a href={coa || lot.coaUrl} target="_blank" rel="noreferrer" className="filechip">📄 เปิดดู COA</a>
          : <input type="file" onChange={(e) => { const x = e.target.files?.[0]; if (x) void upload(x); }} />}
      </Field>

      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
        ล็อตที่ QC ไม่ผ่าน / กักกัน / ยังไม่ตรวจ — ระบบจะ<b>ไม่ยอมให้เบิก</b>ไปผลิต
        และไม่นับเป็นยอด &quot;ใช้ได้&quot; ตอน FEFO
      </div>
    </Modal>
  );
}
