/* ============================================================
 * เนื้อหา Intranet — ยกจาก Index.html เดิมทั้งชุด
 * แก้หัวข้อ/ลิงก์/รูป/เอกสารได้ที่ไฟล์นี้ไฟล์เดียว
 * (ข่าวดี: เขียน URL ปกติได้แล้ว ไม่ต้อง escape \/\/ เหมือน Apps Script)
 * ============================================================ */

export type HeroSlide = {
  cls: string; tag: string; wm: string; h: string; sub: string;
  img: string; src: string; url: string;
};

export const HERO_SLIDES: HeroSlide[] = [
  {
    cls: "s1", tag: "NEWS · มิ.ย. 2569", wm: "2026",
    h: "REVOMED GROUP โชว์ศักยภาพ Innovation Hub ในงาน Cosmoprof CBE ASEAN 2026",
    sub: "คุณเมย์นำทีมเปิดประสบการณ์ 'Living in Lab' ผลักดันแบรนด์ไทยสู่ตลาดโลก ณ ศูนย์ฯ สิริกิติ์ 24-26 มิ.ย. 2569",
    img: "https://pub-d2271b7e7a9d49f3975373b5a8623442.r2.dev/1-405.jpg",
    src: "Positioning (มิ.ย. 2569)", url: "https://positioningmag.com/pr-news/113928",
  },
  {
    cls: "s2", tag: "NEWS · มิ.ย. 2569", wm: "LAB",
    h: "เปิดตัว 5 Exclusive Formulations พร้อม Timeless Cream และกันแดด SPF50+",
    sub: "รีโว่เมดเปลี่ยนสูตรผลิตภัณฑ์ให้เป็นโอกาสทางธุรกิจ เปิดจองสิทธิ์เพียง 5 แบรนด์ พร้อมโชว์ 8 นวัตกรรมเด่น",
    img: "https://pub-d2271b7e7a9d49f3975373b5a8623442.r2.dev/2-249.jpg",
    src: "Positioning (มิ.ย. 2569)", url: "https://positioningmag.com/pr-news/113928",
  },
  {
    cls: "s3", tag: "STORY · คุณเมย์ วาสนา อินทะแสง", wm: "MAY",
    h: "'มาดามเมนี่' ดร.วาสนา อินทะแสง — จากลูกสาวชาวนา สู่ CEO อาณาจักรพันล้าน",
    sub: "เส้นทางชีวิตคุณเมย์ ผู้พา REVOMED ขึ้น Top 3 โรงงานผลิตความงาม-อาหารเสริมของไทย รายได้กว่า 800 ล้านบาทต่อปี",
    img: "https://www.khaosod.co.th/wpapp/uploads/2025/03/may-01.jpg",
    src: "ข่าวสด (มี.ค. 2568)", url: "https://www.khaosod.co.th/entertainment/news_9682629",
  },
  {
    cls: "s2", tag: "STORY · คุณเมย์ วาสนา อินทะแสง", wm: "CEO",
    h: "เปิดบ้าน 'เมย์ วาสนา' ซีอีโอระดับตัวแม่ ที่ใครๆ ก็อยากขอเป็นเพื่อน",
    sub: "นักปั้นมือทองผู้อยู่เบื้องหลังความสำเร็จของเซเลบและนักธุรกิจดัง แห่ง REVOMED Group และ BENOVA Global",
    img: "https://mpics-cdn.mgronline.com/pics/Images/568000002744501.JPEG",
    src: "ผู้จัดการออนไลน์ (มี.ค. 2568)", url: "https://mgronline.com/entertainment/detail/9680000027213",
  },
];

export type DocFile = { name: string; date: string; url: string };
export type Folder = { key: string; title: string; desc: string; files: DocFile[] };

export const EMP_SERVICES: Folder[] = [
  {
    key: "health", title: "Health Insurance",
    desc: "รายละเอียดเกี่ยวกับสวัสดิการประกันสุขภาพและสิทธิประโยชน์ต่างๆ",
    files: [
      { name: "กรมธรรม์ประกันสุขภาพกลุ่ม ประจำปี 2569", date: "01/06/2026 09:30:00", url: "" },
      { name: "ขั้นตอนการเคลมประกันสุขภาพ และรายชื่อโรงพยาบาลคู่สัญญา", date: "01/06/2026 09:32:00", url: "" },
    ],
  },
  {
    key: "pvd", title: "Provident Fund",
    desc: "ข้อมูลกองทุนสำรองเลี้ยงชีพและแผนการลงทุนต่างๆ",
    files: [
      { name: "ข้อบังคับกองทุนสำรองเลี้ยงชีพ", date: "12/03/2026 14:00:00", url: "" },
      { name: "แบบฟอร์มเปลี่ยนแผนการลงทุน (ยื่นได้ปีละ 2 ครั้ง)", date: "12/03/2026 14:05:00", url: "" },
    ],
  },
  {
    key: "forms", title: "Employee Services Forms",
    desc: "แบบฟอร์มคำขอต่างๆ และช่องทางการเสนอความคิดเห็น",
    files: [
      { name: "แบบฟอร์มใบลา (ลาป่วย / ลากิจ / ลาพักร้อน)", date: "05/01/2026 10:00:00", url: "" },
      { name: "แบบฟอร์มขอหนังสือรับรองเงินเดือน", date: "05/01/2026 10:02:00", url: "" },
      { name: "แบบฟอร์มเบิกสวัสดิการ", date: "05/01/2026 10:04:00", url: "" },
    ],
  },
  {
    key: "benefits", title: "Employee Benefits",
    desc: "คำขอลาพักร้อน การลาป่วย และการขอหยุดงานต่างๆ",
    files: [
      { name: "สวัสดิการพนักงาน ประจำปี 2569", date: "09/04/2026 11:11:12", url: "" },
      { name: "ระเบียบการลาพักร้อนและวันหยุดประจำปี", date: "09/04/2026 11:15:00", url: "" },
    ],
  },
  {
    key: "allowance", title: "Allowance Policy",
    desc: "นโยบายและระเบียบการเบิกค่าใช้จ่ายและสวัสดิการ",
    files: [
      { name: "ระเบียบการเบิกค่าใช้จ่ายเดินทางปฏิบัติงาน", date: "20/02/2026 08:45:00", url: "" },
      { name: "อัตราเบี้ยเลี้ยงการปฏิบัติงานนอกสถานที่", date: "20/02/2026 08:50:00", url: "" },
    ],
  },
];

