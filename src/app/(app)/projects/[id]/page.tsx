"use client";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { api, useData } from "@/lib/store";
import { Empty, Field, Modal, Panel, Pill, Team } from "@/components/ui";
import { useToast } from "@/components/Toast";
import {
  STATUS_PILL, currentStage, devAllDone, eta, isProdPhase,
  overallPct, projStatus, slaInfo,
} from "@/lib/domain";
import { skipsOf } from "@/lib/stage";
import {
  KIND_PILL, KIND_TH, PRIORITY_PILL, TEAM_CLS, daysBetween, dueCls, money, today,
} from "@/lib/utils";
import type { BomLine, StageState } from "@/db/schema";
import type { AppData, Project, Step } from "@/lib/types";

const BOM_LABEL: Record<string, string> = {
  "": "ยังไม่ผูก BOM", reserved: "จองสต็อกแล้ว", issued: "ตัดสต็อกจริงแล้ว", returned: "คืนสต็อกแล้ว",
};
type Phase = "dev" | "prod";

export default function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, reload } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const [bomOpen, setBomOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [remark, setRemark] = useState<{ phase: Phase; idx: number } | null>(null);
  const [comment, setComment] = useState("");
  const [devOpen, setDevOpen] = useState(false);

  const p = data?.projects.find((x) => x.id === id);
  if (loading || !data) return <div className="empty">กำลังโหลด…</div>;
  if (!p) return <Empty icon="✕">ไม่พบโปรเจกต์ {id}</Empty>;

  const cust = data.customers.find((c) => c.id === p.custId);
  const st = projStatus(p);
  const sla = slaInfo(p, data);
  const e = eta(p, data);
  const etaLate = !!(e && p.dueDate && e > p.dueDate);
  const inProd = isProdPhase(p);
  const readOnly = p.archived;

  const devSkips = skipsOf(p.stages);
  const prodSkips = skipsOf(p.prodStages ?? []);
  const allSkips = devSkips.length + prodSkips.length;

  async function act(phase: Phase, idx: number, action: string) {
    if (!p) return;
    setBusy(true);
    try {
      const r = await api<{ finished: boolean; pendingSkips: number; nextStep: string | null }>(
        `/api/projects/${p.id}/stage`, "POST", { rev: p.rev, phase, idx, action }
      );
      await reload();

      if (r.finished) {
        toast(phase === "prod" ? "ผลิตเสร็จสมบูรณ์ทั้งล็อต — ตัดสต็อกจริงแล้ว" : "Phase 1 ครบ 14 ขั้น — เปิด PO ได้เลย",
          phase === "prod" ? "ok" : "gold");
      } else if (r.pendingSkips && action === "advance") {
        toast(`เหลือขั้นที่ข้ามไว้ ${r.pendingSkips} ขั้น — ต้องกลับมาทำก่อนปิดเฟส`, "gold");
      } else if (r.nextStep) {
        toast(`ส่งต่อ → ${r.nextStep} (แจ้งเมลทีมแล้ว)`, action === "skip" ? "gold" : "ok");
      } else {
        toast(ACT_MSG[action] ?? "บันทึกแล้ว", ACT_TONE[action] ?? "ok");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", "block");
      await reload();
    } finally { setBusy(false); }
  }

  async function patch(body: Record<string, unknown>, msg?: string) {
    if (!p) return;
    setBusy(true);
    try {
      await api(`/api/projects/${p.id}`, "PATCH", { rev: p.rev, ...body });
      await reload();
      if (msg) toast(msg, "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "error", "block");
      await reload();
    } finally { setBusy(false); }
  }

  async function sendComment() {
    if (!comment.trim() || !p) return;
    await api(`/api/projects/${p.id}/comment`, "POST", { text: comment });
    setComment("");
    await reload();
    toast("บันทึกคอมเมนต์แล้ว", "ok");
  }

  const stageProps = { p, data, busy, readOnly, act, setRemark, reload };

  return (
    <>
      <div className="content-head">
        <Link href="/projects" style={{ color: "var(--blue)" }}>โปรเจกต์</Link> › {p.id}
      </div>

      {/* ---------- หัวเรื่อง ---------- */}
      <div className="detail-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="pj-title">{p.name}</div>
          <div className="pj-sub">
            <span className="code">{p.id}</span> · {cust?.name ?? "—"} · {p.ptype || "—"} ·
            {" "}{p.qty.toLocaleString()} ชิ้น · PM {p.pm || "—"}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Pill kind={KIND_PILL[p.kind]}>{KIND_TH[p.kind]}</Pill>
            <Pill kind={STATUS_PILL[st]?.[0] ?? "wait"}>{STATUS_PILL[st]?.[1] ?? st}</Pill>
            <Pill kind={PRIORITY_PILL[p.priority]}>{p.priority}</Pill>
            {p.archived && <Pill kind="skip">Archived</Pill>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setBomOpen(true)}>
            {p.bom.length ? "แก้ไข BOM" : "ผูก BOM / จองสต็อก"}
          </button>
          <button className={readOnly ? "btn btn-gold" : "btn btn-block"} disabled={busy}
            onClick={() => void patch(
              { archived: !p.archived, logText: p.archived ? "กู้คืนโปรเจกต์" : "Archive โปรเจกต์" },
              p.archived ? "กู้คืนแล้ว — จองสต็อกกลับให้เรียบร้อย" : "Archive แล้ว — ปล่อย/คืนสต็อกเรียบร้อย"
            )}>
            {p.archived ? "กู้คืนจากคลัง" : "เก็บเข้าคลัง (Archive)"}
          </button>
        </div>
      </div>

      {/* ---------- แบนเนอร์เตือน ---------- */}
      {sla?.breach && (
        <div className="alert-strip">
          <span>⚠</span>
          <span>
            ขั้น &quot;<b>{sla.step.th}</b>&quot; ค้างมา {sla.age} วัน เกิน lead time ({sla.lead} วัน)
            ไป <b>{sla.over} วัน</b> — ตามด่วน
          </span>
        </div>
      )}
      {allSkips > 0 && (
        <div className="alert-strip" style={{ background: "var(--skip-bg)", borderColor: "#e3cf8e", color: "var(--skip)" }}>
          <span>»</span>
          <span>
            มีขั้นที่ข้ามไว้ <b>{allSkips} ขั้น</b> — ต้องกลับมาทำให้ครบก่อนปิดโปรเจกต์ / เปิด PO
          </span>
        </div>
      )}

      {/* ---------- info ---------- */}
      <div className="info-grid">
        <div className="info">
          <div className="l">กำหนดส่ง</div>
          <div className="v">{p.dueDate ? <span className={`due ${dueCls(p.dueDate)}`}>{p.dueDate}</span> : "—"}</div>
        </div>
        <div className="info">
          <div className="l">คาดการณ์เสร็จ (ETA)</div>
          <div className="v">{e ? <span className={`due ${etaLate ? "due-late" : "due-ok"}`}>{e}</span> : "—"}</div>
        </div>
        <div className="info">
          <div className="l">คืบหน้าทั้ง Flow (20 ขั้น)</div>
          <div className="v">{overallPct(p, data)}%</div>
        </div>
        <div className="info">
          <div className="l">สถานะ BOM</div>
          <div className="v" style={{ fontSize: 14 }}>{BOM_LABEL[p.bomState]}</div>
        </div>
      </div>

      {/* ---------- Gantt ทั้ง 20 ขั้น ---------- */}
      <Gantt p={p} data={data} />

      {/* ================= PHASE 1 ================= */}
      {inProd ? (
        <details className="panel" open={devOpen}
          onToggle={(ev) => setDevOpen((ev.currentTarget as HTMLDetailsElement).open)}>
          <summary style={{ padding: "14px 18px", cursor: "pointer", fontWeight: 700, color: "var(--navy)" }}>
            Phase 1 · พัฒนา ({p.stages.filter((s) => s.status === "done").length}/{p.stages.length} ขั้น)
            {devSkips.length > 0 && (
              <span className="pill s-skip" style={{ marginLeft: 8 }}>
                <span className="dot" />ข้ามไว้ {devSkips.length} ขั้น
              </span>
            )}
            <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 8, fontSize: 12.5 }}>
              — กดเพื่อดูย้อนหลัง / แก้ไข
            </span>
          </summary>
          <div className="panel-body">
            <StageList phase="dev" stages={p.stages} steps={data.workflow} {...stageProps} />
          </div>
        </details>
      ) : (
        <Panel title="Phase 1 · พัฒนา (ก่อนเปิด PO)"
          sub={`${data.workflow.length} ขั้นตอน · เสร็จแล้ว ${p.stages.filter((s) => s.status === "done").length}`}>
          <Legend />
          <StageList phase="dev" stages={p.stages} steps={data.workflow} {...stageProps} />
        </Panel>
      )}

      {/* ================= PHASE 2 ================= */}
      {inProd ? (
        <>
          <div className="po-banner">
            <div><div className="l">PO Number</div><div className="v">{p.poNo || "—"}</div></div>
            <div><div className="l">วันเปิด PO</div><div className="v">{p.poDate ?? "—"}</div></div>
            <div><div className="l">กำหนดเสร็จ</div><div className="v">{p.dueDate ?? "—"}</div></div>
            <div><div className="l">คงเหลือ</div><div className="v">{leftTxt(p.dueDate)}</div></div>
            <div><div className="l">จำนวนผลิต</div><div className="v">{p.qty ? `${p.qty.toLocaleString()} ชิ้น` : "—"}</div></div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="l">คืบหน้าผลิต</div>
              <div className="v">{prodPct(p)}%</div>
              <div className="pbar prodbar" style={{ width: 150, marginTop: 4 }}>
                <span style={{ width: `${prodPct(p)}%` }} />
              </div>
            </div>
          </div>

          <Panel title="Phase 2 · การผลิต (หลังเปิด PO)"
            sub={`${data.production.length} ขั้นตอน · เสร็จแล้ว ${(p.prodStages ?? []).filter((s) => s.status === "done").length}`}>
            <Legend />
            <StageList phase="prod" stages={p.prodStages ?? []} steps={data.production} {...stageProps} />
          </Panel>
        </>
      ) : st === "ready" ? (
        <>
          <div className="phase-sep">เปิด PO ผลิตจริง</div>
          <div className="openpo-box">
            <h4>Phase 1 เสร็จครบ {data.workflow.length} ขั้นแล้ว 🎉</h4>
            <p>
              พร้อมเปิด PO เข้าสู่กระบวนการผลิตจริง
              ({data.production.map((s) => s.th.split(" ")[0]).join(" → ")})
            </p>
            {!readOnly && <button className="btn btn-gold" onClick={() => setPoOpen(true)}>เปิด PO เริ่มผลิต</button>}
          </div>
        </>
      ) : devSkips.length > 0 && p.stages.every((s) => s.status === "done" || s.status === "skip") ? (
        <>
          <div className="phase-sep">เปิด PO ผลิตจริง</div>
          <div className="openpo-box" style={{ background: "var(--skip-bg)", borderColor: "var(--skip)" }}>
            <h4 style={{ color: "var(--skip)" }}>ยังเปิด PO ไม่ได้ — มีขั้นที่ข้ามไว้ {devSkips.length} ขั้น</h4>
            <p>ต้องกลับไปทำขั้นที่ข้ามไว้ให้เสร็จก่อน ถึงจะเปิด PO เข้าสู่การผลิตได้</p>
          </div>
        </>
      ) : (
        <>
          <div className="phase-sep">Phase 2 · การผลิต ({data.production.length} ขั้น)</div>
          <div className="stage locked">
            <div className="rail"><div className="node">–</div></div>
            <div className="body">
              <div className="row1"><h4>รอ Phase 1 เสร็จก่อน</h4></div>
              <div className="meta">
                <span>ต้องทำ Phase 1 ครบ {data.workflow.length} ขั้น แล้วเปิด PO ถึงจะเริ่มผลิตได้</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---------- log + comment ---------- */}
      <Panel title="ประวัติ & คอมเมนต์" sub={`${p.log.length} รายการ`}>
        {!p.log.length ? <Empty icon="≡">ยังไม่มีประวัติ</Empty> : (
          <div className="log">
            {[...p.log].reverse().slice(0, 50).map((l, i) => (
              <div key={i} className="log-item">
                <div className={`log-ic ${LOG_IC[l.kind ?? ""] ?? ""}`}>{LOG_EMOJI[l.kind ?? ""] ?? "•"}</div>
                <div className="log-txt">
                  {l.text}
                  <div className="log-meta">{l.who} · {new Date(l.ts).toLocaleString("th-TH")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="cmt-bar">
            <input value={comment} onChange={(ev) => setComment(ev.target.value)}
              placeholder="เพิ่มคอมเมนต์ในโปรเจกต์นี้…"
              onKeyDown={(ev) => { if (ev.key === "Enter") void sendComment(); }} />
            <button className="btn btn-primary" onClick={() => void sendComment()}>ส่ง</button>
          </div>
        )}
      </Panel>

      <BomModal open={bomOpen} close={() => setBomOpen(false)} projectId={p.id} rev={p.rev}
        bom={p.bom} qty={p.qty} locked={p.bomState === "issued"} onDone={reload} />
      <PoModal open={poOpen} close={() => setPoOpen(false)} p={p} onDone={reload} />
      <RemarkModal target={remark} close={() => setRemark(null)} p={p} data={data} onDone={reload} />
    </>
  );
}

/* ================= ลิสต์ขั้นตอน (ใช้ได้ทั้ง 2 เฟส) ================= */
function StageList({ phase, stages, steps, p, data, busy, readOnly, act, setRemark, reload }: {
  phase: Phase;
  stages: StageState[];
  steps: Step[];
  p: Project;
  data: AppData;
  busy: boolean;
  readOnly: boolean;
  act: (phase: Phase, idx: number, action: string) => Promise<void>;
  setRemark: (v: { phase: Phase; idx: number } | null) => void;
  reload: () => Promise<void>;
}) {
  void data;
  const isProd = phase === "prod";

  if (!stages.length) return <Empty icon="—">ยังไม่มีขั้นตอนในเฟสนี้</Empty>;

  return (
    <div className="pipe">
      {stages.map((s, i) => {
        const m = steps.find((x) => x.id === s.sid);
        if (!m) return null;
        const cls = STAGE_CLS[s.status];
        const canAct = !readOnly && s.status !== "wait";
        return (
          <div key={s.sid} className={`stage ${cls}`}>
            <div className="rail">
              <div className="node">
                {s.status === "done" ? "✓" : s.status === "skip" ? "»" : s.status === "block" ? "!" : i + 1}
              </div>
              {i < stages.length - 1 && <div className="line" />}
            </div>

            <div className="body">
              <div className="row1">
                <h4>{isProd ? `ผลิต #${m.id - 100}` : `#${m.id}`} {m.th}</h4>
                <span className="en">{m.en}</span>
                <Team cls={TEAM_CLS[m.team]}>{m.team}</Team>
                <Pill kind={STATUS_PILL[s.status]?.[0] ?? "wait"}>{STATUS_PILL[s.status]?.[1]}</Pill>
                {m.gate && s.status !== "done" && <span className="gate-flag">🚦 {m.gate}</span>}
              </div>

              <div className="meta">
                <span>Lead time <b>{m.lead}</b> วัน</span>
                {s.start && <span>เริ่ม <b>{s.start}</b></span>}
                {s.done && <span>เสร็จ <b>{s.done}</b>
                  {s.start && <> ({daysBetween(s.start, s.done)} วันจริง)</>}
                </span>}
                {m.note && <span style={{ color: "var(--muted)" }}>{m.note}</span>}
              </div>

              {!!s.files.length && (
                <div className="files">
                  {s.files.map((f) => (
                    <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="filechip"
                      title={`${f.by} · ${new Date(f.ts).toLocaleString("th-TH")}`}>
                      📎 {f.name}
                    </a>
                  ))}
                </div>
              )}

              {!!s.remarks.length && (
                <div className="remarks">
                  {s.remarks.slice(-2).reverse().map((r, j) => (
                    <div key={j} className="remark">
                      <b>{r.who}</b><span className="rts">{new Date(r.ts).toLocaleString("th-TH")}</span>
                      <br />{r.text}
                    </div>
                  ))}
                </div>
              )}

              {canAct && (
                <div className="acts">
                  {s.status === "gate" && (
                    <>
                      <button className="btn btn-sm btn-ok" disabled={busy} onClick={() => void act(phase, i, "gateOk")}>
                        ✓ ลูกค้าโอเค
                      </button>
                      <button className="btn btn-sm btn-block" disabled={busy} onClick={() => void act(phase, i, "gateReject")}>
                        ✕ ลูกค้าตีกลับ
                      </button>
                    </>
                  )}

                  {(s.status === "run" || s.status === "prodrun") && (
                    <>
                      <button className="btn btn-sm btn-ok" disabled={busy} onClick={() => void act(phase, i, "advance")}>
                        ✓ ปิดขั้นตอนนี้
                      </button>
                      <button className="btn btn-sm btn-block" disabled={busy} onClick={() => void act(phase, i, "block")}>
                        ⚠ ติดปัญหา
                      </button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => void act(phase, i, "skip")}>
                        » ข้ามไว้ก่อน
                      </button>
                    </>
                  )}

                  {s.status === "block" && (
                    <button className="btn btn-sm btn-ok" disabled={busy} onClick={() => void act(phase, i, "unblock")}>
                      ✓ เคลียร์ปัญหาแล้ว
                    </button>
                  )}

                  {s.status === "skip" && (
                    <button className="btn btn-sm btn-gold" disabled={busy} onClick={() => void act(phase, i, "resume")}>
                      ↩ กลับมาทำขั้นนี้
                    </button>
                  )}

                  {s.status === "done" && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => void act(phase, i, "rollback")}
                      title="ย้อนกลับมาที่ขั้นนี้ — ขั้นหลังจากนี้จะถูก reset ทั้งหมด">
                      ↺ ย้อนกลับ
                    </button>
                  )}

                  <button className="btn btn-sm" onClick={() => setRemark({ phase, idx: i })}>
                    💬 โน้ต ({s.remarks.length})
                  </button>
                  <AttachBtn pid={p.id} phase={phase} idx={i} onDone={reload} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span>🟢 เสร็จ</span><span>🔵 กำลังทำ</span><span>🟣 รอลูกค้าเคาะ</span>
      <span>🔴 ติดปัญหา</span><span>🟡 ข้ามไว้</span><span>⚪ รอคิว</span>
    </div>
  );
}

const prodPct = (p: Project) => {
  const arr = p.prodStages ?? [];
  return arr.length ? Math.round((arr.filter((s) => s.status === "done").length / arr.length) * 100) : 0;
};
const leftTxt = (due: string | null) => {
  if (!due) return "—";
  const d = daysBetween(today(), due);
  return d < 0 ? `เลย ${-d} วัน` : d === 0 ? "ครบวันนี้" : `${d} วัน`;
};

const STAGE_CLS: Record<string, string> = {
  done: "done", run: "run", prodrun: "prodrun", gate: "gate",
  block: "block", skip: "skipped", wait: "locked",
};
const ACT_MSG: Record<string, string> = {
  block: "ตั้งเป็นติดปัญหาแล้ว — แจ้งเมลทีมแล้ว",
  unblock: "เคลียร์ปัญหาแล้ว",
  resume: "กลับมาทำขั้นนี้แล้ว",
  rollback: "ย้อนกลับแล้ว — ขั้นหลังจากนี้ถูก reset ทั้งหมด",
  gateReject: "ลูกค้าตีกลับ — ตั้งเป็นติดปัญหาแล้ว",
};
const ACT_TONE: Record<string, "ok" | "block" | "gold" | "gate"> = {
  block: "block", gateReject: "block", resume: "gold", rollback: "gold",
};
const LOG_IC: Record<string, string> = {
  comment: "comment", file: "file", block: "block", po: "po",
  advance: "stage", gateOk: "stage", gateReject: "block",
};
const LOG_EMOJI: Record<string, string> = {
  comment: "💬", file: "📎", po: "📄", advance: "✓", skip: "»",
  block: "⚠", gateOk: "🚦", gateReject: "⚠", event: "•",
};

/* ================= Gantt — ทั้ง 20 ขั้น ================= */
function Gantt({ p, data }: { p: Project; data: AppData }) {
  let cursor = new Date();

  const build = (stages: StageState[], steps: Step[], phase: Phase) =>
    stages.map((s) => {
      const m = steps.find((x) => x.id === s.sid);
      if (!m) return null;
      let start: Date, end: Date, kind: string;

      if (s.status === "done" && s.start && s.done) {
        start = new Date(s.start); end = new Date(s.done); kind = "done";
      } else if (s.status === "skip") {
        start = new Date(s.start ?? cursor); end = new Date(start); kind = "skip";
      } else if (s.start && s.status !== "wait") {
        start = new Date(s.start);
        end = new Date(start); end.setDate(end.getDate() + m.lead);
        cursor = new Date(end);
        kind = s.status === "block" ? "block" : "doing";
      } else {
        start = new Date(cursor);
        end = new Date(start); end.setDate(end.getDate() + m.lead);
        cursor = new Date(end);
        kind = "todo";
      }
      return { m, start, end, kind, phase };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

  const devBars = build(p.stages, data.workflow, "dev");
  const prodBars = (p.prodStages ?? []).length
    ? build(p.prodStages ?? [], data.production, "prod")
    : data.production.map((m) => {
        const start = new Date(cursor);
        const end = new Date(start); end.setDate(end.getDate() + m.lead);
        cursor = new Date(end);
        return { m, start, end, kind: "todo", phase: "prod" as Phase };
      });

  const bars = [...devBars, ...prodBars];
  if (!bars.length) return null;

  const min = Math.min(...bars.map((b) => b.start.getTime()));
  const max = Math.max(...bars.map((b) => b.end.getTime()), Date.now());
  const span = Math.max(1, max - min);
  const pos = (d: Date) => ((d.getTime() - min) / span) * 100;
  const nowPct = pos(new Date());
  const duePct = p.dueDate ? pos(new Date(p.dueDate)) : null;
  const etaDate = bars[bars.length - 1].end;
  const etaLate = !!(p.dueDate && etaDate > new Date(p.dueDate));

  return (
    <Panel title={`ไทม์ไลน์ / Gantt — ทั้ง ${bars.length} ขั้น`}
      sub={`คาดการณ์เสร็จทั้ง Flow ${etaDate.toISOString().slice(0, 10)}${etaLate ? " ⚠️ เกินกำหนดส่ง" : ""}`}>
      <div className="gantt">
        {bars.map((b, i) => (
          <div key={`${b.phase}-${b.m.id}`}>
            {i === devBars.length && (
              <div className="phase-sep" style={{ margin: "10px 0 8px" }}>Phase 2 · การผลิต</div>
            )}
            <div className="g-row">
              <span className="g-lab" title={b.m.th}>
                {b.phase === "prod" ? `P${b.m.id - 100}` : `#${b.m.id}`} {b.m.th}
              </span>
              <div className="g-track">
                <div className={`g-bar g-${b.kind}`}
                  style={{ left: `${pos(b.start)}%`, width: `${Math.max(1.2, pos(b.end) - pos(b.start))}%` }}
                  title={`${b.start.toISOString().slice(0, 10)} → ${b.end.toISOString().slice(0, 10)} (${b.m.lead}d)`} />
                <div className="g-now" style={{ left: `${nowPct}%` }} />
                {duePct !== null && duePct >= 0 && duePct <= 100 && (
                  <div className="g-due" style={{ left: `${duePct}%` }} />
                )}
              </div>
              <span className="g-days">{b.m.lead}d</span>
            </div>
          </div>
        ))}
      </div>
      <div className="legend">
        <span>🟩 เสร็จจริง</span><span>🟦 กำลังทำ</span><span>🟥 ติดปัญหา</span><span>⬜ คาดการณ์</span>
        <span><b style={{ color: "var(--cyan)" }}>┃</b> วันนี้</span>
        <span><b style={{ color: "var(--block)" }}>┃</b> กำหนดส่ง</span>
      </div>
    </Panel>
  );
}

/* ================= แนบไฟล์ ================= */
function AttachBtn({ pid, phase, idx, onDone }: {
  pid: string; phase: Phase; idx: number; onDone: () => Promise<void>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("ref", pid);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      await api(`/api/projects/${pid}/attach`, "POST", { phase, idx, name: j.name, url: j.url });
      await onDone();
      toast(`แนบไฟล์ ${j.name} แล้ว`, "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ", "block");
    } finally { setBusy(false); }
  }

  return (
    <>
      <button className="btn btn-sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "กำลังอัปโหลด…" : "📎 แนบไฟล์"}
      </button>
      <input ref={ref} type="file" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
    </>
  );
}

/* ================= โน้ต ================= */
function RemarkModal({ target, close, p, data, onDone }: {
  target: { phase: Phase; idx: number } | null; close: () => void;
  p: Project; data: AppData; onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!target) return null;

  const stages = target.phase === "prod" ? (p.prodStages ?? []) : p.stages;
  const steps = target.phase === "prod" ? data.production : data.workflow;
  const stage = stages[target.idx];
  const step = steps.find((x) => x.id === stage?.sid);
  if (!stage) return null;

  async function save() {
    if (!text.trim()) { toast("พิมพ์โน้ตก่อน", "block"); return; }
    setBusy(true);
    try {
      await api(`/api/projects/${p.id}/remark`, "POST", { phase: target!.phase, idx: target!.idx, text });
      setText("");
      await onDone();
      toast("บันทึกโน้ตแล้ว", "ok");
      close();
    } catch (e) { toast(e instanceof Error ? e.message : "error", "block"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={close} title={`โน้ต / Remark — ${step?.th ?? ""}`}
      foot={<>
        <button className="btn" onClick={close}>ปิด</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>บันทึกโน้ต</button>
      </>}>
      <div style={{ maxHeight: 260, overflow: "auto", marginBottom: 12 }}>
        {!stage.remarks.length ? (
          <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "4px 0 10px" }}>ยังไม่มีโน้ตในขั้นนี้</div>
        ) : [...stage.remarks].reverse().map((r, i) => (
          <div key={i} className="remark" style={{ marginBottom: 6 }}>
            <b>{r.who}</b><span className="rts">{new Date(r.ts).toLocaleString("th-TH")}</span>
            <br />{r.text}
          </div>
        ))}
      </div>
      <Field label="เพิ่มโน้ตใหม่">
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="เช่น รอเอกสารจากลูกค้า / lot วัตถุดิบมีปัญหา ฯลฯ" autoFocus />
      </Field>
    </Modal>
  );
}

/* ================= เปิด PO ================= */
function PoModal({ open, close, p, onDone }: {
  open: boolean; close: () => void; p: Project; onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [f, setF] = useState({
    poNo: p.poNo ?? "", poDate: today(), dueDate: p.dueDate ?? "", qty: p.qty || 1000,
  });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr("");
    try {
      await api(`/api/projects/${p.id}/po`, "POST", { rev: p.rev, ...f });
      await onDone();
      toast("เปิด PO แล้ว — เข้าสู่เฟสการผลิต แจ้งเมลทีมแรกเรียบร้อย", "prod");
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={close} title="เปิด PO — เข้าสู่เฟสการผลิต"
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-gold" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังเปิด PO…" : "▶ เปิด PO"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      <div className="grid2">
        <Field label="เลขที่ PO">
          <input value={f.poNo} onChange={(e) => setF({ ...f, poNo: e.target.value })}
            placeholder="PO-2026-0001" autoFocus />
        </Field>
        <Field label="วันที่ PO">
          <input type="date" value={f.poDate} onChange={(e) => setF({ ...f, poDate: e.target.value })} />
        </Field>
        <Field label="จำนวนสั่งผลิต (ชิ้น)">
          <input type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
        </Field>
        <Field label="กำหนดส่งลูกค้า">
          <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
        ระบบจะสร้างขั้นตอนผลิตให้ครบ · เปิดขั้นแรกทันที · ยิงเมลแจ้งทีมที่รับผิดชอบ
        <br />ถ้ายังมีขั้น Phase 1 ที่ข้ามไว้ค้าง ระบบจะไม่ให้เปิด PO
      </div>
    </Modal>
  );
}

/* ================= BOM ================= */
function BomModal({ open, close, projectId, rev, bom, qty, locked, onDone }: {
  open: boolean; close: () => void; projectId: string; rev: number;
  bom: BomLine[]; qty: number; locked: boolean; onDone: () => Promise<void>;
}) {
  const { data } = useData();
  const toast = useToast();
  const [rows, setRows] = useState<BomLine[]>(bom.length ? bom : [{ itemId: "", qtyPerUnit: 0 }]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr("");
    try {
      await api(`/api/projects/${projectId}`, "PATCH", {
        rev, bom: rows.filter((r) => r.itemId && r.qtyPerUnit > 0),
        logText: "อัปเดต BOM / จองสต็อก",
      });
      await onDone();
      toast("บันทึก BOM + จองสต็อกเรียบร้อย", "prod");
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  const totalCost = rows.reduce((s, r) => {
    const it = data?.stock.find((x) => x.id === r.itemId);
    return s + (it ? Number(it.cost) * r.qtyPerUnit * qty : 0);
  }, 0);

  return (
    <Modal open={open} onClose={close} title="BOM — สูตรวัตถุดิบต่อ 1 ชิ้น" wide
      foot={<>
        <button className="btn" onClick={close}>ปิด</button>
        <button className="btn btn-primary" disabled={busy || locked} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : "บันทึก BOM + จองสต็อก"}
        </button>
      </>}>
      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      {locked && (
        <div className="alert-strip" style={{ background: "var(--gold-bg)", borderColor: "#e3cf8e", color: "#946008" }}>
          <span>🔒</span><span>โปรเจกต์นี้ตัดสต็อกจริงไปแล้ว — แก้ BOM ไม่ได้</span>
        </div>
      )}

      {rows.map((r, i) => {
        const it = data?.stock.find((x) => x.id === r.itemId);
        const need = r.qtyPerUnit * qty;
        const avail = Number(it?.available ?? 0);
        const short = it && need > avail;
        return (
          <div key={i}>
            <div className="bom-row">
              <select value={r.itemId} disabled={locked}
                onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, itemId: e.target.value } : x))}
                style={{ border: "1px solid var(--line-2)", borderRadius: 3, padding: "9px 12px", fontSize: 13.5 }}>
                <option value="">— เลือกวัตถุดิบ —</option>
                {data?.stock.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
              </select>
              <input type="number" step="0.001" value={r.qtyPerUnit} disabled={locked}
                onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, qtyPerUnit: Number(e.target.value) } : x))}
                style={{ border: "1px solid var(--line-2)", borderRadius: 3, padding: "9px 12px", fontSize: 13.5, textAlign: "right" }} />
              <button className="bom-x" disabled={locked} onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</button>
            </div>
            {it && (
              <div style={{ fontSize: 11.5, color: short ? "var(--block)" : "var(--muted)", margin: "-4px 0 10px 2px", fontWeight: short ? 700 : 400 }}>
                ต้องใช้ {need.toLocaleString()} {it.unit} · ใช้ได้ตอนนี้ {avail.toLocaleString()} {it.unit}
                {short && " ⚠️ ไม่พอ — จองไม่ผ่านแน่นอน"}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
        <button className="btn btn-sm" disabled={locked}
          onClick={() => setRows([...rows, { itemId: "", qtyPerUnit: 0 }])}>+ เพิ่มรายการ</button>
        <div style={{ marginLeft: "auto", fontSize: 13 }}>
          ต้นทุนวัตถุดิบรวม ({qty.toLocaleString()} ชิ้น):{" "}
          <b style={{ color: "var(--navy)", fontSize: 16 }}>฿{money(totalCost)}</b>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>
        กดบันทึกแล้วระบบจะ <b>จองสต็อก</b> ทันที (ไม่ตัดจริง) — ตัดจริงตอนปิดขั้นผลิตครบทุกขั้น
        ถ้าวัตถุดิบตัวไหนไม่พอ ระบบจะไม่แตะสักตัว (all-or-nothing)
      </div>
    </Modal>
  );
}
