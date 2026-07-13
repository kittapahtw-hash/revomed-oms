import {
  pgTable, text, integer, boolean, timestamp, numeric, jsonb, serial, date, index,
} from "drizzle-orm/pg-core";

/* ---------- master data ---------- */
export const departments = pgTable("departments", {
  key: text("key").primaryKey(),          // Sale, Production, ...
  name: text("name").notNull(),
  th: text("th").notNull(),
  cls: text("cls").notNull().default(""), // สีป้ายทีม
  email: text("email").notNull().default(""),
});

export const users = pgTable("users", {
  username: text("username").primaryKey(),
  password: text("password").notNull(),   // bcrypt hash — ไม่ส่งลง client เด็ดขาด
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  admin: boolean("admin").notNull().default(false),
  perms: jsonb("perms").$type<Record<string, 0 | 1>>().notNull().default({}),
  /** bump ทีไร = JWT เก่าทุกใบของคนนี้ใช้ไม่ได้ทันที (ไล่ออก/เปลี่ยนรหัส → เตะออกจากระบบเลย) */
  tokenVersion: integer("token_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** กัน brute-force ล็อกอิน — นับครั้งที่ผิดต่อ username + IP */
export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),          // "user:MG624001" หรือ "ip:1.2.3.4"
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  ok: boolean("ok").notNull().default(false),
}, (t) => [index("attempts_key_ts_idx").on(t.key, t.ts)]);

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default(""),
  contact: text("contact").notNull().default(""),
});

export const productTypes = pgTable("product_types", {
  name: text("name").primaryKey(),
});

/** ขั้นตอน workflow (dev phase) */
export const workflowSteps = pgTable("workflow_steps", {
  id: integer("id").primaryKey(),
  team: text("team").notNull(),
  th: text("th").notNull(),
  en: text("en").notNull().default(""),
  lead: integer("lead").notNull().default(1),   // lead time (วัน)
  gate: text("gate").notNull().default(""),     // คำถาม gate ให้ลูกค้าเคาะ
  note: text("note").notNull().default(""),
});

/** ขั้นตอนการผลิต (production phase) */
export const productionSteps = pgTable("production_steps", {
  id: integer("id").primaryKey(),
  team: text("team").notNull(),
  th: text("th").notNull(),
  en: text("en").notNull().default(""),
  lead: integer("lead").notNull().default(1),
});

export const lines = pgTable("lines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(0), // ชิ้น/วัน
  note: text("note").notNull().default(""),
});

/* ---------- stock (reserve model) ---------- */
export const stockItems = pgTable("stock_items", {
  id: text("id").primaryKey(),            // RM-001 / PK-001
  name: text("name").notNull(),
  type: text("type").notNull().default("RM"), // RM | PKG
  unit: text("unit").notNull().default(""),
  qty: numeric("qty", { precision: 14, scale: 3 }).notNull().default("0"),      // คงเหลือจริง
  reserved: numeric("reserved", { precision: 14, scale: 3 }).notNull().default("0"), // จอง
  safety: numeric("safety", { precision: 14, scale: 3 }).notNull().default("0"),
  cost: numeric("cost", { precision: 14, scale: 2 }).notNull().default("0"),
  supplier: text("supplier").notNull().default(""),
  note: text("note").notNull().default(""),
});
// ใช้ได้ = qty - reserved  (คำนวณตอน query, ไม่เก็บซ้ำ)

/* ---------- LOT / BATCH TRACKING (GMP · อย. traceability) ----------
 * โรงงานเครื่องสำอาง/อาหารเสริม ต้องสืบย้อนได้ว่า "ล็อตวัตถุดิบไหน ไปอยู่ในโปรเจกต์ไหน"
 * ลูกค้าร้องเรียน → คลิกล็อต → เห็นทุกงานที่ใช้ล็อตนั้น → รีคอลเฉพาะที่ต้องรีคอล
 * ไม่ใช่รีคอลทั้งหมดเพราะสืบไม่ได้
 */
