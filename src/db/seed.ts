import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  announcements, config, customers, departments, events, lines, productTypes,
  productionSteps, projects, stockItems, stockLots, stockMoves, users, workflowSteps,
} from "./schema";

const H = (p: string) => bcrypt.hashSync(p, 10);

/** รหัสตั้งต้น — ผ่านนโยบาย (8 ตัว + ตัวอักษร + ตัวเลข)
 *  ⚠️ เปลี่ยนทันทีหลัง login ครั้งแรก */
const SEED_PW = process.env.SEED_PASSWORD || "Revomed2026";

const DEPTS = [
  { key: "Sale", name: "Sale", th: "ฝ่ายขาย", cls: "t-sale", email: "" },
  { key: "Production", name: "Production", th: "ฝ่ายสูตร/พัฒนา", cls: "t-prod", email: "" },
  { key: "Purchasing", name: "Purchasing", th: "ฝ่ายจัดซื้อ", cls: "t-pur", email: "" },
  { key: "RD", name: "R&D", th: "วิจัยพัฒนา", cls: "t-rd", email: "" },
  { key: "RA", name: "RA", th: "ขึ้นทะเบียน", cls: "t-ra", email: "" },
  { key: "Graphic", name: "Graphic", th: "กราฟฟิก/ออกแบบ", cls: "t-graphic", email: "" },
  { key: "Planning", name: "Planning", th: "วางแผนผลิต", cls: "t-plan", email: "" },
  { key: "Plant", name: "Plant", th: "โรงงานผลิต", cls: "t-plant", email: "" },
];

const WF = [
  { id: 1, team: "Sale", th: "เก็บความต้องการลูกค้า", en: "Collect customer requirements", lead: 2, gate: "", note: "" },
  { id: 2, team: "Production", th: "คิดสูตร (Formulation)", en: "Develop formula", lead: 5, gate: "", note: "" },
  { id: 3, team: "Purchasing", th: "เคาะราคาวัตถุดิบ", en: "Cost / price quotation", lead: 3, gate: "", note: "" },
  { id: 4, team: "Production", th: "รับราคากลับมาสรุปต้นทุน", en: "Receive cost back", lead: 1, gate: "", note: "" },
  { id: 5, team: "Sale", th: "ส่งราคา/สูตรให้ลูกค้า", en: "Send quote to customer", lead: 2, gate: "", note: "" },
  { id: 6, team: "RD", th: "ออกเอกสาร CR", en: "Issue CR document", lead: 3, gate: "", note: "" },
  { id: 7, team: "RD", th: "ออกเอกสาร SS", en: "Issue SS document", lead: 3, gate: "", note: "" },
  { id: 8, team: "Sale", th: "ส่งลูกค้าลองเทสต์ตัวอย่าง", en: "Customer sample test", lead: 7, gate: "ลูกค้าโอเคกับตัวอย่างไหม?", note: "" },
  { id: 9, team: "RD", th: "Stability Testing", en: "Stability testing", lead: 30, gate: "", note: "" },
  { id: 10, team: "RA", th: "ขึ้นทะเบียน + ออกแบบบรรจุภัณฑ์", en: "Registration + packaging spec", lead: 45, gate: "", note: "" },
  { id: 11, team: "Graphic", th: "ออกแบบกราฟฟิกบรรจุภัณฑ์", en: "Graphic / artwork design", lead: 7, gate: "", note: "เริ่มหลัง อย. อนุมัติ" },
  { id: 12, team: "Sale", th: "ส่งแบบให้ลูกค้าตรวจ", en: "Send artwork to customer", lead: 3, gate: "ลูกค้าโอเคกับแบบไหม?", note: "" },
  { id: 13, team: "RA", th: "RA ตรวจสอบแบบอีกรอบ", en: "RA final artwork review", lead: 2, gate: "", note: "" },
  { id: 14, team: "RA", th: "Product Analysis", en: "Product analysis", lead: 5, gate: "", note: "" },
];

const PROD = [
  { id: 101, team: "RD", th: "R&D เตรียมสูตร/เอกสารผลิต", en: "R&D production prep", lead: 2 },
  { id: 102, team: "Planning", th: "Planning ทำ BOM + เช็ค Planning", en: "BOM & capacity planning", lead: 2 },
  { id: 103, team: "Planning", th: "เปิด PR ให้ R&D", en: "Issue PR to R&D", lead: 1 },
  { id: 104, team: "Purchasing", th: "จัดซื้อจัดหาวัตถุดิบ", en: "Purchasing / source materials", lead: 7 },
  { id: 105, team: "Plant", th: "ประสานโรงงาน นัดวันผลิต", en: "Coordinate plant schedule", lead: 2 },
  { id: 106, team: "Plant", th: "โรงงานผลิต (Production Run)", en: "Production run", lead: 14 },
];

