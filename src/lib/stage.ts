import type { StageState, StageStatus } from "@/db/schema";
import type { Step } from "./types";

export const blankStage = (sid: number): StageState => ({
  sid, status: "wait", start: null, done: null, files: [], remarks: [],
});

/** ขั้นนี้ควรมีสถานะ "กำลังทำ" แบบไหน — gate? prodrun? หรือ run เฉยๆ */
export function runStatusOf(step: Step, isProd: boolean): StageStatus {
  if (isProd) return step.id === 106 ? "prodrun" : "run";
  return step.gate ? "gate" : "run";
}

/** index ของขั้นที่กำลังทำอยู่ (ข้าม done/skip) */
export function curIdx(arr: StageState[]): number {
  const i = arr.findIndex((s) => s.status !== "done" && s.status !== "skip");
  if (i !== -1) return i;
  const j = arr.findIndex((s) => s.status === "skip");
  return j === -1 ? Math.max(0, arr.length - 1) : j;
}

export const allDone = (arr: StageState[]) => arr.length > 0 && arr.every((s) => s.status === "done");
export const allPassed = (arr: StageState[]) => arr.length > 0 && arr.every((s) => s.status === "done" || s.status === "skip");
export const skipsOf = (arr: StageState[]) => arr.filter((s) => s.status === "skip");

/** หา "ขั้นถัดไปที่ยังรอคิว" — คืน -1 ถ้าไม่มี, -2 ถ้ามีขั้นที่กำลังทำอยู่แล้ว */
export function nextWaitIdx(arr: StageState[], from: number): number {
  for (let j = from + 1; j < arr.length; j++) {
    if (arr[j].status === "wait") return j;
    if (arr[j].status !== "done" && arr[j].status !== "skip") return -2;
  }
  return -1;
}

export type StageAction =
  | "advance"      // ปิดขั้นนี้ → เลื่อนขั้นถัดไปเป็น run/gate/prodrun อัตโนมัติ
  | "skip"         // ข้ามไว้ก่อน → เลื่อนขั้นถัดไปเหมือนกัน
  | "resume"       // กลับมาทำขั้นที่ข้ามไว้
  | "block"        // ติดปัญหา
  | "unblock"      // เคลียร์ปัญหา
  | "rollback"     // ย้อนกลับมาที่ขั้นนี้ — reset ทุกขั้นหลังจากนี้เป็น wait
  | "gateOk"       // ลูกค้าอนุมัติ → เหมือน advance
  | "gateReject";  // ลูกค้าตีกลับ → block

export type StageResult = {
  stages: StageState[];
  log: string;
  /** ขั้นถัดไปที่เพิ่งถูกเปิด — เอาไปส่งเมลแจ้งทีม */
  notify: { step: Step; reason: string } | null;
  /** ปิดครบทุกขั้นแล้ว (ไม่มี skip ค้าง) */
  finished: boolean;
  /** ยังมีขั้นที่ข้ามไว้ค้างอยู่กี่ขั้น */
  pendingSkips: number;
};

const TODAY = () => new Date().toISOString().slice(0, 10);

/**
 * เอนจินเดียวคุมทุก action ของขั้นตอน — ยกตรรกะมาจาก advanceG/skipG/blockG/rollbackG/gateDecision
 * (ของเดิมกระจายอยู่ฝั่ง client ทำให้ 2 คนกดพร้อมกันแล้วข้อมูลเพี้ยน — อันนี้ย้ายมาทำฝั่ง server ทั้งหมด)
 */
export function applyStageAction(
  action: StageAction,
  stages: StageState[],
  idx: number,
  steps: Step[],
  isProd: boolean
): StageResult {
  const arr = stages.map((s) => ({ ...s, files: [...s.files], remarks: [...s.remarks] }));
  const s = arr[idx];
  const w = steps.find((x) => x.id === s.sid);
  if (!w) throw new Error(`ไม่พบขั้นตอน #${s.sid}`);

  const label = isProd ? `ผลิต #${w.id - 100} ${w.th}` : `#${w.id} ${w.th}`;
  let log = "";
  let notify: StageResult["notify"] = null;

  const openNext = (reason: string) => {
    const ni = nextWaitIdx(arr, idx);
    if (ni < 0) return;
    const n = arr[ni];
    const nw = steps.find((x) => x.id === n.sid);
    if (!nw) return;
    n.status = runStatusOf(nw, isProd);
    n.start = TODAY();
    notify = { step: nw, reason };
  };

  switch (action) {
    case "advance":
    case "gateOk":
      s.status = "done";
      s.done = TODAY();
      if (!s.start) s.start = TODAY();
      log = action === "gateOk" ? `ลูกค้าอนุมัติ: ${w.th}` : `ปิดงาน ${label}`;
      openNext("งานส่งต่อถึงทีมคุณ — เริ่มขั้นตอนใหม่");
      break;

    case "skip":
      s.status = "skip";
      if (!s.start) s.start = TODAY();
      log = `ข้ามขั้น ${label} ไว้ก่อน`;
      openNext("งานส่งต่อถึงทีมคุณ (ขั้นก่อนหน้าถูกข้ามไว้)");
      break;

    case "resume":
      s.status = runStatusOf(w, isProd);
      if (!s.start) s.start = TODAY();
      log = `กลับมาทำขั้นที่ข้ามไว้: ${w.th}`;
      break;

    case "block":
      s.status = "block";
      log = `ตั้งเป็นติดปัญหา: ${w.th}`;
      notify = { step: w, reason: "งานติดปัญหา (Blocked) — ต้องเข้าไปเคลียร์" };
      break;

    case "gateReject":
      s.status = "block";
      log = `ลูกค้าไม่อนุมัติ ตีกลับ: ${w.th}`;
      notify = { step: w, reason: "ลูกค้าไม่อนุมัติ — งานถูกตีกลับ" };
      break;

    case "unblock":
      s.status = runStatusOf(w, isProd);
      if (!s.start) s.start = TODAY();
      log = `เคลียร์ปัญหาแล้ว: ${w.th}`;
      break;

    case "rollback":
      // ย้อนทั้งสาย — ทุกขั้นตั้งแต่ตรงนี้ไป reset เป็น wait (ยกเว้นขั้นที่ข้ามไว้ ปล่อยไว้เหมือนเดิม)
      arr.forEach((x, j) => {
        if (j >= idx && x.status !== "skip") {
          x.status = "wait";
          x.done = null;
          if (j > idx) x.start = null;
        }
      });
      s.status = runStatusOf(w, isProd);
      s.start = TODAY();
      log = `ย้อนกลับมาที่: ${w.th}`;
      break;
  }

  return {
    stages: arr,
    log,
    notify,
    finished: allDone(arr),
    pendingSkips: skipsOf(arr).length,
  };
}