export const stockLots = pgTable("stock_lots", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => stockItems.id, { onDelete: "cascade" }),
  lotNo: text("lot_no").notNull(),                    // เลขล็อตจากซัพพลายเออร์
  qty: numeric("qty", { precision: 14, scale: 3 }).notNull().default("0"),        // คงเหลือในล็อตนี้
  received: numeric("received", { precision: 14, scale: 3 }).notNull().default("0"), // รับเข้ามาเท่าไหร่ (ไม่เปลี่ยน)
  expiry: date("expiry"),                             // วันหมดอายุ — null = ไม่มีวันหมดอายุ
  mfgDate: date("mfg_date"),                          // วันผลิตของซัพพลายเออร์
  supplier: text("supplier").notNull().default(""),
  coaUrl: text("coa_url").notNull().default(""),      // ใบ COA (Certificate of Analysis)
  poNo: text("po_no").notNull().default(""),          // PO ที่สั่งซื้อล็อตนี้
  qcStatus: text("qc_status").notNull().default("pending"), // pending | passed | failed | quarantine
  note: text("note").notNull().default(""),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("lots_item_idx").on(t.itemId),
  index("lots_expiry_idx").on(t.expiry),
]);

/** ใครใช้ล็อตไหนไปเท่าไหร่ — หัวใจของ traceability + recall */
export const lotUsage = pgTable("lot_usage", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => stockLots.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),
  lotNo: text("lot_no").notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  qty: numeric("qty", { precision: 14, scale: 3 }).notNull(),
  kind: text("kind").notNull().default("issue"),      // issue = ตัดไปผลิต | return = คืนกลับ | out = จ่ายออกมือ
  who: text("who").notNull().default(""),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("usage_lot_idx").on(t.lotId),
  index("usage_project_idx").on(t.projectId),
]);

export const stockMoves = pgTable("stock_moves", {
  id: serial("id").primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  itemId: text("item_id").notNull().references(() => stockItems.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(),
  dir: text("dir").notNull(),   // in | out | reserve | release | issue | return
  qty: numeric("qty", { precision: 14, scale: 3 }).notNull(),
  ref: text("ref").notNull().default(""),  // project id / PO
  who: text("who").notNull().default(""),
  note: text("note").notNull().default(""),
  lotNo: text("lot_no").notNull().default(""),   // ล็อตที่เกี่ยวข้อง (ว่าง = หลายล็อต ดูที่ lot_usage)
}, (t) => [index("moves_item_idx").on(t.itemId), index("moves_ts_idx").on(t.ts)]);

/* ---------- projects ---------- */
/** สถานะขั้นตอน — ยกจากระบบเดิมทั้งชุด
 *  wait    = รอคิว (ยังไม่ถึง)
 *  run     = กำลังทำ
 *  gate    = รอลูกค้าตัดสินใจ (ขั้นที่มี gate)
 *  prodrun = กำลังเดินไลน์ผลิต (ขั้น 106 เท่านั้น)
 *  done    = เสร็จ
 *  block   = ติดปัญหา
 *  skip    = ข้ามไว้ก่อน (ต้องกลับมาทำก่อนปิดเฟส)
 */
export type StageStatus = "wait" | "run" | "gate" | "prodrun" | "done" | "block" | "skip";

export type StageFile = { name: string; url: string; by: string; ts: string };
export type Remark = { ts: string; who: string; text: string };

export type StageState = {
  sid: number;                 // อ้างถึง workflow_steps.id / production_steps.id
  status: StageStatus;
  start: string | null;        // วันที่เริ่มขั้นนี้
  done: string | null;         // วันที่ปิดขั้นนี้
  files: StageFile[];
  remarks: Remark[];
};

export type LogEntry = { ts: string; who: string; text: string; kind?: string };
export type BomLine = { itemId: string; qtyPerUnit: number };

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),                // PJ-2026-001
  name: text("name").notNull(),
  custId: text("cust_id").references(() => customers.id),
  ptype: text("ptype").notNull().default(""),
  pm: text("pm").notNull().default(""),
  priority: text("priority").notNull().default("ปกติ"), // ปกติ | ด่วน | ด่วนมาก
  kind: text("kind").notNull().default("new"),         // new = งานใหม่ | repeat = ผลิตซ้ำสูตรเดิม | reformulate = ปรับสูตร
  phase: text("phase").notNull().default("dev"),        // dev | prod | done
  poNo: text("po_no"),
  poDate: date("po_date"),
  dueDate: date("due_date"),
  qty: integer("qty").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  bomState: text("bom_state").notNull().default(""),    // "" | reserved | issued | returned
  bom: jsonb("bom").$type<BomLine[]>().notNull().default([]),
  stages: jsonb("stages").$type<StageState[]>().notNull().default([]),
  prodStages: jsonb("prod_stages").$type<StageState[] | null>(),
  log: jsonb("log").$type<LogEntry[]>().notNull().default([]),
  rev: integer("rev").notNull().default(1),   // optimistic lock
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("proj_phase_idx").on(t.phase), index("proj_arch_idx").on(t.archived)]);

