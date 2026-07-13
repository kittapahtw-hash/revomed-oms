"use client";
import { useEffect, useState } from "react";
import { api, useData } from "@/lib/store";
import { Field, Modal } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { CAL_ICO, IwFoot, IwNav } from "@/components/Intranet";
import { ANN_CATS, EN_MONTHS, EN_MON_S, HERO_SLIDES } from "@/lib/intranet";
import type { Ann, Evt } from "@/lib/types";

export default function HomeMain() {
  const { data, me, loading, reload } = useData();
  const toast = useToast();

  const [hero, setHero] = useState(0);
  const [annFilter, setAnnFilter] = useState("all");
  const [annShowAll, setAnnShowAll] = useState(false);
  const [openAnn, setOpenAnn] = useState<Ann | null>(null);
  const [editAnn, setEditAnn] = useState<Partial<Ann> | null>(null);
  const [editEvt, setEditEvt] = useState<Partial<Evt> | null>(null);

  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());

  // hero autoplay 5 วิ
  useEffect(() => {
    const t = setInterval(() => setHero((i) => (i + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [hero]);

  const anns = [...(data?.announcements ?? [])].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const filtered = annFilter === "all" ? anns : anns.filter((a) => a.cat === annFilter);
  const shown = annShowAll ? filtered : filtered.slice(0, 6);

  const events = data?.events ?? [];
  const evtMap = new Map<string, Evt[]>();
  events.forEach((e) => { const a = evtMap.get(e.date) ?? []; a.push(e); evtMap.set(e.date, a); });

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const startDow = new Date(calY, calM, 1).getDay();
  const dim = new Date(calY, calM + 1, 0).getDate();
  const prevDim = new Date(calY, calM, 0).getDate();
  const tail = (7 - ((startDow + dim) % 7)) % 7;

  const monthEvts = events
    .filter((e) => { const d = new Date(e.date); return d.getFullYear() === calY && d.getMonth() === calM; })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  function shift(n: number) {
    let m = calM + n, y = calY;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalM(m); setCalY(y);
  }

  async function delAnn(id: string) {
    await api("/api/announcements", "DELETE", { id });
    await reload(); setOpenAnn(null);
    toast("ลบประกาศแล้ว", "block");
  }
  async function delEvt(id: string) {
    await api("/api/events", "DELETE", { id });
    await reload();
    toast("ลบอีเวนต์แล้ว", "block");
  }

  return (
    <div className="home">
      <IwNav page="main" />

      <div className="iw-wrap">
        {/* ---------- HERO CAROUSEL ---------- */}
        <div className="iw-hero">
          {HERO_SLIDES.map((s, i) => (
            <div key={i} className={`iw-slide ${s.cls} ${i === hero ? "on" : ""}`}
              onClick={() => window.open(s.url, "_blank")} title={`อ่านข่าวเต็มจาก ${s.src}`}>
              <div className="wm">{s.wm}</div>
              {s.img && (
                <div className="nimg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.img} alt="" loading="lazy" referrerPolicy="no-referrer"
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                </div>
              )}
              <div className="ncontent">
                <div className="ntag">{s.tag}</div>
                <h2>{s.h}</h2>
                <div className="sub">{s.sub}</div>
                <div className="nsrc">อ่านต่อที่ {s.src} →</div>
              </div>
            </div>
          ))}
          <div className="dots">
            {HERO_SLIDES.map((_, i) => (
              <button key={i} className={i === hero ? "on" : ""}
                onClick={(e) => { e.stopPropagation(); setHero(i); }} aria-label={`สไลด์ ${i + 1}`} />
            ))}
          </div>
        </div>

        {/* ---------- ANNOUNCEMENTS ---------- */}
        <div className="iw-sec">
          <div className="iw-sec-head">
            <h3>Announcements</h3>
            {filtered.length > 6 ? (
              <button className="iw-seeall" onClick={() => setAnnShowAll((v) => !v)}>
                {annShowAll ? "Show Less" : "See All"}
              </button>
            ) : <span style={{ marginLeft: "auto" }} />}
            {me.admin && (
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 12 }}
                onClick={() => setEditAnn({ cat: "ประกาศบริษัท" })}>+ เพิ่มประกาศ</button>
            )}
          </div>

          <div className="iw-chips">
            {[["all", "All"] as [string, string], ...ANN_CATS.map((c) => [c, c] as [string, string])].map(([k, l]) => (
              <button key={k} className={`iw-chip ${annFilter === k ? "active" : ""}`}
                onClick={() => { setAnnFilter(k); setAnnShowAll(false); }}>{l}</button>
            ))}
          </div>

          <div className="iw-cards">
            {loading && <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--muted)", padding: 30 }}>กำลังโหลด…</div>}
            {!loading && !shown.length && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--muted)", padding: 30 }}>
                ยังไม่มีประกาศในหมวดนี้
              </div>
            )}
            {shown.map((a) => (
              <div key={a.id} className="iw-card" onClick={() => setOpenAnn(a)}>
                <h4>{a.title}</h4>
                <div className="body">{a.body}</div>
                <div className="foot">
                  <span className="iw-cat">{a.cat}</span>
                  <span className="iw-meta">
                    Posted by {a.by}<br />{CAL_ICO}{new Date(a.ts).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- CALENDAR ---------- */}
        <div className="iw-sec">
          <div className="iw-sec-head"><h3>Events &amp; Public Holidays Calendar</h3></div>
          <div className="iw-cal-grid">
            <div className="cal-box">
              <div className="cal-head">
                <button onClick={() => shift(-1)}>‹</button>
                <h4>{EN_MONTHS[calM]} {calY}</h4>
                <button onClick={() => shift(1)}>›</button>
              </div>
              <div className="cal-tbl">
                {["S", "M", "T", "W", "Th", "F", "S"].map((d, i) => (
                  <div key={i} className="cal-dow">{d}</div>
                ))}
                {Array.from({ length: startDow }, (_, i) => (
                  <div key={`p${i}`} className="cal-day out">{prevDim - startDow + 1 + i}</div>
                ))}
                {Array.from({ length: dim }, (_, i) => {
                  const d = i + 1;
                  const ds = `${calY}-${String(calM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const evs = evtMap.get(ds) ?? [];
                  const isToday = ds === todayStr;
                  const isHol = evs.some((e) => e.type === "holiday");
                  const cls = isToday ? "today" : isHol ? "holiday" : "";
                  return (
                    <div key={d} className={`cal-day ${cls}`} title={evs.map((e) => e.title).join(" / ")}>{d}</div>
                  );
                })}
                {Array.from({ length: tail }, (_, i) => (
                  <div key={`t${i}`} className="cal-day out">{i + 1}</div>
                ))}
              </div>
            </div>

            <div className="evt-box">
              <h4>Events Detail</h4>
              {!monthEvts.length && (
                <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>ไม่มีอีเวนต์ในเดือนนี้</div>
              )}
              {monthEvts.map((ev) => {
                const dt = new Date(ev.date);
                return (
                  <div key={ev.id} className="evt-item">
                    <div className={`evt-date ${ev.type}`}>
                      <b>{dt.getDate()}</b><span>{EN_MON_S[dt.getMonth()]}</span>
                    </div>
                    <div className="t">
                      {ev.title}
                      <div className={`tag ${ev.type}`}>
                        ● {ev.type === "holiday" ? "Public Holiday" : "Company Event"}
                      </div>
                    </div>
                    {me.admin && (
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--block)" }}
                        onClick={() => void delEvt(ev.id)}>ลบ</button>
                    )}
                  </div>
                );
              })}
              {me.admin && (
                <button className="btn btn-sm" style={{ marginTop: 6 }}
                  onClick={() => setEditEvt({ type: "event", date: todayStr })}>
                  + เพิ่มอีเวนต์ / วันหยุด
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <IwFoot />

      {/* ---------- อ่านประกาศ ---------- */}
      {openAnn && (
        <Modal open onClose={() => setOpenAnn(null)} title={openAnn.title}
          foot={
            <>
              {me.admin && (
                <button className="btn btn-block btn-sm" style={{ marginRight: "auto" }}
                  onClick={() => void delAnn(openAnn.id)}>ลบประกาศ</button>
              )}
              {me.admin && (
                <button className="btn btn-sm" onClick={() => { setEditAnn(openAnn); setOpenAnn(null); }}>แก้ไข</button>
              )}
              <button className="btn" onClick={() => setOpenAnn(null)}>ปิด</button>
            </>
          }>
          <div style={{ marginBottom: 12 }}>
            <span className="iw-cat">{openAnn.cat}</span>
            <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 10 }}>
              Posted by {openAnn.by} · {new Date(openAnn.ts).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
            {openAnn.body}
          </div>
        </Modal>
      )}

      <AnnModal a={editAnn} close={() => setEditAnn(null)} onDone={reload} />
      <EvtModal e={editEvt} close={() => setEditEvt(null)} onDone={reload} />
    </div>
  );
}

/* ---------------- CRUD ประกาศ ---------------- */
function AnnModal({ a, close, onDone }: { a: Partial<Ann> | null; close: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Ann>>({});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = a ? (a.id ?? "__new__") : null;
  if (key !== lastKey) { setLastKey(key); if (a) setF({ ...a }); }
  if (!a) return null;

  async function save() {
    if (!f.title?.trim() || !f.body?.trim()) { setErr("ใส่หัวข้อและเนื้อหาก่อน"); return; }
    setBusy(true); setErr("");
    try {
      await api("/api/announcements", "POST", f);
      await onDone();
      toast("โพสต์ประกาศแล้ว", "ok");
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={close} title={f.id ? "แก้ไขประกาศ" : "+ เพิ่มประกาศ"} wide
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังโพสต์…" : "โพสต์"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      <Field label="หัวข้อ *">
        <input value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
      </Field>
      <Field label="หมวด">
        <select value={f.cat ?? "ประกาศบริษัท"} onChange={(e) => setF({ ...f, cat: e.target.value })}>
          {ANN_CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="เนื้อหา *">
        <textarea rows={5} value={f.body ?? ""} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </Field>
    </Modal>
  );
}

/* ---------------- CRUD อีเวนต์ ---------------- */
function EvtModal({ e, close, onDone }: { e: Partial<Evt> | null; close: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Evt>>({});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = e ? (e.id ?? "__new__") : null;
  if (key !== lastKey) { setLastKey(key); if (e) setF({ ...e }); }
  if (!e) return null;

  async function save() {
    if (!f.date || !f.title?.trim()) { setErr("ใส่วันที่และชื่อก่อน"); return; }
    setBusy(true); setErr("");
    try {
      await api("/api/events", "POST", f);
      await onDone();
      toast("เพิ่มอีเวนต์แล้ว", "ok");
      close();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={close} title="+ เพิ่มอีเวนต์ / วันหยุด"
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>เพิ่ม</button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      <div className="grid2">
        <Field label="วันที่ *">
          <input type="date" value={f.date ?? ""} onChange={(e2) => setF({ ...f, date: e2.target.value })} />
        </Field>
        <Field label="ประเภท">
          <select value={f.type ?? "event"} onChange={(e2) => setF({ ...f, type: e2.target.value })}>
            <option value="event">Company Event</option>
            <option value="holiday">Public Holiday</option>
          </select>
        </Field>
      </div>
      <Field label="ชื่ออีเวนต์ *">
        <input value={f.title ?? ""} onChange={(e2) => setF({ ...f, title: e2.target.value })} autoFocus />
      </Field>
    </Modal>
  );
}
