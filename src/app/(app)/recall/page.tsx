"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/lib/store";
import { Empty, Field, Panel, Pill } from "@/components/ui";
import { QC_PILL, QC_TH } from "@/lib/domain";
import { money } from "@/lib/utils";
import type { StockLot } from "@/lib/types";

type Affected = {
  projectId: string; name: string; customer: string;
  qty: number; poNo: string | null; phase: string; usedQty: number;
};
type Res = { lot: StockLot; affected: Affected[] };

function Recall() {
  const { data } = useData();
  const params = useSearchParams();
  const [lotId, setLotId] = useState(params.get("lot") ?? "");
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function trace(id: string) {
    if (!id) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await fetch(`/api/recall?lot=${id}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setRes({ lot: j.lot, affected: j.affected });
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (params.get("lot")) void trace(params.get("lot")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = data?.stock.find((x) => x.id === res?.lot.itemId);
  const totalAffected = res?.affected.reduce((a, x) => a + x.qty, 0) ?? 0;

  return (
    <>
      <div className="alert-strip" style={{ background: "var(--gate-bg)", borderColor: "#cdb3e3", color: "var(--gate)" }}>
        <span>🔍</span>
        <span>
          <b>Recall Trace</b> — ลูกค้าร้องเรียนล็อตไหน เลือกล็อตนั้น ระบบจะบอกว่า
          <b>วัตถุดิบล็อตนี้ไปอยู่ในโปรเจกต์ไหนบ้าง</b> · รีคอลเฉพาะที่ต้องรีคอล ไม่ใช่รีคอลทั้งคลังเพราะสืบไม่ได้
        </span>
      </div>

      <Panel title="เลือกล็อตที่ต้องการสืบย้อน">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "4px 2px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 340 }}>
            <Field label="ล็อตวัตถุดิบ">
              <select value={lotId} onChange={(e) => { setLotId(e.target.value); void trace(e.target.value); }}>
                <option value="">— เลือกล็อต —</option>
                {data?.lots.map((l) => {
                  const it = data.stock.find((x) => x.id === l.itemId);
                  return (
                    <option key={l.id} value={l.id}>
                      {l.lotNo} · {it?.name ?? l.itemId}
                      {l.expiry ? ` · EXP ${l.expiry}` : ""}
                      {` · เหลือ ${Number(l.qty)}`}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
          <Link href="/lots" className="btn">← กลับหน้าล็อต</Link>
        </div>
      </Panel>

      {err && <div className="alert-strip"><span>⚠</span><span>{err}</span></div>}
      {busy && <div className="empty">กำลังสืบย้อน…</div>}

      {res && (
        <>
          <div className="po-banner" style={{ background: "linear-gradient(135deg,#6f3b9c,#8a4fbf)" }}>
            <div><div className="l">เลขล็อต</div><div className="v">{res.lot.lotNo}</div></div>
            <div><div className="l">วัตถุดิบ</div><div className="v" style={{ fontSize: 15 }}>{item?.name ?? res.lot.itemId}</div></div>
            <div><div className="l">รับเข้า</div><div className="v">{money(res.lot.received)} {item?.unit}</div></div>
            <div><div className="l">คงเหลือ</div><div className="v">{money(res.lot.qty)} {item?.unit}</div></div>
            <div><div className="l">วันหมดอายุ</div><div className="v">{res.lot.expiry ?? "—"}</div></div>
            <div><div className="l">ซัพพลายเออร์</div><div className="v" style={{ fontSize: 15 }}>{res.lot.supplier || "—"}</div></div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="l">QC</div>
              <div style={{ marginTop: 4 }}>
                <Pill kind={QC_PILL[res.lot.qcStatus]}>{QC_TH[res.lot.qcStatus]}</Pill>
              </div>
              {res.lot.coaUrl && (
                <a href={res.lot.coaUrl} target="_blank" rel="noreferrer" className="filechip" style={{ marginTop: 6 }}>
                  📄 COA
                </a>
              )}
            </div>
          </div>

          <Panel
            title={`โปรเจกต์ที่ใช้ล็อตนี้ — ${res.affected.length} งาน`}
            sub={res.affected.length
              ? `กระทบสินค้ารวม ${totalAffected.toLocaleString()} ชิ้น — ถ้าต้องรีคอล นี่คือรายการทั้งหมด`
              : "ยังไม่มีโปรเจกต์ไหนใช้ล็อตนี้"}>
            {!res.affected.length ? (
              <Empty icon="✓">
                ล็อตนี้ยังไม่ถูกตัดไปผลิต — ถ้ามีปัญหา แค่กักกัน/ทำลายล็อตนี้ ไม่กระทบงานใคร
              </Empty>
            ) : (
              <>
                <div className="alert-strip">
                  <span>⚠</span>
                  <span>
                    <b>ล็อตนี้ถูกใช้ไปแล้วใน {res.affected.length} โปรเจกต์</b> — รวมสินค้าที่ผลิต{" "}
                    <b>{totalAffected.toLocaleString()} ชิ้น</b> · ถ้าต้องรีคอล ต้องแจ้งลูกค้าตามรายชื่อข้างล่างนี้
                  </span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>รหัส</th><th>โปรเจกต์</th><th>ลูกค้า</th><th>PO</th>
                      <th>เฟส</th>
                      <th style={{ textAlign: "right" }}>ใช้ไปจากล็อตนี้</th>
                      <th style={{ textAlign: "right" }}>ผลิตทั้งหมด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.affected.map((a) => (
                      <tr key={a.projectId} className="clickable">
                        <td><span className="code">{a.projectId}</span></td>
                        <td>
                          <Link href={`/projects/${a.projectId}`} style={{ fontWeight: 700, color: "var(--navy)" }}>
                            {a.name}
                          </Link>
                        </td>
                        <td><b style={{ color: "var(--block)" }}>{a.customer}</b></td>
                        <td>{a.poNo ?? "—"}</td>
                        <td>{a.phase}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {money(a.usedQty)} {item?.unit}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--block)" }}>
                          {a.qty.toLocaleString()} ชิ้น
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="legend">
                  <span>ลูกค้าที่ต้องแจ้ง: <b>{[...new Set(res.affected.map((a) => a.customer))].join(" · ")}</b></span>
                </div>
              </>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

export default function RecallPage() {
  return <Suspense fallback={<div className="empty">กำลังโหลด…</div>}><Recall /></Suspense>;
}
