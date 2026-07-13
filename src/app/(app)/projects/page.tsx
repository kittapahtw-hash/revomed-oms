"use client";
import { useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Field, Modal, Panel } from "@/components/ui";
import { ProjectRow } from "@/components/ProjectRow";
import { useToast } from "@/components/Toast";
import { KIND_DESC, KIND_TH, PRIORITIES } from "@/lib/utils";

export default function ProjectsPage() {
  const { data, loading, reload } = useData();
  const [q, setQ] = useState("");
  const [showArch, setShowArch] = useState(false);
  const [pageN, setPageN] = useState(30);
  const [open, setOpen] = useState(false);

  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const archivedN = data.projects.filter((p) => p.archived).length;

  let list = data.projects.filter((p) => (showArch ? p.archived : !p.archived));
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((p) => {
      const c = data.customers.find((x) => x.id === p.custId);
      return p.name.toLowerCase().includes(s)
        || p.id.toLowerCase().includes(s)
        || (c?.name.toLowerCase().includes(s) ?? false);
    });
  }
  const shown = list.slice(0, pageN);

  return (
    <>
      <Panel
        title={showArch ? "โปรเจกต์ที่เก็บเข้าคลัง" : "โปรเจกต์ทั้งหมด"}
        sub={`${list.length} รายการ`}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="search" placeholder="ค้นหา ชื่อ / รหัส / ลูกค้า…"
              value={q} onChange={(e) => { setQ(e.target.value); setPageN(30); }} />
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setShowArch((v) => !v); setPageN(30); }}>
              {showArch ? "กลับไปรายการหลัก" : `ดูที่เก็บเข้าคลัง (${archivedN})`}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>+ เพิ่มโปรเจกต์</button>
          </div>
        }>

        {!shown.length ? <Empty icon="▤">ไม่เจอโปรเจกต์</Empty> : (
          <>
            <table>
              <thead>
                <tr>
                  <th>รหัส</th><th>โปรเจกต์ / ลูกค้า</th><th>ขั้นปัจจุบัน</th>
                  <th>ทีม</th><th>สถานะ / SLA</th><th style={{ width: 170 }}>คืบหน้า</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => <ProjectRow key={p.id} p={p} d={data} />)}
              </tbody>
            </table>

            {list.length > pageN && (
              <div style={{ padding: 14, textAlign: "center", borderTop: "1px solid var(--line)" }}>
                <button className="btn btn-sm" onClick={() => setPageN((n) => n + 30)}>
                  โหลดเพิ่ม (แสดง {shown.length}/{list.length})
                </button>
              </div>
            )}
          </>
        )}
      </Panel>

      <NewProject open={open} close={() => setOpen(false)} onDone={reload} />
    </>
  );
}

const KINDS = ["new", "repeat", "reformulate"] as const;

function NewProject({ open, close, onDone }: {
  open: boolean; close: () => void; onDone: () => Promise<void>;
}) {
  const { data } = useData();
  const toast = useToast();
  const [f, setF] = useState({
    name: "", custId: "", kind: "new" as (typeof KINDS)[number],
    ptype: "", pm: "", priority: "ปกติ", qty: 0, dueDate: "",
  });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr("");
    try {
      await api("/api/projects", "POST", { ...f, dueDate: f.dueDate || null });
      await onDone();
      toast(
        f.kind === "repeat" ? "เปิดโปรเจกต์ผลิตซ้ำ — เข้าเฟสผลิตทันที" : "เปิดโปรเจกต์เรียบร้อย",
        f.kind === "repeat" ? "prod" : "ok"
      );
      setF({ name: "", custId: "", kind: "new", ptype: "", pm: "", priority: "ปกติ", qty: 0, dueDate: "" });
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={close} title="เพิ่มโปรเจกต์ใหม่" wide
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : "สร้างโปรเจกต์"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}

      <div className="field">
        <label>ประเภทงาน</label>
        <div className="kind-pick">
          {KINDS.map((k) => (
            <button key={k} type="button" className={`kind-opt ${f.kind === k ? "on" : ""}`}
              onClick={() => setF({ ...f, kind: k })}>
              <span className="kind-radio">{f.kind === k ? "●" : ""}</span>
              <span className="kind-body"><b>{KIND_TH[k]}</b><span>{KIND_DESC[k]}</span></span>
            </button>
          ))}
        </div>
      </div>

      {f.kind === "repeat" && (
        <div className="alert-strip" style={{ background: "var(--prod-bg)", borderColor: "#8fd3e2", color: "#0b6f88" }}>
          <span>⚙</span>
          <span><b>ผลิตซ้ำ</b> — ระบบจะข้ามเฟสพัฒนาทั้ง {data?.workflow.length} ขั้น แล้วเปิดที่เฟสผลิตให้ทันที อย่าลืมผูก BOM</span>
        </div>
      )}
      {f.kind === "reformulate" && (
        <div className="alert-strip" style={{ background: "var(--gold-bg)", borderColor: "#e3cf8e", color: "#946008" }}>
          <span>★</span>
          <span><b>ปรับสูตร</b> — เปิด workflow ครบให้ กด &quot;ข้าม&quot; ขั้นที่ทำไปแล้วได้ที่หน้ารายละเอียด</span>
        </div>
      )}

      <div className="grid2">
        <Field label="ชื่อโปรเจกต์ / สินค้า">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="ลูกค้า">
          <select value={f.custId} onChange={(e) => setF({ ...f, custId: e.target.value })}>
            <option value="">— เลือกลูกค้า —</option>
            {data?.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="ประเภทสินค้า">
          <select value={f.ptype} onChange={(e) => setF({ ...f, ptype: e.target.value })}>
            <option value="">— เลือก —</option>
            {data?.productTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="PM ผู้รับผิดชอบ">
          <input value={f.pm} onChange={(e) => setF({ ...f, pm: e.target.value })} />
        </Field>
        <Field label="ความสำคัญ">
          <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            {PRIORITIES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="จำนวนที่คาดว่าจะผลิต (ชิ้น)">
          <input type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
        </Field>
        <Field label="กำหนดส่งลูกค้า (ถ้ามี)">
          <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--pg)", padding: "11px 13px", borderRadius: 6 }}>
        เริ่ม pipeline ที่ขั้น #1 Sale เก็บความต้องการลูกค้า อัตโนมัติ · BOM เว้นว่างได้ถ้ายังไม่รู้ (ไปผูกทีหลังที่หน้า detail)
      </div>
    </Modal>
  );
}