export const BIZ_RESOURCES: Folder[] = [
  {
    key: "brand", title: "Company Branding Designs",
    desc: "คู่มือการใช้โลโก้ รูปแบบตัวอักษร และเทมเพลตมาตรฐานของบริษัท",
    files: [
      { name: "โลโก้ Revomed (AI / PNG / SVG)", date: "15/01/2026 13:20:00", url: "" },
      { name: "Brand Guideline 2026", date: "15/01/2026 13:25:00", url: "" },
      { name: "เทมเพลตนามบัตร / หัวจดหมาย / สไลด์นำเสนอ", date: "15/01/2026 13:30:00", url: "" },
    ],
  },
  {
    key: "rules", title: "Rules & Regulations",
    desc: "ระเบียบข้อบังคับพนักงาน ข้อตกลงในการทำงาน และจรรยาบรรณธุรกิจ",
    files: [
      { name: "เอกสารแนบท้ายระเบียบข้อบังคับการทำงาน_สวัสดิการประจำปี 2569 เพิ่มเติม", date: "09/04/2026 11:11:12", url: "" },
      { name: "ระเบียบข้อบังคับการทำงาน (Company's Work Rules and Regulations)", date: "26/02/2026 12:15:10", url: "" },
    ],
  },
  {
    key: "sysman", title: "Company System Manual",
    desc: "คู่มือการใช้งานระบบไอที ซอฟต์แวร์ และการรักษาความปลอดภัยข้อมูล",
    files: [
      { name: "คู่มือการใช้งาน Revomed OMS (Next.js)", date: "01/07/2026 09:00:00", url: "" },
      { name: "คู่มือระบบอีเมลและบัญชีผู้ใช้บริษัท", date: "10/02/2026 15:40:00", url: "" },
      { name: "นโยบายความปลอดภัยข้อมูล (IT Security Policy)", date: "10/02/2026 15:45:00", url: "" },
    ],
  },
  {
    key: "sops", title: "Standard Operating Procedures (SOPs)",
    desc: "ขั้นตอนการดำเนินงานมาตรฐาน (Standard Operating Procedures) ของแต่ละแผนก",
    files: [
      { name: "SOP การเบิก-จ่ายวัตถุดิบผ่านระบบ OMS (มีผล 15 ก.ค. 69)", date: "24/06/2026 16:00:00", url: "" },
      { name: "SOP การเปิดโปรเจกต์ใหม่และการผูก BOM", date: "24/06/2026 16:05:00", url: "" },
      { name: "SOP มาตรฐาน GMP / GHP ฝ่ายโรงงาน", date: "11/05/2026 10:30:00", url: "" },
    ],
  },
  {
    key: "contact", title: "Company Contact",
    desc: "ข้อมูลติดต่อและที่อยู่สำคัญของบริษัท",
    files: [
      { name: "เบอร์ติดต่อภายในแต่ละแผนก", date: "03/03/2026 09:10:00", url: "" },
      { name: "แผนที่สำนักงานใหญ่และโรงงาน", date: "03/03/2026 09:12:00", url: "" },
    ],
  },
];

/** Modules dropdown บน navbar — โมดูลจริง + โมดูล mock (UI Preview) */
export type HomeModule = {
  key: string; name: string; active: boolean;
  href?: string; perm?: string; mock?: string; adminOnly?: boolean;
};

export const HOME_MODULES: HomeModule[] = [
  { key: "production", name: "Production Tracker", active: true, href: "/dashboard", perm: "dashboard" },
  { key: "ticket", name: "Ticket & Assignment", active: true, href: "/tickets", perm: "tickets" },
  { key: "exec", name: "Executive Dashboard", active: true, href: "/exec", perm: "exec" },
  { key: "kpi", name: "KPI Dashboard", active: true, href: "/kpi", perm: "kpi" },
  { key: "settings", name: "System Settings", active: true, href: "/settings", adminOnly: true },
  { key: "hr", name: "HR Module", active: true, mock: "hr" },
  { key: "ba", name: "BA Module", active: false },
  { key: "learning", name: "Learning Program", active: true, mock: "lp" },
  { key: "pos", name: "POS", active: true, mock: "pos" },
  { key: "warehouse", name: "Warehouse Module", active: true, mock: "wh" },
  { key: "pas", name: "Performance Assessment System", active: true, mock: "ev" },
  { key: "marketing", name: "Marketing", active: true, mock: "mkt" },
];

export const ANN_CATS = ["ประกาศบริษัท", "กิจกรรม", "HR", "แผนก", "SOP", "อื่นๆ"];

export const EN_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const EN_MON_S = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