const PERM_ALL = { exec: 1, dashboard: 1, projects: 1, board: 1, production: 1, plant: 1, stock: 1, tickets: 1, kpi: 1, aging: 1, summary: 1, report: 1, setup: 1 } as const;

async function main() {
  console.log("seeding…");

  await db.insert(departments).values(DEPTS).onConflictDoNothing();
  await db.insert(workflowSteps).values(WF).onConflictDoNothing();
  await db.insert(productionSteps).values(PROD).onConflictDoNothing();

  await db.insert(users).values([
    { username: "MG624001", password: H(SEED_PW), name: "แบงก์ (Admin)", email: "", admin: true, perms: { ...PERM_ALL } },
    { username: "sale", password: H(SEED_PW), name: "ฝ่ายขาย", email: "", admin: false, perms: { exec: 0, dashboard: 1, projects: 1, board: 1, production: 0, plant: 0, stock: 0, tickets: 1, kpi: 0, aging: 1, summary: 1, report: 0, setup: 0 } },
    { username: "plant", password: H(SEED_PW), name: "โรงงาน", email: "", admin: false, perms: { exec: 0, dashboard: 1, projects: 0, board: 1, production: 1, plant: 1, stock: 1, tickets: 1, kpi: 0, aging: 1, summary: 0, report: 0, setup: 0 } },
  ]).onConflictDoNothing();

  await db.insert(customers).values([
    { id: "C01", name: "Glow Lab Co.,Ltd.", type: "เวชสำอาง", contact: "คุณมิ้น" },
    { id: "C02", name: "VitaPlus Wellness", type: "อาหารเสริม", contact: "คุณบอย" },
    { id: "C03", name: "DermaPro Clinic", type: "เครื่องสำอาง", contact: "หมอเอก" },
    { id: "C04", name: "NutriMax Trading", type: "อาหารเสริม", contact: "คุณแนน" },
  ]).onConflictDoNothing();

  await db.insert(productTypes).values(
    ["เครื่องสำอาง", "อาหารเสริม", "เวชสำอาง", "สกินแคร์", "เครื่องดื่มฟังก์ชัน"].map((name) => ({ name }))
  ).onConflictDoNothing();

  await db.insert(stockItems).values([
    { id: "RM-001", name: "Vitamin C (L-Ascorbic Acid)", type: "RM", unit: "kg", qty: "25", safety: "10", cost: "1850", supplier: "ChemSupply Co." },
    { id: "RM-002", name: "Hyaluronic Acid", type: "RM", unit: "kg", qty: "8", safety: "5", cost: "4200", supplier: "ChemSupply Co." },
    { id: "RM-003", name: "Collagen Peptide", type: "RM", unit: "kg", qty: "120", safety: "50", cost: "950", supplier: "BioIngredient" },
    { id: "RM-004", name: "Glycerin USP", type: "RM", unit: "kg", qty: "300", safety: "100", cost: "85", supplier: "ThaiChem" },
    { id: "PK-001", name: "ขวดปั๊ม 30ml (ใส)", type: "PKG", unit: "ชิ้น", qty: "5000", safety: "2000", cost: "12", supplier: "PackPro" },
    { id: "PK-002", name: "กล่องกระดาษ (พิมพ์ 4 สี)", type: "PKG", unit: "ชิ้น", qty: "3500", safety: "1500", cost: "8", supplier: "PrintHouse" },
    { id: "PK-003", name: "ซองซีล อลูมิเนียม", type: "PKG", unit: "ชิ้น", qty: "900", safety: "1000", cost: "3.5", supplier: "PackPro" },
  ]).onConflictDoNothing();

  await db.insert(lines).values([
    { id: "L1", name: "Line 1 — Filling (Liquid)", capacity: 5000, note: "เซรั่ม/โลชั่น" },
    { id: "L2", name: "Line 2 — Filling (Cream)", capacity: 3500, note: "ครีม/เจล" },
    { id: "L3", name: "Line 3 — Packing", capacity: 8000, note: "แพ็คกล่อง/ซีล" },
  ]).onConflictDoNothing();

  await db.insert(config).values([
    { key: "notifyEmails", value: "" },
    { key: "notifyHour", value: "7" },
  ]).onConflictDoNothing();

  await db.insert(announcements).values([
    { id: "AN-1", title: "เปิดใช้งาน Revomed OMS (Next.js) อย่างเป็นทางการ",
      body: "ย้ายระบบจาก Google Apps Script มาเป็น Next.js + Postgres (Neon) deploy บน Vercel — เร็วขึ้น รองรับผู้ใช้พร้อมกันได้จริง ไม่ติด quota อีกต่อไป ฟีเจอร์เดิมครบทุกอย่าง: สต็อกจอง/ตัดจริง โน้ตต่อขั้นตอน การข้ามขั้นตอน KPI Dashboard และแจ้งเตือนอีเมลรายทีมทุกเช้า",
      cat: "ประกาศบริษัท", by: "Admin", ts: "2026-07-01" },
    { id: "AN-2", title: "เริ่มการประเมินผลการดำเนินงานรอบกลางปี 2569 — ภายในวันที่ 17 ก.ค.",
      body: "วันที่ 9 - 17 ก.ค. 2569 เป็นช่วงการประเมินผลการดำเนินงานประจำรอบกลางปี โดยหัวหน้างานประเมินผ่านระบบ HR ขอให้พนักงานทุกท่านอัปเดตผลงานของตัวเองให้เรียบร้อยก่อนวันปิดระบบ",
      cat: "HR", by: "HR Admin", ts: "2026-06-30" },
    { id: "AN-3", title: "ต้อนรับพนักงานใหม่ประจำเดือนกรกฎาคม ทั้งหมด 5 ท่าน",
      body: "ขอต้อนรับเพื่อนร่วมงานใหม่ 5 ท่าน ประจำแผนก R&D 2 ท่าน, Planning 1 ท่าน และ Plant 2 ท่าน ฝากทุกทีมช่วยดูแลและพาทัวร์ระบบงานด้วยนะคะ",
      cat: "HR", by: "HR Admin", ts: "2026-06-29" },
    { id: "AN-4", title: "Company Outing Q3 — หัวหิน 21-22 ส.ค. ลงชื่อภายใน 31 ก.ค.",
      body: "กิจกรรมท่องเที่ยวประจำไตรมาส 3 ปีนี้ไปหัวหิน 2 วัน 1 คืน บริษัทออกค่าใช้จ่ายทั้งหมด ลงชื่อกับ HR หรือหัวหน้าแผนกภายในสิ้นเดือนกรกฎาคม ที่นั่งจำกัด",
      cat: "กิจกรรม", by: "HR Admin", ts: "2026-06-26" },
    { id: "AN-5", title: "Plant ปิดซ่อมบำรุงใหญ่ Line 2 (Filling — Cream) วันที่ 11 ก.ค. ครึ่งวันเช้า",
      body: "แผนก Plant จะปิด Line 2 เพื่อซ่อมบำรุงประจำปีและสอบเทียบเครื่องบรรจุ ในวันเสาร์ที่ 11 ก.ค. เวลา 08:00-12:00 งานที่วางแผนผลิตช่วงดังกล่าวให้ประสาน Planning เพื่อเลื่อนคิว",
      cat: "แผนก", by: "Plant", ts: "2026-06-25" },
    { id: "AN-6", title: "อัปเดต SOP การเบิก-จ่ายวัตถุดิบ มีผล 15 ก.ค. — ต้องบันทึกผ่าน OMS เท่านั้น",
      body: "ตั้งแต่ 15 ก.ค. เป็นต้นไป การเบิกจ่ายวัตถุดิบและแพ็กเกจจิ้งทุกรายการต้องบันทึกผ่านหน้า Stock ในระบบ OMS (รับเข้า/จ่ายออก) ยกเลิกการจดในสมุดคุมหน้าคลัง เพื่อให้ยอดคงเหลือและ Safety Stock ตรงตามจริง",
      cat: "SOP", by: "Planning", ts: "2026-06-24" },
    { id: "AN-7", title: "อบรม GMP / GHP ประจำปี วันที่ 24 ก.ค. ห้องประชุมใหญ่",
      body: "การอบรมมาตรฐาน GMP/GHP ประจำปีสำหรับพนักงานฝ่ายผลิตและคลังสินค้าทุกท่าน วิทยากรจากหน่วยงานรับรองภายนอก เข้าร่วมได้ 2 รอบ เช้า 09:00 / บ่าย 13:30 แจ้งรอบกับหัวหน้าแผนก",
      cat: "กิจกรรม", by: "HR Admin", ts: "2026-06-22" },
    { id: "AN-8", title: "ตรวจสุขภาพประจำปี 2569 — วันที่ 8 ส.ค. ที่สำนักงานใหญ่",
      body: "ตรวจสุขภาพประจำปีสำหรับพนักงานทุกท่าน โดยทีมแพทย์จากโรงพยาบาลคู่สัญญา งดน้ำงดอาหารหลังเที่ยงคืน รายละเอียดแพ็กเกจตรวจตามอายุงานดูได้ที่บอร์ด HR",
      cat: "อื่นๆ", by: "HR Admin", ts: "2026-06-20" },
  ]).onConflictDoNothing();

  await db.insert(events).values([
    { id: "EV-1", date: "2026-07-11", title: "ปิดซ่อมบำรุง Line 2 (ครึ่งวันเช้า)", type: "event" },
    { id: "EV-2", date: "2026-07-24", title: "อบรม GMP / GHP ประจำปี", type: "event" },
    { id: "EV-3", date: "2026-07-28", title: "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว", type: "holiday" },
    { id: "EV-4", date: "2026-07-29", title: "วันอาสาฬหบูชา", type: "holiday" },
    { id: "EV-5", date: "2026-07-30", title: "วันเข้าพรรษา", type: "holiday" },
    { id: "EV-6", date: "2026-08-08", title: "ตรวจสุขภาพประจำปี 2569", type: "event" },
    { id: "EV-7", date: "2026-08-12", title: "วันแม่แห่งชาติ", type: "holiday" },
    { id: "EV-8", date: "2026-08-21", title: "Company Outing Q3 — หัวหิน (วันแรก)", type: "event" },
    { id: "EV-9", date: "2026-10-13", title: "วันนวมินทรมหาราช", type: "holiday" },
    { id: "EV-10", date: "2026-10-23", title: "วันปิยมหาราช", type: "holiday" },
    { id: "EV-11", date: "2026-12-05", title: "วันพ่อแห่งชาติ / วันชาติ", type: "holiday" },
    { id: "EV-12", date: "2026-12-10", title: "วันรัฐธรรมนูญ", type: "holiday" },
    { id: "EV-13", date: "2026-12-31", title: "วันสิ้นปี", type: "holiday" },
  ]).onConflictDoNothing();

  // ---------- ตัวอย่างโปรเจกต์ 2 ตัว ----------
  const mk = (ids: number[], doneN: number, runIdx: number, isProd = false) =>
    ids.map((sid, i) => ({
      sid,
      status: (i < doneN ? "done" : i === runIdx ? (isProd && sid === 106 ? "prodrun" : "run") : "wait") as
        "done" | "run" | "prodrun" | "wait",
      start: i <= runIdx ? `2026-07-0${Math.min(9, i + 1)}` : null,
      done: i < doneN ? `2026-07-0${Math.min(9, i + 2)}` : null,
      files: [] as { name: string; url: string; by: string; ts: string }[],
      remarks: [] as { ts: string; who: string; text: string }[],
    }));

  await db.insert(projects).values([
    {
      id: "PJ-2026-001", name: "Vita C Serum 30ml", custId: "C01", ptype: "เวชสำอาง", pm: "แบงก์", kind: "new",
      priority: "ด่วน", phase: "dev", dueDate: "2026-09-30", qty: 3000,
      stages: mk(WF.map((w) => w.id), 5, 5), log: [], bom: [], bomState: "",
    },
    {
      id: "PJ-2026-002", name: "Collagen Drink 50ml", custId: "C02", ptype: "อาหารเสริม", pm: "แบงก์", kind: "repeat",
      priority: "ปกติ", phase: "prod", dueDate: "2026-08-15", qty: 5000,
      poNo: "PO-2026-0042", poDate: "2026-07-01",
      stages: WF.map((w) => ({
        sid: w.id, status: "skip" as const, start: "2026-07-01", done: null,
        files: [], remarks: [],
      })),
      prodStages: mk(PROD.map((p) => p.id), 2, 2, true),
      bom: [{ itemId: "RM-003", qtyPerUnit: 0.005 }, { itemId: "PK-003", qtyPerUnit: 1 }],
      bomState: "reserved", log: [],
    },
  ]).onConflictDoNothing();

  // ---------- ล็อตตัวอย่าง (GMP traceability) ----------
  const d = (n: number) => {
    const x = new Date();
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };

  await db.insert(stockLots).values([
    // ของดี ใช้ได้
    { itemId: "RM-001", lotNo: "VC-2601-A", qty: "15", received: "15", expiry: d(400), mfgDate: d(-30), supplier: "ChemSupply Co.", poNo: "PO-2026-0011", qcStatus: "passed" },
    { itemId: "RM-003", lotNo: "CP-2602-B", qty: "80", received: "80", expiry: d(300), mfgDate: d(-45), supplier: "BioIngredient", poNo: "PO-2026-0012", qcStatus: "passed" },
    { itemId: "RM-004", lotNo: "GLY-2601", qty: "300", received: "300", expiry: d(700), supplier: "ThaiChem", qcStatus: "passed" },
    { itemId: "PK-001", lotNo: "BTL-2606", qty: "5000", received: "5000", expiry: null, supplier: "PackPro", qcStatus: "passed" },
    { itemId: "PK-002", lotNo: "BOX-2605", qty: "3500", received: "3500", expiry: null, supplier: "PrintHouse", qcStatus: "passed" },
    { itemId: "PK-003", lotNo: "SCH-2604", qty: "6000", received: "6000", expiry: null, supplier: "PackPro", qcStatus: "passed" },

    // ⏳ ใกล้หมดอายุ — FEFO ต้องหยิบตัวนี้ก่อน
    { itemId: "RM-001", lotNo: "VC-2512-OLD", qty: "10", received: "20", expiry: d(18), mfgDate: d(-330), supplier: "ChemSupply Co.", poNo: "PO-2025-0088", qcStatus: "passed", note: "ล็อตเก่า — ใช้ให้หมดก่อน" },

    // ☠️ หมดอายุแล้ว — ระบบต้องบล็อกไม่ให้เบิก
    { itemId: "RM-003", lotNo: "CP-2501-EXP", qty: "5", received: "50", expiry: d(-12), supplier: "BioIngredient", qcStatus: "passed", note: "หมดอายุ — รอทำลาย" },

    // ⛔ QC ไม่ผ่าน
    { itemId: "RM-002", lotNo: "HA-2607-FAIL", qty: "8", received: "8", expiry: d(500), supplier: "ChemSupply Co.", poNo: "PO-2026-0015", qcStatus: "failed", note: "ค่า pH ไม่ผ่านสเปก — ส่งคืนซัพพลายเออร์" },

    // ⏸ รอ QC
    { itemId: "RM-003", lotNo: "CP-2607-NEW", qty: "40", received: "40", expiry: d(360), supplier: "BioIngredient", poNo: "PO-2026-0021", qcStatus: "pending", note: "เพิ่งรับเข้า รอผลแล็บ" },
  ]).onConflictDoNothing();

  // PJ-2026-002 (5,000 ชิ้น) จอง BOM ไว้ → ตั้งยอด reserved ให้ตรงกับ BOM
  //   RM-003 0.005 kg/ชิ้น × 5,000 = 25 kg | PK-003 1 ชิ้น/ชิ้น × 5,000 = 5,000 ชิ้น
  await db.update(stockItems).set({ qty: "25", reserved: "0" }).where(eq(stockItems.id, "RM-001"));   // 15 + 10
  await db.update(stockItems).set({ qty: "8" }).where(eq(stockItems.id, "RM-002"));                    // ล็อต QC ไม่ผ่าน
  await db.update(stockItems).set({ qty: "125", reserved: "25" }).where(eq(stockItems.id, "RM-003"));  // 80 + 5 + 40
  await db.update(stockItems).set({ qty: "300" }).where(eq(stockItems.id, "RM-004"));
  await db.update(stockItems).set({ qty: "6000", reserved: "5000" }).where(eq(stockItems.id, "PK-003"));
  await db.insert(stockMoves).values([
    { itemId: "RM-003", itemName: "Collagen Peptide", dir: "reserve", qty: "25", ref: "PJ-2026-002", who: "seed", note: "จองสต็อกจาก BOM" },
    { itemId: "PK-003", itemName: "ซองซีล อลูมิเนียม", dir: "reserve", qty: "5000", ref: "PJ-2026-002", who: "seed", note: "จองสต็อกจาก BOM" },
  ]);

  console.log(`✅ seed done — login: MG624001 / ${SEED_PW}  (เปลี่ยนรหัสทันทีหลังเข้าครั้งแรก)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
