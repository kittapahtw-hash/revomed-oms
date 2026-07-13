import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { stockItems, stockMoves, type BomLine } from "@/db/schema";
import { HttpError } from "./auth";
import { pickFEFO, recordUsage, returnToLots } from "./lot";

/**
 * โมเดล Reserve Stock
 *   เปิดโปรเจกต์ + ผูก BOM  → reserve  (จอง ไม่ตัดจริง)
 *   ผลิตเสร็จ               → issue    (ตัดจริง + ปล่อยจอง)
 *   Archive ตอนยังจองอยู่    → release  (ปล่อยจองเฉยๆ)
 *   Archive หลังตัดจริงแล้ว  → return   (รับกลับเข้าคลัง)
 *
 * ⚠️ กฎเหล็ก: ทุกคำสั่งที่แตะยอดสต็อก ต้อง "เช็คกับเขียนในคำสั่งเดียว"
 *    ห้าม SELECT แล้วค่อย UPDATE เด็ดขาด — สองคนกดพร้อมกันแล้วขายเกินสต็อกทันที
 *    (ของเดิมใน Apps Script ใช้ LockService ล็อกทั้งสคริปต์ · ตรงนี้ใช้ transaction + UPDATE…WHERE guard)
 */
export type BomOp = "reserve" | "release" | "issue" | "return";

const OP_NOTE: Record<BomOp, string> = {
  reserve: "จองสต็อกจาก BOM",
  release: "ปล่อยจอง (ยกเลิก/Archive)",
  issue: "ตัดจริงตาม BOM (ผลิตเสร็จ)",
  return: "รับกลับเข้าคลัง (ยกเลิกหลังตัดจริง)",
};

export async function applyBom(
  op: BomOp,
  bom: BomLine[],
  projectQty: number,
  ref: string,
  who: string
) {
  if (!bom.length || projectQty <= 0) return;

  await db.transaction(async (tx) => {
    // ล็อกแถวที่เกี่ยวข้องก่อน (FOR UPDATE) — คนที่มาทีหลังต้องรอ ไม่ใช่อ่านค่าเก่า
    const ids = bom.map((b) => b.itemId);
    const locked = await tx
      .select()
      .from(stockItems)
      .where(inArray(stockItems.id, ids))
      .for("update");

    const byId = new Map(locked.map((i) => [i.id, i]));

    for (const line of bom) {
      const it = byId.get(line.itemId);
      if (!it) throw new HttpError(400, `ไม่พบวัตถุดิบ ${line.itemId} ในคลัง`);

      const need = line.qtyPerUnit * projectQty;
      if (need <= 0) continue;

      const qty = Number(it.qty);
      const reserved = Number(it.reserved);
      const available = qty - reserved;

      if (op === "reserve" && need > available + 1e-9)
        throw new HttpError(400,
          `${it.name}: จองไม่ได้ ต้องการ ${need} ${it.unit} แต่ใช้ได้ ${available} ${it.unit}`);
      if (op === "issue" && need > qty + 1e-9)
        throw new HttpError(400,
          `${it.name}: ตัดจริงไม่ได้ คงเหลือ ${qty} ${it.unit} ต้องการ ${need} ${it.unit}`);

      const n = String(need);
      let lotNote = "";

      if (op === "reserve") {
        await tx.update(stockItems)
          .set({ reserved: sql`${stockItems.reserved} + ${n}` })
          .where(eq(stockItems.id, it.id));

      } else if (op === "release") {
        await tx.update(stockItems)
          .set({ reserved: sql`GREATEST(0, ${stockItems.reserved} - ${n})` })
          .where(eq(stockItems.id, it.id));

      } else if (op === "issue") {
        /* ตัดจริง = ต้องรู้ว่าตัดจาก "ล็อตไหน" — เบิกแบบ FEFO (ใกล้หมดอายุใช้ก่อน)
         * แล้วบันทึก lot_usage ไว้ ไม่งั้นลูกค้าร้องเรียนแล้วสืบย้อนไม่ได้ = รีคอลทั้งคลัง */
        const picked = await pickFEFO(tx, it.id, need, it.name);
        await recordUsage(tx, picked, it.id, ref, who, "issue");
        lotNote = " · ล็อต " + picked.map((p) => `${p.lotNo}×${p.qty}`).join(", ");

        await tx.update(stockItems)
          .set({
            qty: sql`${stockItems.qty} - ${n}`,
            reserved: sql`GREATEST(0, ${stockItems.reserved} - ${n})`,
          })
          .where(eq(stockItems.id, it.id));

      } else {
        // return — คืนกลับ "ล็อตเดิม" ที่ตัดไป ไม่ใช่ยัดเป็นของไร้ล็อต
        const n2 = await returnToLots(tx, ref, it.id, who);
        lotNote = n2 ? ` · คืนกลับ ${n2} ล็อตเดิม` : "";

        await tx.update(stockItems)
          .set({ qty: sql`${stockItems.qty} + ${n}` })
          .where(eq(stockItems.id, it.id));
      }

      await tx.insert(stockMoves).values({
        itemId: it.id, itemName: it.name, dir: op, qty: n,
        ref, who, note: OP_NOTE[op] + lotNote,
      });
    }
  });
}

