export type NavItem = { href: string; label: string; perm: string; ic: string };
export type NavGroup = { label: string; items: NavItem[] };
export type ModuleDef = {
  key: string;
  name: string;
  th: string;
  desc: string;
  perm: string;          // สิทธิ์ที่ต้องมีถึงจะเห็นโมดูลนี้
  groups: NavGroup[];
};

/** 4 โมดูลแยกกันชัดเจน — sidebar เปลี่ยนตามโมดูลที่เข้า ไม่ยำรวมกัน */
export const MODULES: ModuleDef[] = [
  {
    key: "tracker",
    name: "Production Tracker",
    th: "ติดตามการผลิต",
    desc: "ติดตามโปรเจกต์ตั้งแต่รับบรีฟลูกค้า คิดสูตร ขึ้นทะเบียน จนถึงโรงงานผลิตเสร็จ พร้อมคลังวัตถุดิบและ BOM",
    perm: "dashboard",
    groups: [
      {
        label: "ภาพรวม",
        items: [
          { href: "/dashboard", label: "Dashboard", perm: "dashboard", ic: "▦" },
          { href: "/projects", label: "โปรเจกต์", perm: "projects", ic: "▤" },
          { href: "/board", label: "บอร์ดทีม", perm: "board", ic: "▥" },
          { href: "/production", label: "การผลิต", perm: "production", ic: "🏭" },
          { href: "/plant", label: "ไลน์ผลิต / Plant", perm: "plant", ic: "⚙" },
          { href: "/aging", label: "งานดอง / SLA", perm: "aging", ic: "⏱" },
        ],
      },
      {
        label: "คลังสินค้า",
        items: [
          { href: "/stock", label: "สต็อก", perm: "stock", ic: "▣" },
          { href: "/lots", label: "ล็อต / วันหมดอายุ", perm: "stock", ic: "◫" },
          { href: "/recall", label: "Recall Trace", perm: "stock", ic: "🔍" },
        ],
      },
      {
        label: "ภาพรวมทั้งสาย",
        items: [
          { href: "/summary", label: "สรุปทั้ง Flow", perm: "summary", ic: "◎" },
          { href: "/report", label: "Lead Time + คอขวด", perm: "report", ic: "▮" },
        ],
      },
      {
        label: "ตั้งค่า",
        items: [
          { href: "/setup", label: "ตั้งค่า Tracker", perm: "setup", ic: "⚙" },
        ],
      },
    ],
  },
  {
    key: "ticket",
    name: "Ticket & Assignment",
    th: "งานมอบหมาย",
    desc: "มอบหมายงานข้ามแผนก ติดตามสถานะ แนบไฟล์ คอมเมนต์ และปิดงาน",
    perm: "tickets",
    groups: [{ label: "งานมอบหมาย", items: [{ href: "/tickets", label: "Tickets", perm: "tickets", ic: "✎" }] }],
  },
  {
    key: "exec",
    name: "Executive",
    th: "ผู้บริหาร",
    desc: "ภาพรวมผู้บริหาร — คอขวดต่อทีม โปรเจกต์ล่าช้า OEE ไลน์ผลิต มูลค่าสต็อก",
    perm: "exec",
    groups: [{ label: "ผู้บริหาร", items: [{ href: "/exec", label: "ภาพรวมผู้บริหาร", perm: "exec", ic: "◑" }] }],
  },
  {
    key: "kpi",
    name: "KPI Dashboard",
    th: "ตัวชี้วัด",
    desc: "ตัวชี้วัดรายเดือน · เทียบเป้า ผ่าน/ตก · ดึงค่าอัตโนมัติจากโมดูลอื่น (OTIF / OEE / Ticket / SLA)",
    perm: "kpi",
    groups: [{ label: "KPI Dashboard", items: [{ href: "/kpi", label: "KPI รายเดือน", perm: "kpi", ic: "◎" }] }],
  },
  {
    key: "system",
    name: "System Settings",
    th: "ตั้งค่าระบบ",
    desc: "ผู้ใช้ & สิทธิ์ · การแจ้งเตือน · Audit Log · ล้างข้อมูล — เฉพาะ Admin",
    perm: "__admin__",   // ล็อก Admin เท่านั้น (perm setup = ตั้งค่า Tracker ซึ่งคนละเรื่อง)
    groups: [{ label: "ระบบ", items: [{ href: "/settings", label: "ผู้ใช้ · แจ้งเตือน · Audit", perm: "__admin__", ic: "⚒" }] }],
  },
];

/** path นี้อยู่โมดูลไหน */
export function moduleOf(pathname: string): ModuleDef | null {
  for (const m of MODULES) {
    for (const g of m.groups) {
      if (g.items.some((i) => pathname.startsWith(i.href))) return m;
    }
  }
  return null;
}

export const PAGE_META: Record<string, { title: string; sub: string }> = {
  "/dashboard": { title: "Dashboard", sub: "ภาพรวมงานที่กำลังวิ่ง · งานค้าง · สต็อกต่ำ" },
  "/projects": { title: "โปรเจกต์", sub: "ทุกโปรเจกต์ในระบบ · ความคืบหน้า · ETA เทียบกำหนดส่ง" },
  "/board": { title: "บอร์ดทีม", sub: "งานค้างอยู่ที่ทีมไหน · ใครเป็นคอขวด" },
  "/lots": { title: "ล็อต / Batch", sub: "GMP traceability · FEFO · วันหมดอายุ · QC · COA" },
  "/recall": { title: "Recall Trace", sub: "ล็อตนี้ไปอยู่ในงานไหนบ้าง — สืบย้อนตอนลูกค้าร้องเรียน" },
  "/stock": { title: "สต็อก", sub: "คงเหลือจริง / จอง / ใช้ได้ · Safety เทียบยอดใช้ได้" },
  "/plant": { title: "ไลน์ผลิต / OEE", sub: "Availability × Performance × Quality · เกณฑ์ผ่าน 75%" },
  "/production": { title: "การผลิต", sub: "Production Monitor · โรงงานกำลังผลิตอะไร เหลือกี่วัน" },
  "/aging": { title: "งานดอง / SLA", sub: "ขั้นที่ค้างเกิน lead time · เรียงตามค้างนานสุด" },
  "/summary": { title: "สรุปทั้ง Flow", sub: "Funnel ตลอดสาย · Dev → PO → ผลิต" },
  "/report": { title: "Lead Time + คอขวด", sub: "เวลาเฉลี่ยจริง vs มาตรฐาน · หาคอขวดของสาย" },
  "/setup": { title: "ตั้งค่า Tracker", sub: "Lead time · Workflow · ลูกค้า · ประเภทสินค้า · Stock Master · ไลน์ผลิต" },
  "/kpi": { title: "KPI Dashboard", sub: "ตัวชี้วัดรายเดือน · เทียบเป้า ผ่าน/ตก · ดึงค่าจากโมดูลอื่นอัตโนมัติ" },
  "/tickets": { title: "Ticket & Assignment", sub: "งานมอบหมายข้ามแผนก" },
  "/exec": { title: "Executive", sub: "ภาพรวมผู้บริหาร" },
  "/settings": { title: "System Settings", sub: "ผู้ใช้ & สิทธิ์ · แผนก & อีเมลทีม" },
};
