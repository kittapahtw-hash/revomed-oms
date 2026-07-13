import "server-only";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { lotUsage, stockItems, stockLots, stockMoves } from "@/db/schema";
import { HttpError } from "./auth";
import { today } from "./utils";

/* ============================================================
 * LOT / BATCH — GMP traceability
 *
 * กฎ:
 *  1. รับเข้าต้องระบุล็อต + วันหมดอายุเสมอ (ไม่มีล็อต = ไม่รู้ว่าของมาจากไหน = audit ตก)
 *  2. เบิกออกใช้ FEFO — First Expired First Out (ใกล้หมดอายุใช้ก่อน ไม่ใช่มาก่อนใช้ก่อน)
 *  3. ล็อตหมดอายุ / QC ไม่ผ่าน / กักกัน → เบิกไม่ได้ ระบบบล็อก
 *  4. ตัดของไปผลิต → บันทึกใน lot_usage ว่าโปรเจกต์ไหนใช้ล็อตไหนไปเท่าไหร่
 * ============================================================ */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** ล็อตนี้เบิกได้ไหม */
export function lotBlockedReason(lot: {
  expiry: string | null; qcStatus: string; qty: string | number;
}): string | null {
  if (Number(lot.qty) <= 0) return "ล็อตนี้หมดแล้ว";
  if (lot.qcStatus === "failed") return "QC ไม่ผ่าน — ห้ามใช้";
  if (lot.qcStatus === "quarantine") return "อยู่ระหว่างกักกัน (Quarantine) — รอ QC";
  if (lot.qcStatus === "pending") return "ยังไม่ผ่าน QC — รอตรวจก่อน";
  if (lot.expiry && lot.expiry < today()) return `หมดอายุแล้ว (${lot.expiry})`;
  return null;
}

/** รับวัตถุดิบเข้าคลัง — ต้องมีล็อต */
export async function receiveLot(input: {
  itemId: string; lotNo: string; qty: number;
  expiry: string | null; mfgDate: string | null;
  supplier: string; poNo: string; coaUrl: string; note: string;
  qcStatus: "pending" | "passed" | "quarantine";
  who: string;
}) {
  if (input.qty <= 0) throw new HttpError(400, "จำนวนต้องมากกว่า 0");
  if (!input.lotNo.trim()) throw new HttpError(400, "ต้องระบุเลขล็อต — ไม่มีล็อต = สืบย้อนไม่ได้ อย. ตรวจแล้วตก");
  if (input.expiry && input.expiry < today())
    throw new HttpError(400, `ล็อตนี้หมดอายุไปแล้ว (${input.expiry}) — รับเข้าไม่ได้`);

  return db.transaction(async (tx) => {
    const [it] = await tx.select().from(stockItems)
      .where(eq(stockItems.id, input.itemId)).limit(1).for("update");
    if (!it) throw new HttpError(404, "ไม่พบรายการในคลัง");

    const n = String(input.qty);

    const [lot] = await tx.insert(stockLots).values({
      itemId: input.itemId, lotNo: input.lotNo.trim(),
      qty: n, received: n,
      expiry: input.expiry, mfgDate: input.mfgDate,
      supplier: input.supplier || it.supplier,
      coaUrl: input.coaUrl, poNo: input.poNo,
      qcStatus: input.qcStatus, note: input.note,
    }).returning();

    await tx.update(stockItems)
      .set({ qty: sql`${stockItems.qty} + ${n}` })
      .where(eq(stockItems.id, input.itemId));

    await tx.insert(stockMoves).values({
      itemId: input.itemId, itemName: it.name, dir: "in", qty: n,
      ref: input.poNo, who: input.who, lotNo: input.lotNo,
      note: `รับเข้าล็อต ${input.lotNo}${input.expiry ? ` · หมดอายุ ${input.expiry}` : ""}`,
    });

    return lot;
  });
}