/** จ่ายออกด้วยมือ (atomic + FEFO)
 *  หมายเหตุ: "รับเข้า" ไม่ผ่านทางนี้แล้ว — ต้องใช้ receiveLot() เพราะต้องระบุล็อต + วันหมดอายุ */
export async function manualMove(
  itemId: string, dir: "in" | "out", qty: number, ref: string, who: string, note: string
) {
  if (qty <= 0) throw new HttpError(400, "จำนวนต้องมากกว่า 0");
  const n = String(qty);

  return db.transaction(async (tx) => {
    const [it] = await tx.select().from(stockItems)
      .where(eq(stockItems.id, itemId)).limit(1).for("update");
    if (!it) throw new HttpError(404, "ไม่พบรายการในคลัง");

    const cur = Number(it.qty);
    const reserved = Number(it.reserved);
    const available = cur - reserved;

    if (dir === "out" && qty > available + 1e-9)
      throw new HttpError(400,
        `จ่ายออกเกินยอดใช้ได้ — ใช้ได้ ${available} ${it.unit} (จองอยู่ ${reserved})`);

    /* UPDATE … WHERE guard: ต่อให้มีใครแทรกเข้ามาระหว่างนี้ เงื่อนไขใน WHERE จะกันให้เอง
     * ถ้า 0 rows = มีคนตัดของไปก่อน → ตีกลับ ไม่ใช่เขียนทับ */
    let lotNote = "";
    if (dir === "out") {
      // จ่ายออกมือ ก็ต้องตัดจากล็อตจริง (FEFO) — ไม่งั้นยอดล็อตกับยอดรวมจะไม่ตรงกัน
      const picked = await pickFEFO(tx, itemId, qty, it.name);
      await recordUsage(tx, picked, itemId, ref || null, who, "out");
      lotNote = " · ล็อต " + picked.map((p) => `${p.lotNo}×${p.qty}`).join(", ");
    }

    const res = await tx.update(stockItems)
      .set({ qty: dir === "in" ? sql`${stockItems.qty} + ${n}` : sql`${stockItems.qty} - ${n}` })
      .where(
        dir === "in"
          ? eq(stockItems.id, itemId)
          : sql`${stockItems.id} = ${itemId} AND (${stockItems.qty} - ${stockItems.reserved}) >= ${n}`
      )
      .returning({ qty: stockItems.qty, reserved: stockItems.reserved });

    if (!res.length)
      throw new HttpError(409, "มีคนตัดของไปพร้อมกัน — ยอดไม่พอแล้ว ลองเช็คยอดใหม่อีกครั้ง");

    await tx.insert(stockMoves).values({
      itemId, itemName: it.name, dir, qty: n, ref, who, note: note + lotNote,
    });

    return { qty: Number(res[0].qty), reserved: Number(res[0].reserved) };
  });
}

/** ย้อนรายการรับเข้า/จ่ายออกที่กรอกผิด (atomic) */
export async function undoMove(moveId: number, who: string) {
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(stockMoves)
      .where(eq(stockMoves.id, moveId)).limit(1);
    if (!m) throw new HttpError(404, "ไม่พบรายการ");
    if (m.dir !== "in" && m.dir !== "out")
      throw new HttpError(400, "ย้อนได้เฉพาะรายการรับเข้า/จ่ายออกที่กรอกมือ — รายการจาก BOM ให้ไปแก้ที่โปรเจกต์");

    const [it] = await tx.select().from(stockItems)
      .where(eq(stockItems.id, m.itemId)).limit(1).for("update");
    if (!it) throw new HttpError(404, "ไม่พบรายการในคลัง");

    const n = m.qty;
    if (m.dir === "in" && Number(it.qty) - Number(n) < Number(it.reserved))
      throw new HttpError(400,
        `ย้อนไม่ได้ — ของถูกใช้/จองไปแล้ว (คงเหลือ ${it.qty}, จองอยู่ ${it.reserved})`);

    await tx.update(stockItems)
      .set({ qty: m.dir === "in" ? sql`${stockItems.qty} - ${n}` : sql`${stockItems.qty} + ${n}` })
      .where(eq(stockItems.id, m.itemId));

    await tx.delete(stockMoves).where(eq(stockMoves.id, moveId));
    await tx.insert(stockMoves).values({
      itemId: m.itemId, itemName: m.itemName,
      dir: m.dir === "in" ? "out" : "in",
      qty: n, ref: m.ref, who,
      note: `ย้อนรายการ ${m.dir === "in" ? "รับเข้า" : "จ่ายออก"} ที่กรอกผิด`,
    });

    return { qty: Number(it.qty) };
  });
}
