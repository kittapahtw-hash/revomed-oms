"use client";
import { useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Field, Modal, Panel, Team } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { TEAM_CLS, money } from "@/lib/utils";

type Tab = "lead" | "flow" | "cust" | "ptype" | "stock" | "lines" | "dept";
const TABS: [Tab, string][] = [
  ["lead", "Lead Time"],
  ["flow", "Workflow ทั้งหมด"],
  ["cust", "ลูกค้า"],
  ["ptype", "ประเภทสินค้า"],
  ["stock", "Stock Master"],
  ["lines", "ไลน์ผลิต"],
  ["dept", "แผนก & อีเมลทีม"],
];

/** ตั้งค่า Tracker — ยกมาจาก renderSetup() เดิม 6 แท็บ + แผนก */
export default function SetupPage() {
  const { data, loading, reload, can } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("lead");
  const [modal, setModal] = useState<{ kind: string; row: Record<string, unknown> | null } | null>(null);

  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;
  if (!can("setup")) return <Empty icon="🔒">ต้องมีสิทธิ์ &quot;ตั้งค่า Tracker&quot;</Empty>;

  async function save(kind: string, row: Record<string, unknown>) {
    await api("/api/master", "POST", { kind, data: row });
    await reload();
    toast("บันทึกแล้ว", "ok");
  }
  async function del(kind: string, id: string) {
    await api("/api/master", "DELETE", { kind, id });
    await reload();
    toast("ลบแล้ว", "block");
  }

  /** inline edit — แก้ตัวเลข lead time ในตารางได้เลย */
  async function inlineLead(kind: "workflow" | "production", step: Record<string, unknown>, lead: number) {
    await save(kind, { ...step, lead });
  }

  return (
    <>
      <div className="setup-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={`setup-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {/* ---------- Lead Time (inline edit) ---------- */}
      {tab === "lead" && (
        <Panel title="Lead Time มาตรฐานต่อขั้นตอน" sub="คลิกที่ตัวเลขเพื่อแก้ได้เลย · ใช้คำนวณ SLA / ETA / คอขวด">
          <table>
            <thead><tr><th>#</th><th>ขั้นตอน</th><th>ทีม</th><th style={{ width: 120 }}>Lead (วัน)</th></tr></thead>
            <tbody>
              <tr className="sec-row"><td colSpan={4}>Phase 1 — Development ({data.workflow.length} ขั้น · รวม {data.workflow.reduce((a, w) => a + w.lead, 0)} วัน)</td></tr>
              {data.workflow.map((w) => (
                <tr key={w.id}>
                  <td><span className="code">#{w.id}</span></td>
                  <td><b style={{ color: "var(--navy)" }}>{w.th}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{w.en}</div></td>
                  <td><Team cls={TEAM_CLS[w.team]}>{w.team}</Team></td>
                  <td>
                    <input className="inline-edit" type="number" defaultValue={w.lead}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== w.lead) void inlineLead("workflow", { ...w }, v);
                      }} />
                  </td>
                </tr>
              ))}
              <tr className="sec-row"><td colSpan={4}>Phase 2 — Production ({data.production.length} ขั้น · รวม {data.production.reduce((a, w) => a + w.lead, 0)} วัน)</td></tr>
              {data.production.map((w) => (
                <tr key={w.id}>
                  <td><span className="code">P{w.id - 100}</span></td>
                  <td><b style={{ color: "var(--navy)" }}>{w.th}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{w.en}</div></td>
                  <td><Team cls={TEAM_CLS[w.team]}>{w.team}</Team></td>
                  <td>
                    <input className="inline-edit" type="number" defaultValue={w.lead}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== w.lead) void inlineLead("production", { ...w }, v);
                      }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {/* ---------- Workflow เต็ม ---------- */}
      {tab === "flow" && (
        <Panel title="Workflow — แก้ทีม / gate / โน้ต ได้ทั้งหมด"
          right={<button className="btn btn-primary btn-sm"
            onClick={() => setModal({ kind: "workflow", row: null })}>+ เพิ่มขั้นตอน</button>}>
          <table>
            <thead><tr>
              <th>#</th><th>ชื่อขั้นตอน</th><th>ทีม</th><th>Lead</th><th>Gate (ลูกค้าเคาะ)</th><th>โน้ต</th><th>จัดการ</th>
            </tr></thead>
            <tbody>
              <tr className="sec-row"><td colSpan={7}>Phase 1 — Development</td></tr>
              {data.workflow.map((w) => (
                <tr key={w.id}>
                  <td><span className="code">#{w.id}</span></td>
                  <td><b style={{ color: "var(--navy)" }}>{w.th}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{w.en}</div></td>
                  <td><Team cls={TEAM_CLS[w.team]}>{w.team}</Team></td>
                  <td>{w.lead} วัน</td>
                  <td style={{ fontSize: 12, color: w.gate ? "var(--gate)" : "var(--muted)" }}>
                    {w.gate ? `🚦 ${w.gate}` : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{w.note || "—"}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setModal({ kind: "workflow", row: { ...w } })}>แก้ไข</button>
                    <button className="btn btn-sm btn-block" style={{ marginLeft: 4 }}
                      onClick={() => void del("workflow", String(w.id))}>ลบ</button>
                  </td>
                </tr>
              ))}
              <tr className="sec-row"><td colSpan={7}>Phase 2 — Production</td></tr>
              {data.production.map((w) => (
                <tr key={w.id}>
                  <td><span className="code">P{w.id - 100}</span></td>
                  <td><b style={{ color: "var(--navy)" }}>{w.th}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{w.en}</div></td>
                  <td><Team cls={TEAM_CLS[w.team]}>{w.team}</Team></td>
                  <td>{w.lead} วัน</td>
                  <td style={{ color: "var(--muted)" }}>—</td>
                  <td style={{ color: "var(--muted)" }}>—</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setModal({ kind: "production", row: { ...w } })}>แก้ไข</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="legend">
            <span>⚠️ ลบขั้นตอนที่โปรเจกต์เก่าใช้อยู่ = ขั้นนั้นจะหายจากหน้า detail ของโปรเจกต์นั้นด้วย ระวังหน่อย</span>
          </div>
        </Panel>
      )}

      {/* ---------- ลูกค้า ---------- */}
      {tab === "cust" && (
        <Panel title="ลูกค้า" sub={`${data.customers.length} ราย`}
          right={<button className="btn btn-primary btn-sm"
            onClick={() => setModal({ kind: "customer", row: null })}>+ เพิ่มลูกค้า</button>}>
          {!data.customers.length ? <Empty>ยังไม่มีลูกค้า</Empty> : (
            <table>
              <thead><tr><th>รหัส</th><th>ชื่อบริษัท</th><th>ประเภท</th><th>ผู้ติดต่อ</th><th>โปรเจกต์</th><th>จัดการ</th></tr></thead>
              <tbody>
                {data.customers.map((c) => {
                  const n = data.projects.filter((p) => p.custId === c.id).length;
                  return (
                    <tr key={c.id}>
                      <td><span className="code">{c.id}</span></td>
                      <td><b style={{ color: "var(--navy)" }}>{c.name}</b></td>
                      <td>{c.type || "—"}</td>
                      <td>{c.contact || "—"}</td>
                      <td>{n} งาน</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setModal({ kind: "customer", row: { ...c } })}>แก้ไข</button>
                        <button className="btn btn-sm btn-block" style={{ marginLeft: 4 }} disabled={n > 0}
                          title={n > 0 ? "ลบไม่ได้ — มีโปรเจกต์ผูกอยู่" : ""}
                          onClick={() => void del("customer", c.id)}>ลบ</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {/* ---------- ประเภทสินค้า ---------- */}
      {tab === "ptype" && (
        <Panel title="ประเภทสินค้า"
          right={<button className="btn btn-primary btn-sm"
            onClick={() => setModal({ kind: "ptype", row: null })}>+ เพิ่มประเภท</button>}>
          <table>
            <thead><tr><th>ชื่อประเภท</th><th>ใช้อยู่</th><th>จัดการ</th></tr></thead>
            <tbody>
              {data.productTypes.map((t) => {
                const n = data.projects.filter((p) => p.ptype === t).length;
                return (
                  <tr key={t}>
                    <td><b style={{ color: "var(--navy)" }}>{t}</b></td>
                    <td>{n} งาน</td>
                    <td>
                      <button className="btn btn-sm btn-block" disabled={n > 0}
                        title={n > 0 ? "ลบไม่ได้ — มีโปรเจกต์ใช้อยู่" : ""}
                        onClick={() => void del("ptype", t)}>ลบ</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {/* ---------- Stock Master ---------- */}
      {tab === "stock" && (
        <Panel title="Stock Master — วัตถุดิบ & แพ็กเกจจิ้ง"
          sub="แก้ชื่อ/หน่วย/Safety/ต้นทุน · ยอดคงเหลือแก้ที่นี่ไม่ได้ ต้องผ่านรับเข้า/จ่ายออก"
          right={<button className="btn btn-primary btn-sm"
            onClick={() => setModal({ kind: "stock", row: null })}>+ เพิ่มรายการ</button>}>
          <table>
            <thead><tr>
              <th>รหัส</th><th>ชื่อ</th><th>ประเภท</th><th>หน่วย</th>
              <th style={{ textAlign: "right" }}>คงเหลือ</th>
              <th style={{ textAlign: "right" }}>Safety</th>
              <th style={{ textAlign: "right" }}>ต้นทุน</th>
              <th>ผู้ขาย</th><th>จัดการ</th>
            </tr></thead>
            <tbody>
              {data.stock.map((s) => {
                const used = data.projects.some((p) => p.bom.some((b) => b.itemId === s.id));
                return (
                  <tr key={s.id}>
                    <td><span className="code">{s.id}</span></td>
                    <td><b style={{ color: "var(--navy)" }}>{s.name}</b></td>
                    <td>{s.type}</td>
                    <td>{s.unit}</td>
                    <td style={{ textAlign: "right" }}>{money(s.qty)}</td>
                    <td style={{ textAlign: "right" }}>{money(s.safety)}</td>
                    <td style={{ textAlign: "right" }}>฿{money(s.cost)}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{s.supplier || "—"}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => setModal({ kind: "stock", row: { ...s, qty: Number(s.qty), safety: Number(s.safety), cost: Number(s.cost) } })}>แก้ไข</button>
                      <button className="btn btn-sm btn-block" style={{ marginLeft: 4 }} disabled={used}
                        title={used ? "ลบไม่ได้ — มี BOM ใช้อยู่" : ""}
                        onClick={() => void del("stock", s.id)}>ลบ</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {/* ---------- ไลน์ผลิต ---------- */}
      {tab === "lines" && (
        <Panel title="ไลน์ผลิต" sub="กำลังผลิต (ชิ้น/วัน) ใช้คำนวณ Performance ใน OEE"
          right={<button className="btn btn-primary btn-sm"
            onClick={() => setModal({ kind: "line", row: null })}>+ เพิ่มไลน์</button>}>
          <table>
            <thead><tr><th>รหัส</th><th>ชื่อไลน์</th><th style={{ textAlign: "right" }}>กำลังผลิต/วัน</th><th>หมายเหตุ</th><th>จัดการ</th></tr></thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id}>
                  <td><span className="code">{l.id}</span></td>
                  <td><b style={{ color: "var(--navy)" }}>{l.name}</b></td>
                  <td style={{ textAlign: "right" }}>{l.capacity.toLocaleString()}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{l.note || "—"}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setModal({ kind: "line", row: { ...l } })}>แก้ไข</button>
                    <button className="btn btn-sm btn-block" style={{ marginLeft: 4 }}
                      onClick={() => void del("line", l.id)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {/* ---------- แผนก ---------- */}
      {tab === "dept" && (
        <Panel title="แผนก & อีเมลทีม" sub="อีเมลนี้ใช้รับ digest ทุกเช้า + แจ้งเตือนตอนงานส่งต่อ"
          right={<button className="btn btn-primary btn-sm"
            onClick={() => setModal({ kind: "dept", row: null })}>+ เพิ่มแผนก</button>}>
          <table>
            <thead><tr><th>Key</th><th>ชื่อไทย</th><th>ชื่ออังกฤษ</th><th>อีเมลทีม</th><th>จัดการ</th></tr></thead>
            <tbody>
              {data.departments.map((d) => (
                <tr key={d.key}>
                  <td><Team cls={TEAM_CLS[d.key] ?? "t-plant"}>{d.key}</Team></td>
                  <td><b style={{ color: "var(--navy)" }}>{d.th}</b></td>
                  <td>{d.name}</td>
                  <td style={{ color: d.email ? "var(--ink)" : "var(--block)" }}>
                    {d.email || "⚠️ ยังไม่ตั้ง — ทีมนี้ไม่ได้รับแจ้งเตือน"}
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setModal({ kind: "dept", row: { ...d } })}>แก้ไข</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <MasterModal m={modal} close={() => setModal(null)} onSave={save} />
    </>
  );
}

/* -------- ฟอร์มเดียว ใช้ได้ทุกตาราง -------- */
const FIELDS: Record<string, { key: string; label: string; type?: string; opts?: "team" | "type" }[]> = {
  workflow: [
    { key: "id", label: "ลำดับขั้น (#)", type: "number" },
    { key: "th", label: "ชื่อขั้นตอน (ไทย)" },
    { key: "en", label: "ชื่อขั้นตอน (อังกฤษ)" },
    { key: "team", label: "ทีมรับผิดชอบ", opts: "team" },
    { key: "lead", label: "Lead time (วัน)", type: "number" },
    { key: "gate", label: "Gate — คำถามที่ต้องรอลูกค้าเคาะ (เว้นว่าง = ไม่ต้องรอ)" },
    { key: "note", label: "โน้ต" },
  ],
  production: [
    { key: "id", label: "ลำดับขั้น (101-1xx)", type: "number" },
    { key: "th", label: "ชื่อขั้นตอน (ไทย)" },
    { key: "en", label: "ชื่อขั้นตอน (อังกฤษ)" },
    { key: "team", label: "ทีมรับผิดชอบ", opts: "team" },
    { key: "lead", label: "Lead time (วัน)", type: "number" },
  ],
  customer: [
    { key: "id", label: "รหัสลูกค้า (เช่น C05)" },
    { key: "name", label: "ชื่อบริษัท" },
    { key: "type", label: "ประเภทธุรกิจ" },
    { key: "contact", label: "ผู้ติดต่อ" },
  ],
  ptype: [{ key: "name", label: "ชื่อประเภทสินค้า" }],
  line: [
    { key: "id", label: "รหัสไลน์ (เช่น L4)" },
    { key: "name", label: "ชื่อไลน์" },
    { key: "capacity", label: "กำลังผลิต (ชิ้น/วัน)", type: "number" },
    { key: "note", label: "หมายเหตุ" },
  ],
  dept: [
    { key: "key", label: "Key (ห้ามซ้ำ · ใช้อ้างอิงในระบบ)" },
    { key: "th", label: "ชื่อแผนก (ไทย)" },
    { key: "name", label: "ชื่อแผนก (อังกฤษ)" },
    { key: "email", label: "อีเมลทีม (รับ digest + แจ้งเตือน)" },
    { key: "cls", label: "คลาสสี (t-sale / t-prod / …)" },
  ],
  stock: [
    { key: "id", label: "รหัส (RM-xxx / PK-xxx)" },
    { key: "name", label: "ชื่อรายการ" },
    { key: "type", label: "ประเภท", opts: "type" },
    { key: "unit", label: "หน่วย (kg / ชิ้น / ลิตร)" },
    { key: "qty", label: "ยอดตั้งต้น (แก้ได้เฉพาะตอนสร้างใหม่)", type: "number" },
    { key: "safety", label: "Safety Stock", type: "number" },
    { key: "cost", label: "ต้นทุน/หน่วย (บาท)", type: "number" },
    { key: "supplier", label: "ผู้ขาย" },
    { key: "note", label: "หมายเหตุ" },
  ],
};

const TITLE: Record<string, string> = {
  workflow: "ขั้นตอน Workflow", production: "ขั้นตอนการผลิต", customer: "ลูกค้า",
  ptype: "ประเภทสินค้า", line: "ไลน์ผลิต", dept: "แผนก", stock: "รายการสต็อก",
};

function MasterModal({ m, close, onSave }: {
  m: { kind: string; row: Record<string, unknown> | null } | null;
  close: () => void;
  onSave: (kind: string, row: Record<string, unknown>) => Promise<void>;
}) {
  const { data } = useData();
  const [f, setF] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = m ? `${m.kind}|${JSON.stringify(m.row ?? {})}` : null;
  if (key !== lastKey) { setLastKey(key); setF(m?.row ? { ...m.row } : {}); setErr(""); }

  if (!m) return null;
  const fields = FIELDS[m.kind] ?? [];
  const isNew = !m.row;

  async function save() {
    setBusy(true); setErr("");
    try {
      await onSave(m!.kind, f);
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={close} title={`${isNew ? "เพิ่ม" : "แก้ไข"}${TITLE[m.kind]}`}
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      {fields.map((fd) => {
        const idField = ["id", "key", "name"].includes(fd.key) && m.kind !== "customer" && m.kind !== "ptype";
        const locked = !isNew && (fd.key === "id" || fd.key === "key" || (m.kind === "stock" && fd.key === "qty"));
        void idField;
        return (
          <Field key={fd.key} label={fd.label}>
            {fd.opts === "team" ? (
              <select value={String(f[fd.key] ?? "")} onChange={(e) => setF({ ...f, [fd.key]: e.target.value })}>
                <option value="">— เลือกทีม —</option>
                {data?.departments.map((d) => <option key={d.key} value={d.key}>{d.th} ({d.key})</option>)}
              </select>
            ) : fd.opts === "type" ? (
              <select value={String(f[fd.key] ?? "RM")} onChange={(e) => setF({ ...f, [fd.key]: e.target.value })}>
                <option value="RM">RM — วัตถุดิบ</option>
                <option value="PKG">PKG — แพ็กเกจจิ้ง</option>
              </select>
            ) : (
              <input type={fd.type ?? "text"} disabled={locked}
                value={String(f[fd.key] ?? "")}
                onChange={(e) => setF({ ...f, [fd.key]: fd.type === "number" ? Number(e.target.value) : e.target.value })} />
            )}
          </Field>
        );
      })}
    </Modal>
  );
}
