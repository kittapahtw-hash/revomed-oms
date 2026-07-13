import { describe, expect, it } from "vitest";
import {
  allDone, allPassed, applyStageAction, blankStage, curIdx, nextWaitIdx, runStatusOf, skipsOf,
} from "../stage";
import type { StageState } from "@/db/schema";
import type { Step } from "../types";

const WF: Step[] = [
  { id: 1, team: "Sale", th: "เก็บ requirement", en: "", lead: 2 },
  { id: 2, team: "Production", th: "คิดสูตร", en: "", lead: 5 },
  { id: 3, team: "Sale", th: "ส่งลูกค้าเทสต์", en: "", lead: 7, gate: "ลูกค้าโอเคไหม?" },
  { id: 4, team: "RA", th: "ขึ้นทะเบียน", en: "", lead: 45 },
];
const PROD: Step[] = [
  { id: 101, team: "RD", th: "เตรียมสูตร", en: "", lead: 2 },
  { id: 106, team: "Plant", th: "Production Run", en: "", lead: 14 },
];

const seed = (): StageState[] => {
  const a = WF.map((w) => blankStage(w.id));
  a[0].status = "run";
  a[0].start = "2026-07-01";
  return a;
};

describe("runStatusOf — ขั้นที่เปิดต้องได้สถานะถูกประเภท", () => {
  it("ขั้นธรรมดา = run", () => expect(runStatusOf(WF[0], false)).toBe("run"));
  it("ขั้นที่มี gate = gate (ต้องรอลูกค้าเคาะ)", () => expect(runStatusOf(WF[2], false)).toBe("gate"));
  it("ขั้น 106 ในเฟสผลิต = prodrun", () => expect(runStatusOf(PROD[1], true)).toBe("prodrun"));
  it("ขั้นผลิตอื่น = run", () => expect(runStatusOf(PROD[0], true)).toBe("run"));
});

describe("advance — ปิดขั้นแล้วต้องเลื่อนขั้นถัดไปอัตโนมัติ", () => {
  it("ปิด #1 → #2 เปิดเป็น run + แจ้งทีมถัดไป", () => {
    const r = applyStageAction("advance", seed(), 0, WF, false);
    expect(r.stages[0].status).toBe("done");
    expect(r.stages[0].done).toBeTruthy();
    expect(r.stages[1].status).toBe("run");
    expect(r.stages[1].start).toBeTruthy();
    expect(r.notify?.step.id).toBe(2);
  });

  it("ปิด #2 → #3 เป็น gate (ไม่ใช่ run) เพราะมี gate", () => {
    let a = applyStageAction("advance", seed(), 0, WF, false).stages;
    a = applyStageAction("advance", a, 1, WF, false).stages;
    expect(a[2].status).toBe("gate");
  });

  it("ปิดครบทุกขั้น = finished", () => {
    let a = seed();
    for (let i = 0; i < WF.length; i++) a = applyStageAction("advance", a, i, WF, false).stages;
    expect(allDone(a)).toBe(true);
    expect(applyStageAction("advance", a, 3, WF, false).finished).toBe(true);
  });
});

describe("skip — ข้ามไว้ก่อน ต้องกลับมาทำ", () => {
  it("ข้าม #1 → #2 เปิดต่อ แต่ยังมี pendingSkips ค้าง", () => {
    const r = applyStageAction("skip", seed(), 0, WF, false);
    expect(r.stages[0].status).toBe("skip");
    expect(r.stages[1].status).toBe("run");
    expect(r.pendingSkips).toBe(1);
    expect(r.finished).toBe(false);
  });

  it("ข้ามแล้วปิดขั้นที่เหลือครบ ยังไม่นับว่าเสร็จ (allDone=false, allPassed=true)", () => {
    let a = applyStageAction("skip", seed(), 0, WF, false).stages;
    for (let i = 1; i < WF.length; i++) a = applyStageAction("advance", a, i, WF, false).stages;
    expect(allDone(a)).toBe(false);      // ← จุดสำคัญ: ห้ามปิดโปรเจกต์/เปิด PO
    expect(allPassed(a)).toBe(true);
    expect(skipsOf(a)).toHaveLength(1);
  });

  it("resume ขั้นที่ข้ามไว้ → กลับมา run", () => {
    let a = applyStageAction("skip", seed(), 0, WF, false).stages;
    a = applyStageAction("resume", a, 0, WF, false).stages;
    expect(a[0].status).toBe("run");
  });
});

describe("block / gate", () => {
  it("block → สถานะ block + ยิงเมลแจ้ง", () => {
    const r = applyStageAction("block", seed(), 0, WF, false);
    expect(r.stages[0].status).toBe("block");
    expect(r.notify).toBeTruthy();
  });

  it("unblock ขั้นที่มี gate → กลับไปเป็น gate ไม่ใช่ run", () => {
    let a = applyStageAction("advance", seed(), 0, WF, false).stages;
    a = applyStageAction("advance", a, 1, WF, false).stages;   // #3 = gate
    a = applyStageAction("block", a, 2, WF, false).stages;
    a = applyStageAction("unblock", a, 2, WF, false).stages;
    expect(a[2].status).toBe("gate");
  });

  it("gateOk = ปิดขั้น + เลื่อนต่อ", () => {
    let a = applyStageAction("advance", seed(), 0, WF, false).stages;
    a = applyStageAction("advance", a, 1, WF, false).stages;
    const r = applyStageAction("gateOk", a, 2, WF, false);
    expect(r.stages[2].status).toBe("done");
    expect(r.stages[3].status).toBe("run");
  });

  it("gateReject = ตีกลับเป็น block ไม่เลื่อนต่อ", () => {
    let a = applyStageAction("advance", seed(), 0, WF, false).stages;
    a = applyStageAction("advance", a, 1, WF, false).stages;
    const r = applyStageAction("gateReject", a, 2, WF, false);
    expect(r.stages[2].status).toBe("block");
    expect(r.stages[3].status).toBe("wait");
    expect(r.notify).toBeTruthy();
  });
});

describe("rollback — ย้อนทั้งสาย", () => {
  it("ย้อนมาที่ #1 → #2,#3,#4 reset เป็น wait หมด", () => {
    let a = seed();
    for (let i = 0; i < 3; i++) a = applyStageAction("advance", a, i, WF, false).stages;
    const r = applyStageAction("rollback", a, 0, WF, false);
    expect(r.stages[0].status).toBe("run");
    expect(r.stages.slice(1).every((s) => s.status === "wait")).toBe(true);
    expect(r.stages.slice(1).every((s) => s.done === null)).toBe(true);
  });

  it("rollback ต้องไม่แตะขั้นที่ข้ามไว้", () => {
    let a = applyStageAction("advance", seed(), 0, WF, false).stages;
    a = applyStageAction("skip", a, 1, WF, false).stages;      // #2 ข้ามไว้
    a = applyStageAction("advance", a, 2, WF, false).stages;
    const r = applyStageAction("rollback", a, 0, WF, false);
    expect(r.stages[1].status).toBe("skip");                    // ← ยังข้ามอยู่
  });
});

describe("helpers", () => {
  it("curIdx ข้าม done/skip", () => {
    const a = applyStageAction("advance", seed(), 0, WF, false).stages;
    expect(curIdx(a)).toBe(1);
  });
  it("nextWaitIdx คืน -2 ถ้ามีขั้นที่กำลังทำอยู่แล้ว (ไม่เปิดซ้อน)", () => {
    const a = seed();
    a[1].status = "run";
    expect(nextWaitIdx(a, 0)).toBe(-2);
  });
});
