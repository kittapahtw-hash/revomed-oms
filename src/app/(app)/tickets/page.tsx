"use client";
import { useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Field, Kpi, Modal, Panel, Pill, Team } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { PRIORITIES, PRI_AGE, TEAM_CLS, daysBetween, today } from "@/lib/utils";
import type { Ticket } from "@/lib/types";

type Filter = "active" | "mine" | "done" | "all";

const ST_TH: Record<string, string> = { open: "เปิด", doing: "กำลังทำ", done: "เสร็จ", cancelled: "ยกเลิก" };
const ST_PILL: Record<string, string> = { open: "wait", doing: "run", done: "done", cancelled: "skip" };

const isActive = (t: Ticket) => t.status === "open" || t.status === "doing";
const isOverdue = (t: Ticket) => !!t.due && isActive(t) && daysBetween(today(), t.due) < 0;

export default function TicketsPage() {
  const { data, loading, reload, me } = useData();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Ticket | null>(null);

  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const active = data.tickets.filter(isActive);
  const mine = active.filter((t) => t.assignee === me.username);
  const late = active.filter(isOverdue);

  let list =
    filter === "active" ? active
    : filter === "mine" ? data.tickets.filter((t) => t.assignee === me.username || t.createdBy === me.name)
    : filter === "done" ? data.tickets.filter((t) => t.status === "done" || t.status === "cancelled")
    : data.tickets;

  if (q) {
    const s = q.toLowerCase();
    list = list.filter((t) => t.title.toLowerCase().includes(s) || t.id.toLowerCase().includes(s));
  }
  list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <>
      <div className="kpi-row three">
        <Kpi k={1} label="เปิดค้างทั้งหมด" value={active.length} delta="open + กำลังทำ" />
        <Kpi k={5} label="มอบหมายให้ฉัน" value={mine.length} delta={me.name} />
        <Kpi k={3} label="เลยกำหนด"
          value={<span style={{ color: late.length ? "var(--block)" : "var(--navy)" }}>{late.length}</span>}
          delta="ต้องตามด่วน" />
      </div>

      <Panel title="Ticket / งานมอบหมาย" sub={`${list.length} รายการ`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <input className="search" placeholder="ค้นหา…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>+ สร้าง Ticket</button>
          </div>
        }>
        <div className="stk-tabs">
          <button className={`stk-tab ${filter === "active" ? "active" : ""}`} onClick={() => setFilter("active")}>ค้างอยู่ ({active.length})</button>
          <button className={`stk-tab ${filter === "mine" ? "active" : ""}`} onClick={() => setFilter("mine")}>ของฉัน</button>
          <button className={`stk-tab ${filter === "done" ? "active" : ""}`} onClick={() => setFilter("done")}>เสร็จ/ยกเลิก</button>
          <button className={`stk-tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>ทั้งหมด ({data.tickets.length})</button>
        </div>

        {!list.length ? <Empty icon="✎">ไม่มี Ticket ในมุมมองนี้</Empty> : (
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>เรื่อง</th><th>ถึงทีม</th><th>ผู้รับผิดชอบ</th>
                <th>ความสำคัญ</th><th>กำหนดเสร็จ</th><th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const u = data.users.find((x) => x.username === t.assignee);
                return (
                  <tr key={t.id} className="clickable" onClick={() => setSel(t)}>
                    <td><span className="code">{t.id}</span></td>
                    <td>
                      <b style={{ color: "var(--navy)" }}>{t.title}</b>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        โดย {t.createdBy} · {new Date(t.createdAt).toLocaleDateString("th-TH")}
                        {!!t.files.length && ` · 📎${t.files.length}`}
                        {!!t.comments.length && ` · 💬${t.comments.length}`}
                      </div>
                    </td>
                    <td>{t.toTeam ? <Team cls={TEAM_CLS[t.toTeam] ?? "t-plant"}>{t.toTeam}</Team> : "—"}</td>
                    <td>{u?.name ?? (t.assignee || <span style={{ color: "var(--muted)" }}>ทั้งทีม</span>)}</td>
                    <td><span className={`age ${PRI_AGE[t.priority] ?? "age-ok"}`}>{t.priority}</span></td>
                    <td>
                      {t.due ?? "—"}{" "}
                      {isOverdue(t) && <span className="lowflag">เลยกำหนด</span>}
                    </td>
                    <td><Pill kind={ST_PILL[t.status]}>{ST_TH[t.status]}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <NewTicket open={open} close={() => setOpen(false)} onDone={reload} />
      <TicketDetail t={sel} close={() => setSel(null)} onDone={reload} toast={toast} />
    </>
  );
}

/* ---------- สร้าง Ticket ---------- */
function NewTicket({ open, close, onDone }: { open: boolean; close: () => void; onDone: () => Promise<void> }) {
  const { data } = useData();
  const toast = useToast();
  const [f, setF] = useState({ title: "", desc: "", toTeam: "", assignee: "", priority: "ปกติ", due: "" });
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file); fd.append("ref", "tickets");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (j.ok) { setFiles((v) => [...v, { name: j.name, url: j.url }]); toast(`อัปโหลด ${j.name} แล้ว`, "ok"); }
    else setErr(j.error);
  }

  async function save() {
    if (!f.title.trim()) { setErr("ใส่เรื่องก่อน"); return; }
    setBusy(true); setErr("");
    try {
      await api("/api/tickets", "POST", { ...f, due: f.due || null, files });
      await onDone();
      toast("ส่ง Ticket แล้ว — แจ้งเมลทีม/ผู้รับผิดชอบเรียบร้อย", "ok");
      setF({ title: "", desc: "", toTeam: "", assignee: "", priority: "ปกติ", due: "" });
      setFiles([]);
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={close} title="+ สร้าง Ticket"
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังส่ง…" : "ส่ง Ticket"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      <Field label="เรื่อง *">
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
      </Field>
      <Field label="รายละเอียด">
        <textarea rows={4} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
      </Field>
      <div className="grid2">
        <Field label="ส่งถึงแผนก *">
          <select value={f.toTeam} onChange={(e) => setF({ ...f, toTeam: e.target.value })}>
            <option value="">— เลือกแผนก —</option>
            {data?.departments.map((d) => <option key={d.key} value={d.key}>{d.name} ({d.th})</option>)}
          </select>
        </Field>
        <Field label="มอบหมายให้ (Assign)">
          <select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
            <option value="">— ทั้งทีม (ไม่ระบุคน) —</option>
            {data?.users.map((u) => <option key={u.username} value={u.username}>{u.name} ({u.username})</option>)}
          </select>
        </Field>
        <Field label="ความสำคัญ">
          <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            {PRIORITIES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="กำหนดเสร็จ">
          <input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </Field>
      </div>
      <Field label="ไฟล์แนบ (≤ 8MB)">
        <input type="file" onChange={(e) => { const x = e.target.files?.[0]; if (x) void upload(x); }} />
      </Field>
      {files.map((x) => <span key={x.url} className="filechip">📎 {x.name}</span>)}
    </Modal>
  );
}

/* ---------- รายละเอียด Ticket ---------- */
function TicketDetail({ t, close, onDone, toast }: {
  t: Ticket | null; close: () => void; onDone: () => Promise<void>;
  toast: (m: string, k?: "ok" | "block" | "gold" | "prod" | "gate") => void;
}) {
  const { data } = useData();
  const [c, setC] = useState("");
  const [busy, setBusy] = useState(false);
  if (!t || !data) return null;

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      await api(`/api/tickets/${t!.id}`, "PATCH", body);
      await onDone();
      toast(msg, "ok");
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
    finally { setBusy(false); }
  }

  async function send() {
    if (!c.trim()) return;
    await api(`/api/tickets/${t!.id}`, "PATCH", { comment: c });
    setC("");
    await onDone();
    toast("ส่งคอมเมนต์แล้ว", "ok");
    close();
  }

  const u = data.users.find((x) => x.username === t.assignee);

  return (
    <Modal open onClose={close} title={t.title} wide
      foot={
        <div style={{ display: "flex", gap: 6, width: "100%", flexWrap: "wrap" }}>
          {t.status !== "doing" && t.status !== "done" && (
            <button className="btn btn-sm" disabled={busy}
              onClick={() => void patch({ status: "doing" }, "เริ่มทำแล้ว")}>▶ เริ่มทำ</button>
          )}
          {t.status !== "done" && (
            <button className="btn btn-ok btn-sm" disabled={busy}
              onClick={() => void patch({ status: "done" }, "ปิด Ticket แล้ว — แจ้งเมลเรียบร้อย")}>✓ ปิดงาน</button>
          )}
          {t.status !== "cancelled" && (
            <button className="btn btn-sm" disabled={busy}
              onClick={() => void patch({ status: "cancelled" }, "ยกเลิก Ticket แล้ว")}>✕ ยกเลิก</button>
          )}
          <button className="btn btn-block btn-sm" disabled={busy}
            onClick={async () => {
              await api(`/api/tickets/${t.id}`, "DELETE");
              await onDone();
              toast(`ลบ ${t.id} แล้ว`, "block");
              close();
            }}>🗑 ลบ</button>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={close}>ปิด</button>
        </div>
      }>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Pill kind={ST_PILL[t.status]}>{ST_TH[t.status]}</Pill>
        <span className={`age ${PRI_AGE[t.priority] ?? "age-ok"}`}>{t.priority}</span>
        {t.toTeam && <Team cls={TEAM_CLS[t.toTeam] ?? "t-plant"}>{t.toTeam}</Team>}
        <span className="code">{t.id}</span>
      </div>

      <p style={{ whiteSpace: "pre-wrap", fontSize: 13, marginBottom: 14 }}>{t.desc || "—"}</p>

      <div className="grid2">
        <Field label="ผู้รับผิดชอบ (เปลี่ยนได้ทันที)">
          <select value={t.assignee} disabled={busy}
            onChange={(e) => void patch({ assignee: e.target.value },
              e.target.value ? "มอบหมายใหม่แล้ว — แจ้งเมลเรียบร้อย" : "ยกเลิกผู้รับผิดชอบ")}>
            <option value="">— ทั้งทีม —</option>
            {data.users.map((x) => <option key={x.username} value={x.username}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="กำหนดเสร็จ">
          <input type="date" value={t.due ?? ""} disabled={busy}
            onChange={(e) => void patch({ due: e.target.value || null }, "อัปเดตกำหนดเสร็จแล้ว")} />
        </Field>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12 }}>
        สร้างโดย {t.createdBy} · {new Date(t.createdAt).toLocaleString("th-TH")}
        {u && ` · ปัจจุบัน: ${u.name}`}
      </div>

      {!!t.files.length && (
        <div style={{ marginBottom: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {t.files.map((f) => (
            <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="filechip">📎 {f.name}</a>
          ))}
        </div>
      )}

      <div className="log" style={{ padding: 0, maxHeight: 220 }}>
        {!t.comments.length && <div className="empty" style={{ padding: 20 }}>ยังไม่มีคอมเมนต์</div>}
        {[...t.comments].reverse().map((x, i) => (
          <div key={i} className="log-item">
            <div className="log-ic comment">💬</div>
            <div className="log-txt">
              {x.text}
              <div className="log-meta">{x.who} · {new Date(x.ts).toLocaleString("th-TH")}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="cmt-bar" style={{ padding: "12px 0 0" }}>
        <input value={c} onChange={(e) => setC(e.target.value)} placeholder="พิมพ์คอมเมนต์…"
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }} />
        <button className="btn btn-primary" onClick={() => void send()}>ส่ง</button>
      </div>
    </Modal>
  );
}