/**
 * เบิกของออกด้วย FEFO — ตัดจากล็อตที่ใกล้หมดอายุก่อน
 * คืนรายการว่าตัดจากล็อตไหนไปเท่าไหร่ (เอาไปบันทึก lot_usage)
 */
export async function pickFEFO(
  tx: Tx,
  itemId: string,
  need: number,
  itemName: string
): Promise<{ lotId: number; lotNo: string; qty: number; expiry: string | null }[]> {
  const lots = await tx
    .select().from(stockLots)
    .where(and(eq(stockLots.itemId, itemId), gt(stockLots.qty, "0")))
    .orderBy(
      // NULL expiry ไปท้ายสุด (ของไม่มีวันหมดอายุ เก็บไว้ใช้ทีหลัง)
      sql`${stockLots.expiry} ASC NULLS LAST`,
      asc(stockLots.receivedAt)
    )
    .for("update");

  const usable = lots.filter((l) => !lotBlockedReason(l));

  const totalUsable = usable.reduce((a, l) => a + Number(l.qty), 0);
  if (totalUsable + 1e-9 < need) {
    const blocked = lots.filter((l) => lotBlockedReason(l));
    const why = blocked.length
      ? ` (มีอีก ${blocked.length} ล็อตที่เบิกไม่ได้: ${blocked.map((l) => `${l.lotNo} — ${lotBlockedReason(l)}`).join(", ")})`
      : "";
    throw new HttpError(400,
      `${itemName}: ล็อตที่เบิกได้มีแค่ ${totalUsable} — ต้องการ ${need}${why}`);
  }

  const picked: { lotId: number; lotNo: string; qty: number; expiry: string | null }[] = [];
  let left = need;

  for (const l of usable) {
    if (left <= 1e-9) break;
    const take = Math.min(left, Number(l.qty));
    await tx.update(stockLots)
      .set({ qty: sql`${stockLots.qty} - ${String(take)}` })
      .where(eq(stockLots.id, l.id));
    picked.push({ lotId: l.id, lotNo: l.lotNo, qty: take, expiry: l.expiry });
    left -= take;
  }

  return picked;
}

/** บันทึกว่าโปรเจกต์นี้ใช้ล็อตไหนไปเท่าไหร่ */
export async function recordUsage(
  tx: Tx,
  picked: { lotId: number; lotNo: string; qty: number }[],
  itemId: string,
  projectId: string | null,
  who: string,
  kind: "issue" | "out" = "issue"
) {
  if (!picked.length) return;
  await tx.insert(lotUsage).values(
    picked.map((p) => ({
      lotId: p.lotId, itemId, lotNo: p.lotNo,
      projectId, qty: String(p.qty), kind, who,
    }))
  );
}

/** คืนของกลับเข้าล็อตเดิม (ยกเลิกงานหลังตัดจริง) */
export async function returnToLots(
  tx: Tx,
  projectId: string,
  itemId: string,
  who: string
) {
  const used = await tx.select().from(lotUsage)
    .where(and(
      eq(lotUsage.projectId, projectId),
      eq(lotUsage.itemId, itemId),
      eq(lotUsage.kind, "issue")
    ));

  for (const u of used) {
    await tx.update(stockLots)
      .set({ qty: sql`${stockLots.qty} + ${u.qty}` })
      .where(eq(stockLots.id, u.lotId));

    await tx.insert(lotUsage).values({
      lotId: u.lotId, itemId, lotNo: u.lotNo,
      projectId, qty: u.qty, kind: "return", who,
    });
  }
  return used.length;
}

/** ล็อตที่ใกล้หมดอายุ / หมดแล้ว */
export async function expiringLots(days = 30) {
  return db.select().from(stockLots)
    .where(and(
      gt(stockLots.qty, "0"),
      sql`${stockLots.expiry} IS NOT NULL`,
      sql`${stockLots.expiry} <= (current_date + ${days} * interval '1 day')`
    ))
    .orderBy(asc(stockLots.expiry));
}