/* ---------- production line output (OEE) ---------- */
export const lineOutput = pgTable("line_output", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  lineId: text("line_id").notNull().references(() => lines.id),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  qty: integer("qty").notNull().default(0),
  hours: numeric("hours", { precision: 6, scale: 2 }).notNull().default("0"),
  downtime: numeric("downtime", { precision: 6, scale: 2 }).notNull().default("0"),
  defect: integer("defect").notNull().default(0),
  who: text("who").notNull().default(""),
  note: text("note").notNull().default(""),
});

/* ---------- tickets ---------- */
export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  desc: text("desc").notNull().default(""),
  toTeam: text("to_team").notNull().default(""),
  assignee: text("assignee").notNull().default(""),
  priority: text("priority").notNull().default("ปกติ"),
  status: text("status").notNull().default("open"), // open | doing | done | cancelled
  due: date("due"),
  createdBy: text("created_by").notNull().default(""),
  files: jsonb("files").$type<{ name: string; url: string }[]>().notNull().default([]),
  comments: jsonb("comments").$type<LogEntry[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- KPI Dashboard ----------
 * vals = { "2026-01": 98.06, "2026-02": 95.2 }  ← กรอกมือรายเดือน
 * src  = "manual" | otif | oee | tkOnTime | tkCount | slaStage | stockMoves
 *        ถ้าไม่ใช่ manual = คำนวณสดจากข้อมูลโมดูลอื่น แก้มือไม่ได้
 */
export const kpis = pgTable("kpis", {
  id: text("id").primaryKey(),
  team: text("team").notNull().default(""),
  topic: text("topic").notNull(),                     // ชื่อ KPI
  how: text("how").notNull().default(""),             // วิธีคำนวณ (อธิบายให้คนอ่าน)
  op: text("op").notNull().default(">="),             // >= | <=
  target: numeric("target", { precision: 12, scale: 2 }).notNull().default("0"),
  unit: text("unit").notNull().default("%"),          // % | num
  src: text("src").notNull().default("manual"),
  active: boolean("active").notNull().default(true),  // false = ตัดออก (ยังเก็บไว้)
  ord: integer("ord").notNull().default(0),
  vals: jsonb("vals").$type<Record<string, number>>().notNull().default({}),
});

/* ---------- misc ---------- */
export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  cat: text("cat").notNull().default("อื่นๆ"),
  by: text("by").notNull().default(""),
  ts: date("ts").notNull(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  date: date("date").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("event"), // event | holiday
});

export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  user: text("user").notNull().default(""),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
});

export type Project = typeof projects.$inferSelect;
export type StockItem = typeof stockItems.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type User = typeof users.$inferSelect;
export type Kpi = typeof kpis.$inferSelect;
export type StockLot = typeof stockLots.$inferSelect;
export type LotUsage = typeof lotUsage.$inferSelect;
