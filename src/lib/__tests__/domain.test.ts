import { describe, expect, it } from "vitest";
import { oee } from "../domain";
import type { AppData } from "../types";

const rows: AppData["lineOutput"] = [
  { id: 1, date: "2026-07-01", lineId: "L1", projectId: null, qty: 4000, hours: "8", downtime: "1", defect: 100, who: "", note: "" },
  { id: 2, date: "2026-07-02", lineId: "L1", projectId: null, qty: 4500, hours: "8", downtime: "0", defect: 50, who: "", note: "" },
];

describe("OEE = Availability × Performance × Quality", () => {
  it("คำนวณครบ 3 องค์ประกอบ", () => {
    const o = oee(rows, "L1", 5000)!;
    // hours 16, downtime 1 → run 15 → A = 15/16
    expect(o.availability).toBeCloseTo(15 / 16, 4);
    // idealRate = 5000/8 = 625 ชิ้น/ชม. · qty 8500 / (625×15) = 0.906
    expect(o.performance).toBeCloseTo(8500 / (625 * 15), 4);
    // Q = (8500-150)/8500
    expect(o.quality).toBeCloseTo(8350 / 8500, 4);
    expect(o.oee).toBeCloseTo(o.availability * o.performance * o.quality, 6);
  });

  it("Performance cap ที่ 1.5 ไม่ใช่ 1 (ไลน์เดินเกินกำลังได้)", () => {
    const hot: AppData["lineOutput"] = [
      { ...rows[0], qty: 999999, defect: 0, downtime: "0" },
    ];
    expect(oee(hot, "L1", 5000)!.performance).toBe(1.5);
  });

  it("ไม่มีข้อมูล = null (ไม่ใช่ 0 — จะได้ไม่โชว์ 0% หลอกคน)", () => {
    expect(oee([], "L1", 5000)).toBeNull();
    expect(oee(rows, "L9", 5000)).toBeNull();
  });

  it("qty=0 → Quality = 1 (ยังไม่ผลิต ไม่ใช่ของเสีย 100%)", () => {
    const zero: AppData["lineOutput"] = [{ ...rows[0], qty: 0, defect: 0 }];
    expect(oee(zero, "L1", 5000)!.quality).toBe(1);
  });
});
