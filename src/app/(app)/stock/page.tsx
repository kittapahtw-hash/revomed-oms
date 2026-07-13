"use client";
import Link from "next/link";
import { useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Field, Kpi, Modal, Panel, Pill, Team } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { money } from "@/lib/utils";
import { expiryAlerts } from "@/lib/domain";
import type { StockRow } from "@/lib/types";

type Tab = "all" | "rm" | "pkg" | "low";

export default function StockPage() {
  const { data, loading, reload, can } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [move, setMove] = useState<{ id: string; dir: "in" | "out" } | null>(null);
  const [pr, setPr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<StockRow> | null>(null);

  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;

  const avail = (s: StockRow) => Number(s.available);
  const isLow = (s: StockRow) => avail(s) <= Number(s.safety);
  const value = (s: StockRow) => Number(s.qty) * Number(s.cost);

  const rm = data.stock.filter((s) => s.type === "RM");
  const pk = data.stock.filter((s) => s.type === "PKG");
  const lows = data.stock.filter(isLow);
  const totalVal = data.stock.reduce((a, s) => a + value(s), 0);

  let list = tab === "rm" ? rm : tab === "pkg" ? pk : tab === "low" ? lows : data.stock;
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((x) => x.name.toLowerCase().includes(s) || x.id.toLowerCase().includes(s));
  }

  const moves = data.moves.slice(0, 25);

  async function undo(id: number) {
    try {
      await api("/api/stock/undo", "POST", { id });
      await reload();
      toast("ย้อนรายการแล้ว — สร้างรายการฝั่งตรงข้ามให้เรียบร้อย", "gold");
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
  }

  return (
    <>
      <div className="kpi-row">
        <Kpi k={1} label="วัตถุดิบ (RM)" value={rm.length} delta="รายการในคลัง" />
        <Kpi k={5} label="แพ็กเกจจิ้ง (PKG)" value={pk.length} delta="รายการในคลัง" />
        <Kpi k={3} label="ต่ำกว่า Safety Stock"
          value={<span style={{ color: lows.length ? "var(--block)" : "var(--navy)" }}>{lows.length}</span>}
          delta="ต้องสั่งเพิ่มด่วน" />
        <Kpi k={2} label="มูลค่าคงคลังรวม"
          value={<span style={{ fontSize: 22 }}>{money(totalVal)} ฿</span>}
          delta="ตามต้นทุนต่อหน่วย" />
      </div>

      <Panel title="สินค้าคงคลัง" sub={`${list.length} รายการ`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <input className="search" placeholder="ค้นหา…" value={q} onChange={(e) => setQ(e.target.value)} />
            {can("setup") && (
              <button className="btn btn-primary btn-sm" onClick={() => setEdit({ type: "RM" })}>+ เพิ่มรายการ</button>
            )}
          </div>
        }>
        <div className="stk-tabs">
          <button className={`stk-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>ทั้งหมด ({data.stock.length})</button>
          <button className={`stk-tab ${tab === "rm" ? "active" : ""}`} onClick={() => setTab("rm")}>วัตถุดิบ ({rm.length})</button>
          <button className={`stk-tab ${tab === "pkg" ? "active" : ""}`} onClick={() => setTab("pkg")}>แพ็กเกจจิ้ง ({pk.length})</button>
          <button className={`stk-tab ${tab === "low" ? "active" : ""}`} onClick={() => setTab("low")}>ต่ำกว่า Safety ({lows.length})</button>
        </div>

        {!list.length ? <Empty icon="▣">ไม่มีรายการ</Empty> : (
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>รายการ</th><th>ประเภท</th>
                <th>คงเหลือจริง</th><th>จอง (Reserve)</th><th>ใช้ได้</th><th>Safety</th>
                <th style={{ width: 100 }}>ระดับ</th><th>มูลค่า</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((it) => {
                const a = avail(it);
                const rsv = Number(it.reserved);
                const safe = Number(it.safety);
                const low = isLow(it);
                const ratio = safe > 0 ? Math.max(0, Math.min(100, Math.round((a / (safe * 2)) * 100))) : 100;
                const barCol = low ? "var(--block)" : ratio < 75 ? "var(--warn)" : "var(--ok)";
                return (
                  <tr key={it.id}>
                    <td><span className="code">{it.id}</span></td>
                    <td>
                      <b style={{ color: "var(--navy)" }}>{it.name}</b>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{it.supplier}</div>
                    </td>
                    <td>
                      {it.type === "RM"
                        ? <Team cls="t-prod">วัตถุดิบ</Team>
                        : <Team cls="t-pur">แพ็กเกจจิ้ง</Team>}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {money(it.qty)} <span style={{ fontSize: 11, color: "var(--muted)" }}>{it.unit}</span>
                    </td>
                    <td>
                      {rsv > 0
                        ? <span className="age age-warn" title="ถูกจองโดยโปรเจกต์ที่เปิดอยู่ — ห้ามเบิก">{money(rsv)}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 800, color: low ? "var(--block)" : "var(--navy)" }}>
                      {money(a)}
                      {low && <div><span className="lowflag">ต่ำกว่า Safety</span></div>}
                    </td>
                    <td>{money(safe)}</td>
                    <td>
                      <div className="stk-bar"><span style={{ width: `${ratio}%`, background: barCol }} /></div>
                    </td>
                    <td style={{ fontSize: 12 }}>{money(value(it))} ฿</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link href={`/lots?item=${it.id}`} className="btn btn-ok btn-sm">รับเข้า</Link>{" "}
                      <button className="btn btn-sm" onClick={() => setMove({ id: it.id, dir: "out" })}>จ่ายออก</button>{" "}
                      {low && (
                        <button className="btn btn-gold btn-sm" onClick={() => setPr(it.id)}>ขอซื้อ</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="legend">
          <span><b>ใช้ได้ = คงเหลือจริง − จอง</b> · Safety เทียบกับยอดใช้ได้</span>
          <span>จ่ายออกกินยอดจองไม่ได้ — ระบบบล็อกอัตโนมัติ</span>
        </div>
      </Panel>

      <Panel title="การเคลื่อนไหวล่าสุด (Stock Movement)" sub="25 รายการล่าสุด">
        {!moves.length ? <Empty icon="≡">ยังไม่มีการเคลื่อนไหว</Empty> : (
          <table>
            <thead><tr>
              <th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>จำนวน</th><th>อ้างอิง</th><th>โดย</th><th></th>
            </tr></thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontSize: 12 }}>{new Date(m.ts).toLocaleString("th-TH")}</td>
                  <td><span className="code">{m.itemId}</span> {m.itemName}</td>
                  <td><Pill kind={DIR_PILL[m.dir] ?? "wait"}>{DIR_TH[m.dir] ?? m.dir}</Pill></td>
                  <td style={{ fontWeight: 700 }}>{money(m.qty)}</td>
                  <td style={{ fontSize: 12 }}>{m.ref || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>
                    {m.who}{m.note && ` · ${m.note}`}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {(m.dir === "in" || m.dir === "out") && !m.note.startsWith("ย้อน") && (
                      <button className="btn btn-ghost btn-sm" onClick={() => void undo(m.id)}>ย้อน</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <MoveModal move={move} close={() => setMove(null)} onDone={reload} />
      <PrModal itemId={pr} close={() => setPr(null)} onDone={reload} />
      <StockEdit s={edit} close={() => setEdit(null)} onDone={reload} />
    </>
  );
}

/** แถบเตือนล็อตใกล้หมดอายุ / หมดแล้ว */
function ExpiryStrip() {
  const { data } = useData();
  if (!data) return null;
  const al = expiryAlerts(data);
  if (!al.expired.length && !al.soon.length) return null;
  return (
    <>
      {!!al.expired.length && (
        <div className="alert-strip">
          <span>☠</span>
          <span><b>{al.expired.length} ล็อตหมดอายุ</b> — ระบบบล็อกการเบิกแล้ว ต้องทำลาย/ส่งคืน + บันทึก</span>
          <Link href="/lots?tab=expired" className="btn btn-sm">ดูล็อต</Link>
        </div>
      )}
      {!!al.soon.length && (
        <div className="alert-strip" style={{ background: "var(--warn-bg)", borderColor: "#e3cf8e", color: "#946008" }}>
          <span>⏳</span>
          <span>{al.soon.length} ล็อตใกล้หมดอายุใน 30 วัน — FEFO จะหยิบตัวนี้ก่อนอัตโนมัติ</span>
          <Link href="/lots" className="btn btn-sm">ดูล็อต</Link>
        </div>
      )}
    </>
  );
}

const DIR_TH: Record<string, string> = {
  in: "รับเข้า", out: "จ่ายออก", reserve: "จอง", release: "ปล่อยจอง", issue: "ตัดจริง", return: "รับคืน",
};
const DIR_PILL: Record<string, string> = {
  in: "done", out: "block", reserve: "gate", release: "wait", issue: "ready", return: "prod",
};

/* ---------- รับเข้า / จ่ายออก ---------- */
/** จ่ายออกเท่านั้น — "รับเข้า" ย้ายไปหน้าล็อตแล้ว เพราะต้องระบุ lot + วันหมดอายุ */
function MoveModal({ move, close, onDone }: {
  move: { id: string; dir: "in" | "out" } | null; close: () => void; onDone: () => Promise<void>;
}) {
  const { data } = useData();
  const toast = useToast();
  const [qty, setQty] = useState(0);
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const it = data?.stock.find((s) => s.id === move?.id);
  const isIn = move?.dir === "in";

  async function save() {
    if (!move) return;
    if (!qty || qty <= 0) { setErr("ใส่จำนวนก่อน"); return; }
    setBusy(true); setErr("");
    try {
      await api("/api/stock/move", "POST", { itemId: move.id, dir: move.dir, qty, ref, note });
      await onDone();
      toast(`${isIn ? "รับเข้า" : "จ่ายออก"} ${qty} ${it?.unit} แล้ว`, "ok");
      setQty(0); setRef(""); setNote("");
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  if (!move || !it) return null;

  return (
    <Modal open onClose={close} title={`${isIn ? "รับเข้า" : "จ่ายออก"} — ${it.name}`}
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className={`btn ${isIn ? "btn-ok" : "btn-primary"}`} disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : isIn ? "รับเข้า" : "จ่ายออก"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}

      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
        คงเหลือจริง <b style={{ color: "var(--navy)" }}>{money(it.qty)}</b> ·
        จองไว้ <b style={{ color: "var(--warn)" }}>{money(it.reserved)}</b> ·
        ใช้ได้ <b style={{ color: "var(--navy)" }}>{money(it.available)} {it.unit}</b> ·
        Safety {money(it.safety)}
      </div>

      <div className="grid2">
        <Field label={`จำนวน (${it.unit}) *`}>
          <input type="number" min={0} step="any" value={qty || ""} autoFocus
            onChange={(e) => setQty(Number(e.target.value))} />
        </Field>
        <Field label="อ้างอิง (PO/โปรเจกต์ ฯลฯ)">
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="เช่น PR-1234" />
        </Field>
      </div>
      <Field label="หมายเหตุ">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

/* ---------- ขอซื้อ (PR) ---------- */
function PrModal({ itemId, close, onDone }: {
  itemId: string | null; close: () => void; onDone: () => Promise<void>;
}) {
  const { data } = useData();
  const toast = useToast();
  const [qty, setQty] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const it = data?.stock.find((s) => s.id === itemId);

  if (itemId !== lastId) {
    setLastId(itemId);
    if (it) setQty(Math.max(0, Math.ceil(Number(it.safety) * 2 - Number(it.available))));
  }
  if (!itemId || !it) return null;

  async function send() {
    setBusy(true);
    try {
      await api("/api/tickets", "POST", {
        title: `ขอซื้อ ${it!.id} ${it!.name}`,
        desc:
          `สต็อกคงเหลือจริง ${money(it!.qty)} ${it!.unit}`
          + ` · ถูกจอง ${money(it!.reserved)}`
          + ` · ใช้ได้ ${money(it!.available)} (ต่ำกว่า Safety ${money(it!.safety)})\n`
          + `จำนวนแนะนำสั่งซื้อ: ~${qty.toLocaleString()} ${it!.unit} (เติมถึงระดับ 2 เท่าของ Safety)\n`
          + `Supplier ล่าสุด: ${it!.supplier || "—"}\n`
          + `มูลค่าประมาณ: ฿${money(qty * Number(it!.cost))}`,
        toTeam: "Purchasing",
        priority: Number(it!.available) <= 0 ? "ด่วนมาก" : "ด่วน",
        files: [],
      });
      await onDone();
      toast("ยิง Ticket ขอซื้อถึงทีมจัดซื้อแล้ว — แจ้งเมลเรียบร้อย", "gold");
      close();
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={close} title={`ขอซื้อ (PR) — ${it.name}`}
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-gold" disabled={busy || qty <= 0} onClick={() => void send()}>
          {busy ? "กำลังส่ง…" : "ยิง Ticket ถึงจัดซื้อ"}
        </button>
      </>}>
      <div className="info-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 14 }}>
        <div className="info"><div className="l">ใช้ได้ตอนนี้</div>
          <div className="v" style={{ color: "var(--block)" }}>{money(it.available)} {it.unit}</div></div>
        <div className="info"><div className="l">Safety Stock</div><div className="v">{money(it.safety)}</div></div>
        <div className="info"><div className="l">Supplier ล่าสุด</div>
          <div className="v" style={{ fontSize: 13 }}>{it.supplier || "—"}</div></div>
      </div>
      <Field label={`จำนวนแนะนำสั่งซื้อ (${it.unit}) — เติมถึง 2 เท่าของ Safety`}>
        <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} autoFocus />
      </Field>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 8 }}>
        มูลค่าประมาณ <b style={{ color: "var(--navy)" }}>฿{money(qty * Number(it.cost))}</b>
        {" "}(ต้นทุนล่าสุด ฿{money(it.cost)}/{it.unit})
      </div>
    </Modal>
  );
}

/* ---------- เพิ่มรายการใหม่ ---------- */
function StockEdit({ s, close, onDone }: {
  s: Partial<StockRow> | null; close: () => void; onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [f, setF] = useState<Record<string, unknown>>({ type: "RM" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (!s) return null;

  async function save() {
    setBusy(true); setErr("");
    try {
      await api("/api/master", "POST", { kind: "stock", data: f });
      await onDone();
      toast("เพิ่มรายการแล้ว", "ok");
      setF({ type: "RM" });
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={close} title="เพิ่มรายการในคลัง"
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>บันทึก</button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      <div className="grid2">
        <Field label="รหัส (RM-xxx / PK-xxx)">
          <input value={String(f.id ?? "")} onChange={(e) => setF({ ...f, id: e.target.value })} autoFocus />
        </Field>
        <Field label="ชื่อรายการ">
          <input value={String(f.name ?? "")} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="ประเภท">
          <select value={String(f.type ?? "RM")} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="RM">RM — วัตถุดิบ</option>
            <option value="PKG">PKG — แพ็กเกจจิ้ง</option>
          </select>
        </Field>
        <Field label="หน่วย (kg / ชิ้น / ลิตร)">
          <input value={String(f.unit ?? "")} onChange={(e) => setF({ ...f, unit: e.target.value })} />
        </Field>
        <Field label="ยอดตั้งต้น">
          <input type="number" value={Number(f.qty ?? 0)} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
        </Field>
        <Field label="Safety Stock">
          <input type="number" value={Number(f.safety ?? 0)} onChange={(e) => setF({ ...f, safety: Number(e.target.value) })} />
        </Field>
        <Field label="ต้นทุน/หน่วย (บาท)">
          <input type="number" value={Number(f.cost ?? 0)} onChange={(e) => setF({ ...f, cost: Number(e.target.value) })} />
        </Field>
        <Field label="Supplier">
          <input value={String(f.supplier ?? "")} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
