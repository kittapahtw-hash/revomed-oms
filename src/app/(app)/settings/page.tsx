"use client";
import { useEffect, useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Field, Modal, Panel, Pill } from "@/components/ui";
import { useToast } from "@/components/Toast";
import type { SessionUser } from "@/lib/types";

/** ตรงกับ PERM_VIEWS ของระบบเดิมเป๊ะ — 13 สิทธิ์ */
const PERM_LIST = [
  ["exec", "Executive"], ["dashboard", "Dashboard"], ["projects", "โปรเจกต์"],
  ["board", "บอร์ดทีม"], ["production", "การผลิต"], ["plant", "ไลน์ผลิต"],
  ["stock", "สต็อก"], ["tickets", "Ticket/งานมอบหมาย"], ["kpi", "KPI Dashboard"],
  ["aging", "งานดอง/SLA"], ["summary", "สรุป Flow"], ["report", "Lead Time/คอขวด"],
  ["setup", "ตั้งค่า Tracker"],
] as const;

type Tab = "users" | "notify" | "audit" | "data";

export default function SettingsPage() {
  const { data, loading, reload, me } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("users");
  const [edit, setEdit] = useState<SessionUser | null>(null);

  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;
  if (!me.admin) return <Empty icon="🔒">เฉพาะ Admin เท่านั้น</Empty>;

  async function del(username: string) {
    try {
      await api("/api/users", "DELETE", { username });
      await reload();
      toast(`ลบผู้ใช้ ${username} แล้ว`, "block");
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
  }

  return (
    <>
      <div className="setup-tabs">
        <button className={`setup-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>ผู้ใช้ &amp; สิทธิ์</button>
        <button className={`setup-tab ${tab === "notify" ? "active" : ""}`} onClick={() => setTab("notify")}>การแจ้งเตือน</button>
        <button className={`setup-tab ${tab === "audit" ? "active" : ""}`} onClick={() => setTab("audit")}>Audit Log</button>
        <button className={`setup-tab ${tab === "data" ? "active" : ""}`} onClick={() => setTab("data")}>ข้อมูลระบบ</button>
      </div>

      {tab === "users" && (
        <Panel title="ผู้ใช้ & สิทธิ์การเข้าถึง" sub={`${data.users.length} คน`}
          right={<button className="btn btn-primary btn-sm"
            onClick={() => setEdit({ username: "", name: "", email: "", admin: false, perms: {} })}>
            + เพิ่มผู้ใช้
          </button>}>
          <table>
            <thead><tr><th>Username</th><th>ชื่อ</th><th>สิทธิ์</th><th>เข้าถึงหน้า</th><th>จัดการ</th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.username}>
                  <td><span className="code">{u.username}</span></td>
                  <td><b style={{ color: "var(--navy)" }}>{u.name}</b>
                    {u.email && <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.email}</div>}</td>
                  <td>{u.admin ? <Pill kind="gate">Admin</Pill> : <Pill kind="run">User</Pill>}</td>
                  <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    {u.admin ? "ทุกหน้า" :
                      PERM_LIST.filter(([k]) => u.perms?.[k] === 1).map(([, l]) => l).join(", ") || "—"}
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setEdit(u)}>แก้ไข</button>
                    <button className="btn btn-sm btn-block" style={{ marginLeft: 4 }}
                      onClick={() => void del(u.username)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="legend">
            <span>ติ๊กเลือกได้ว่าผู้ใช้แต่ละคนเห็นหน้าไหนบ้าง · Admin เห็นทุกหน้าเสมอ</span>
          </div>
        </Panel>
      )}

      {tab === "notify" && <NotifyTab onDone={reload} />}
      {tab === "audit" && <AuditTab />}
      {tab === "data" && <DataTab onDone={reload} />}

      <UserModal u={edit} close={() => setEdit(null)} onDone={reload} />
    </>
  );
}

/* ---------------- การแจ้งเตือน ---------------- */
function NotifyTab({ onDone }: { onDone: () => Promise<void> }) {
  const { data } = useData();
  const toast = useToast();
  const [emails, setEmails] = useState(data?.config.notifyEmails ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api("/api/config", "POST", { notifyEmails: emails });
      await onDone();
      toast("บันทึกการตั้งค่าแล้ว", "ok");
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
    finally { setBusy(false); }
  }

  async function testNow() {
    setBusy(true);
    try {
      const r = await fetch("/api/cron/digest");
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast(`ส่งแล้ว ${j.sent?.length ?? 0} ทีม · งานค้าง ${j.stats?.waiting ?? 0} · ติดปัญหา ${j.stats?.blocked ?? 0}`, "ok");
    } catch (e) { toast(e instanceof Error ? e.message : "ส่งไม่สำเร็จ", "block"); }
    finally { setBusy(false); }
  }

  const noEmail = (data?.departments ?? []).filter((d) => !d.email);

  return (
    <Panel title="การแจ้งเตือน" sub="อีเมลสรุปงานประจำวัน + แจ้งเตือนตอนงานส่งต่อ">
      <div style={{ padding: "6px 14px", maxWidth: 640 }}>
        <Field label="อีเมลที่รับสำเนาทุกทีม (คั่นด้วย , หรือเว้นวรรค)">
          <input value={emails} onChange={(e) => setEmails(e.target.value)}
            placeholder="boss@revomed.com, admin@revomed.com" />
        </Field>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>บันทึก</button>
          <button className="btn" disabled={busy} onClick={() => void testNow()}>✉ ทดสอบส่งตอนนี้</button>
        </div>

        {!!noEmail.length && (
          <div className="alert-strip">
            <span>⚠</span>
            <span>
              {noEmail.length} แผนกยังไม่ได้ตั้งอีเมลทีม ({noEmail.map((d) => d.th).join(", ")}) —
              จะไม่ได้รับ digest และไม่ได้รับแจ้งตอนงานส่งต่อ · ตั้งได้ที่ <b>ตั้งค่า Tracker → แผนก</b>
            </span>
          </div>
        )}

        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.9, marginTop: 12 }}>
          <p><b style={{ color: "var(--navy)" }}>เนื้อหา digest (ส่งทุกเช้า):</b></p>
          <p>1) งานที่รอทีมนั้น · 2) งานติดปัญหา (blocked) · 3) ขั้นที่ข้ามไว้ค้าง · 4) เลยกำหนดส่ง · 5) สต็อกต่ำกว่า Safety</p>
          <p style={{ marginTop: 10 }}><b style={{ color: "var(--navy)" }}>แจ้งเตือนทันที:</b> ตอนงานส่งต่อถึงทีม · ตอนงานติดปัญหา · ตอนลูกค้าตีกลับ · ตอนถูกมอบหมาย Ticket</p>
          <p style={{ marginTop: 10, color: "var(--muted)" }}>
            เวลาส่งตั้งที่ <span className="code">vercel.json</span> → <span className="code">&quot;schedule&quot;: &quot;0 0 * * *&quot;</span> (= 07:00 น. ไทย)
            <br />ต้องตั้ง <b>RESEND_API_KEY</b> ใน Vercel ก่อน ไม่งั้นอีเมลไม่ถูกส่ง (ระบบจะเงียบๆ ข้ามไป)
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- Audit Log ---------------- */
type AuditRow = { id: number; ts: string; user: string; action: string; detail: string };

function AuditTab() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/audit");
      const j = await r.json();
      if (j.ok) setRows(j.rows);
    })();
  }, []);

  if (!rows) return <Panel title="Audit Log"><div className="empty">กำลังโหลด…</div></Panel>;

  const list = rows.filter((r) => !q || (r.user + r.action + r.detail).toLowerCase().includes(q.toLowerCase()));

  return (
    <Panel title="Audit Log" sub="200 รายการล่าสุด · ใครแก้อะไรเมื่อไหร่"
      right={<input className="search" placeholder="ค้นหา…" value={q} onChange={(e) => setQ(e.target.value)} />}>
      {!list.length ? <Empty icon="≡">ไม่พบรายการ</Empty> : (
        <div style={{ maxHeight: 520, overflow: "auto" }}>
          <table>
            <thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {new Date(r.ts).toLocaleString("th-TH")}
                  </td>
                  <td><span className="code">{r.user}</span></td>
                  <td><b style={{ color: "var(--navy)", fontSize: 12.5 }}>{r.action}</b></td>
                  <td style={{ fontSize: 12, color: "var(--ink-soft)", wordBreak: "break-all" }}>{r.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- ล้างข้อมูล ---------------- */
const SCOPES = [
  ["projects", "โปรเจกต์ทั้งหมด (+ ล้างยอดจองสต็อก)"],
  ["tickets", "Ticket ทั้งหมด"],
  ["stock", "สต็อก + ประวัติเคลื่อนไหวทั้งหมด"],
  ["lineOutput", "บันทึกผลผลิตไลน์"],
  ["announcements", "ประกาศ"],
  ["events", "อีเวนต์ / วันหยุด"],
] as const;

function DataTab({ onDone }: { onDone: () => Promise<void> }) {
  const toast = useToast();
  const [pick, setPick] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await api<{ done: string[] }>("/api/admin/clear", "POST", { scopes: pick, confirm });
      await onDone();
      toast(`ลบแล้ว: ${r.done.join(" · ")}`, "block");
      setPick([]); setConfirm(""); setOpen(false);
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Panel title="ข้อมูลระบบ — ล้างข้อมูลตัวอย่าง" sub="ลบแล้วกู้คืนไม่ได้ · ระบบจะไม่ seed ข้อมูลตัวอย่างกลับมาอีก">
        <div style={{ padding: "8px 14px" }}>
          <div className="alert-strip">
            <span>⚠</span>
            <span><b>ลบแล้วหายถาวร</b> — ถ้าไม่แน่ใจ ให้ backup ที่ Neon (Branches → Create branch) ก่อน</span>
          </div>

          <div style={{ display: "grid", gap: 8, margin: "14px 0" }}>
            {SCOPES.map(([k, label]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, cursor: "pointer" }}>
                <input type="checkbox" checked={pick.includes(k)}
                  onChange={(e) => setPick((v) => e.target.checked ? [...v, k] : v.filter((x) => x !== k))} />
                {label}
              </label>
            ))}
          </div>

          <button className="btn btn-block" disabled={!pick.length} onClick={() => setOpen(true)}>
            🗑 ลบข้อมูลที่เลือก ({pick.length})
          </button>
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title="ยืนยันการลบข้อมูล"
        foot={<>
          <button className="btn" onClick={() => setOpen(false)}>ยกเลิก</button>
          <button className="btn btn-block" disabled={busy || confirm !== "ลบเลย"} onClick={() => void run()}>
            {busy ? "กำลังลบ…" : "ลบถาวร"}
          </button>
        </>}>
        <div className="alert-strip"><span>⚠</span><span>กู้คืนไม่ได้</span></div>
        <p style={{ fontSize: 13, margin: "12px 0" }}>กำลังจะลบ:</p>
        <ul style={{ paddingLeft: 20, fontSize: 13, lineHeight: 1.9, color: "var(--block)" }}>
          {pick.map((k) => <li key={k}>{SCOPES.find(([s]) => s === k)?.[1]}</li>)}
        </ul>
        <Field label='พิมพ์ "ลบเลย" เพื่อยืนยัน'>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ลบเลย" autoFocus />
        </Field>
      </Modal>
    </>
  );
}

/* ---------------- ผู้ใช้ ---------------- */
function UserModal({ u, close, onDone }: { u: SessionUser | null; close: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [f, setF] = useState<SessionUser & { newPassword?: string }>(
    u ?? { username: "", name: "", email: "", admin: false, perms: {} }
  );
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = u ? u.username || "__new__" : null;
  if (key !== lastKey) { setLastKey(key); if (u) setF({ ...u, newPassword: "" }); }

  async function save() {
    setBusy(true); setErr("");
    try {
      await api("/api/users", "POST", f);
      await onDone();
      toast("บันทึกผู้ใช้เรียบร้อย", "ok");
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  if (!u) return null;

  return (
    <Modal open onClose={close} title={u.username ? `แก้ไข ${u.name}` : "เพิ่มผู้ใช้"} wide
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      <div className="grid2">
        <Field label="Username">
          <input disabled={!!u.username} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        </Field>
        <Field label="ชื่อที่แสดง">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="อีเมล (รับแจ้งเตือน Ticket)">
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label={u.username ? "รหัสผ่านใหม่ (เว้นว่าง = ใช้รหัสเดิม)" : "รหัสผ่าน"}>
          <input type="password" value={f.newPassword ?? ""} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
        </Field>
      </div>

      <div className="field">
        <label>สิทธิ์การเข้าถึง</label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--navy)", marginBottom: 10 }}>
          <input type="checkbox" checked={f.admin} onChange={(e) => setF({ ...f, admin: e.target.checked })} />
          Admin — เห็นทุกหน้า + เข้า System Settings ได้
        </label>

        {!f.admin && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PERM_LIST.map(([k, label]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--ink-soft)" }}>
                <input type="checkbox" checked={f.perms?.[k] === 1}
                  onChange={(e) => setF({ ...f, perms: { ...f.perms, [k]: e.target.checked ? 1 : 0 } })} />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
