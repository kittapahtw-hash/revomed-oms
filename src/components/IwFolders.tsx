"use client";
import Link from "next/link";
import { useToast } from "./Toast";
import { DOC_ICO } from "./Intranet";
import type { Folder } from "@/lib/intranet";

/** กริดการ์ดบริการ — คลิกเข้าโฟลเดอร์เอกสาร */
export function IwSvcGrid({ title, arr, base }: { title: string; arr: Folder[]; base: string }) {
  return (
    <>
      <div className="iw-ptitle">{title}</div>
      <div className="iw-svc-grid">
        {arr.map((c) => (
          <Link key={c.key} href={`${base}/${c.key}`} className="iw-svc">
            <h4>{c.title}</h4>
            <div className="d">{c.desc}</div>
            <div className="go">เข้าสู่เมนู →</div>
          </Link>
        ))}
      </div>
    </>
  );
}

/** รายการเอกสารในโฟลเดอร์ */
export function IwDocTable({ c, secTitle, base }: { c: Folder; secTitle: string; base: string }) {
  const toast = useToast();

  function open(f: { name: string; url: string }) {
    if (f.url) window.open(f.url, "_blank");
    else toast(`ยังไม่ได้แนบไฟล์จริง — ใส่ url ของเอกสารนี้ได้ที่ src/lib/intranet.ts`, "gold");
  }

  return (
    <>
      <div className="iw-ptitle">
        <Link href={base} className="crumb">{secTitle}</Link> &gt; {c.title}
      </div>
      <div className="iw-doc-tbl">
        <div className="dt-head"><div>Name</div><div>Date modified</div></div>
        {!c.files.length && (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>ยังไม่มีเอกสารในหมวดนี้</div>
        )}
        {c.files.map((f, i) => (
          <div key={i} className="iw-doc-row" onClick={() => open(f)}>
            <div className="nm">{DOC_ICO} {f.name}</div>
            <div className="dm">{f.date}</div>
          </div>
        ))}
      </div>
    </>
  );
}
