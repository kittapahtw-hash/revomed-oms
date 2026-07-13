"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IwFoot, IwNav } from "@/components/Intranet";
import { Empty, Panel } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { MOCKS } from "@/lib/mocks";

/** UI Preview — โมดูลที่ยังไม่เชื่อมข้อมูลจริง (แทน renderMockModule เดิม) */
function Preview() {
  const params = useSearchParams();
  const toast = useToast();
  const mod = params.get("m") ?? "hr";
  const M = MOCKS[mod];

  const pageKeys = M ? Object.keys(M.pages) : [];
  const [page, setPage] = useState(pageKeys[0] ?? "");

  if (!M) return <Empty icon="✕">ไม่พบโมดูล {mod}</Empty>;

  const P = M.pages[page] ?? M.pages[pageKeys[0]];

  return (
    <>
      <div className="alert-strip" style={{ background: "var(--gate-bg)", borderColor: "#cdb3e3", color: "var(--gate)" }}>
        <span>◔</span>
        <span>
          <b>UI Preview</b> — โมดูล {M.label} เป็นหน้าตัวอย่าง ยังไม่เชื่อมข้อมูลจริง ·
          แจ้งทีมระบบได้ว่าอยากให้เปิดใช้งานจริงตัวไหนก่อน
        </span>
      </div>

      <div className="stk-tabs" style={{ padding: "0 0 14px" }}>
        {pageKeys.map((k) => (
          <button key={k} className={`stk-tab ${page === k ? "active" : ""}`} onClick={() => setPage(k)}>
            {M.pages[k].t}
          </button>
        ))}
      </div>

      {P.type === "table" ? (
        <Panel title={P.t} sub="ข้อมูลตัวอย่าง"
          right={
            <input className="search" placeholder="ค้นหา..."
              onKeyDown={(e) => { if (e.key === "Enter") toast("UI Preview — ค้นหาจริงเมื่อเชื่อมข้อมูล", "gold"); }} />
          }>
          <table>
            <thead><tr>{P.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {P.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} style={j === 0 ? { fontWeight: 600, color: "var(--navy)" } : undefined}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {P.foot && (
            <div style={{ padding: "12px 20px", fontWeight: 700, color: "var(--navy)", borderTop: "1px solid var(--line)" }}>
              {P.foot}
            </div>
          )}
        </Panel>
      ) : (
        <Panel title={P.t} sub="ฟอร์มตัวอย่าง">
          <div style={{ padding: "18px 20px", maxWidth: 560 }}>
            {P.fields.map(([label, kind, opts], i) => (
              <div key={i} className="field">
                <label>{label}</label>
                {kind === "select" ? (
                  <select>{(opts ?? []).map((o) => <option key={o}>{o}</option>)}</select>
                ) : kind === "textarea" ? (
                  <textarea rows={3} />
                ) : (
                  <input type={kind === "number" ? "number" : kind === "date" ? "date" : "text"} />
                )}
              </div>
            ))}
            <button className="btn btn-primary"
              onClick={() => toast(`UI Preview — ${P.btn}ได้จริงเมื่อเชื่อมข้อมูล`, "gold")}>
              {P.btn}
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}

export default function PreviewPage() {
  return (
    <div className="home">
      <IwNav page="preview" />
      <div className="iw-wrap" style={{ minHeight: "calc(100vh - 320px)" }}>
        <Suspense fallback={<div className="empty">กำลังโหลด…</div>}>
          <Preview />
        </Suspense>
      </div>
      <IwFoot />
    </div>
  );
}
