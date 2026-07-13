export const n = (v: unknown) => Number(v ?? 0) || 0;
export const money = (v: unknown) => n(v).toLocaleString("th-TH", { maximumFractionDigits: 2 });
export const today = () => new Date().toISOString().slice(0, 10);

export function daysBetween(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function cls(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/** คลาสสีทีม — ตรงกับ .t-sale / .t-prod / … ใน globals.css (ของเดิมเป๊ะ) */
export const TEAM_CLS: Record<string, string> = {
  Sale: "t-sale", Production: "t-prod", Purchasing: "t-pur", RD: "t-rd",
  RA: "t-ra", Graphic: "t-graphic", Planning: "t-plan", Plant: "t-plant",
};

/** pill สถานะ — s-done / s-run / s-wait / s-block / s-gate / s-ready / s-prod / s-skip */
/** ความสำคัญ — ของเดิมมี 3 ระดับ: ปกติ / ด่วน / ด่วนมาก (ไม่มี "ต่ำ") */
export const PRIORITIES = ["ปกติ", "ด่วน", "ด่วนมาก"] as const;

/** tkPriChip เดิม: ด่วนมาก=แดง · ด่วน=ส้ม · ปกติ=เทา */
export const PRI_AGE: Record<string, string> = {
  "ด่วนมาก": "age-late", "ด่วน": "age-warn", "ปกติ": "age-ok",
};
export const PRIORITY_PILL: Record<string, string> = {
  "ด่วนมาก": "block", "ด่วน": "ready", "ปกติ": "wait",
};
export const PHASE_PILL: Record<string, string> = {
  dev: "run", prod: "prod", done: "done",
};
export const PHASE_TH: Record<string, string> = {
  dev: "พัฒนา", prod: "ผลิต", done: "เสร็จสิ้น",
};
export const TICKET_PILL: Record<string, string> = {
  open: "wait", doing: "run", done: "done", cancelled: "skip",
};

/** แถบวันครบกำหนด: เขียว / ส้ม / แดง */
export function dueCls(due: string | null): string {
  if (!due) return "";
  const d = daysBetween(today(), due);
  return d < 0 ? "due-late" : d <= 7 ? "due-warn" : "due-ok";
}

export const TH_MONTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
export const TH_MONTH_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

/** ประเภทงาน — New / Repeat / ปรับสูตร */
export const KIND_TH: Record<string, string> = {
  new: "งานใหม่", repeat: "ผลิตซ้ำ", reformulate: "ปรับสูตร",
};
export const KIND_PILL: Record<string, string> = {
  new: "gate",        // ม่วง — งานใหม่ ต้องวิ่งครบทุกขั้น
  repeat: "prod",     // เขียวน้ำทะเล — สูตรเดิม ตรงเข้าผลิต
  reformulate: "ready", // ทอง — ของเดิมแต่ต้องแก้สูตร
};
export const KIND_DESC: Record<string, string> = {
  new: "ลูกค้าใหม่ / สินค้าใหม่ — วิ่งครบ 14 ขั้นตอน ตั้งแต่เก็บ requirement",
  repeat: "สูตรเดิม ทะเบียนเดิม แค่ผลิตรอบใหม่ — ข้ามเฟสพัฒนา เข้าเฟสผลิตทันที",
  reformulate: "ของเดิมแต่ปรับสูตร — วิ่ง workflow แต่ข้ามขั้นที่ทำไปแล้วได้เอง",
};
