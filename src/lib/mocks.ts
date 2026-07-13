/* ============================================================
 * MOCK MODULES — UI Preview (ยกมาจาก MOCKS ใน Index.html เดิมทั้งก้อน)
 * หน้าตัวอย่างของโมดูลที่ยังไม่เชื่อมข้อมูลจริง
 * ============================================================ */

export type MockPage =
  | { t: string; type: "table"; cols: string[]; rows: string[][]; foot?: string }
  | { t: string; type: "form"; fields: [string, string, string[]?][]; btn: string };

export type MockModule = { label: string; pages: Record<string, MockPage> };

export const MOCKS: Record<string, MockModule> = {
  hr:{label:"HR Module",pages:{
    leave:{t:"Leave List",type:"table",cols:["พนักงาน","แผนก","วันเริ่ม","ถึงวันที่","จำนวนวัน","ประเภทการลา"],rows:[
      ["สมชาย ใจดี","R&D","06 ก.ค. 2569","08 ก.ค. 2569","3 วัน","ลาพักร้อน (Holiday)"],
      ["อรพรรณ มั่นคง","Planning","07 ก.ค. 2569","07 ก.ค. 2569","1 วัน","ลาป่วย (Sick Leave)"],
      ["กิตติ ขยันยิ่ง","Plant","08 ก.ค. 2569","10 ก.ค. 2569","3 วัน","ทำงานนอกสถานที่ (Outside Work)"],
      ["นฤมล เรียบร้อย","RA","09 ก.ค. 2569","09 ก.ค. 2569","0.5 วัน","ลากิจ (ครึ่งวันบ่าย)"],
      ["บอย สายลุย","Sale","11 ก.ค. 2569","11 ก.ค. 2569","1 วัน","ลาพักร้อน (Holiday)"]]},
    dir:{t:"Employee Directory",type:"table",cols:["ชื่อ","แผนก","ตำแหน่ง","อีเมล","เบอร์ภายใน"],rows:[
      ["แบงก์ กิตติภัทร","IT","System Admin","bank@revomed.co.th","101"],
      ["สมชาย ใจดี","R&D","หัวหน้าฝ่ายสูตร","somchai@revomed.co.th","201"],
      ["อรพรรณ มั่นคง","Planning","Planner","orapan@revomed.co.th","301"],
      ["กิตติ ขยันยิ่ง","Plant","หัวหน้าไลน์ผลิต","kitti@revomed.co.th","401"],
      ["นฤมล เรียบร้อย","RA","เจ้าหน้าที่ขึ้นทะเบียน","narumon@revomed.co.th","501"]]},
    ot:{t:"Floating / OT Request",type:"form",fields:[
      ["วันที่","date"],["ประเภทคำขอ","select",["OT วันธรรมดา","OT วันหยุด","วันหยุดชดเชย (Floating)"]],
      ["จำนวนชั่วโมง","number"],["เหตุผล","textarea"]],btn:"ส่งคำขอ"},
    appr:{t:"Approval — คำขอรออนุมัติ",type:"table",cols:["ผู้ขอ","ประเภท","วันที่","รายละเอียด","สถานะ"],rows:[
      ["กิตติ ขยันยิ่ง","OT วันหยุด","13 ก.ค. 2569","เร่งงานล็อต PJ-2406-001 · 6 ชม.","รออนุมัติ"],
      ["อรพรรณ มั่นคง","ลาพักร้อน","20-22 ก.ค. 2569","ลาพักร้อน 3 วัน","รออนุมัติ"],
      ["สมชาย ใจดี","ทำงานนอกสถานที่","15 ก.ค. 2569","พบ supplier วัตถุดิบ","รออนุมัติ"]]}}},
  lp:{label:"Learning Program",pages:{
    list:{t:"Course List",type:"table",cols:["ชื่อคอร์ส","บทเรียน","ประเภท","ผู้เรียน","สถานะ"],rows:[
      ["GMP / GHP Refresher 2569","6 บท","บังคับ (ฝ่ายผลิต)","48 คน","เปิดรับสมัคร"],
      ["การใช้งาน Revomed OMS v0.8","4 บท","บังคับ (ทุกแผนก)","112 คน","เปิดรับสมัคร"],
      ["Excel สำหรับ Planning","8 บท","เลือกเรียน","15 คน","กำลังเรียน"],
      ["กฎหมาย อย. สำหรับเครื่องสำอาง","5 บท","เลือกเรียน (RA/Sale)","22 คน","ปิดรุ่นแล้ว"]]},
    my:{t:"My Courses",type:"table",cols:["คอร์สของฉัน","ความคืบหน้า","คะแนนสอบ","สถานะ"],rows:[
      ["การใช้งาน Revomed OMS v0.8","4 จาก 4 บท","92 คะแนน","ผ่านแล้ว"],
      ["GMP / GHP Refresher 2569","2 จาก 6 บท","—","กำลังเรียน"],
      ["Excel สำหรับ Planning","0 จาก 8 บท","—","ยังไม่เริ่ม"]]},
    book:{t:"Book Course",type:"form",fields:[
      ["เลือกคอร์ส","select",["GMP / GHP Refresher 2569","Excel สำหรับ Planning","กฎหมาย อย."]],
      ["รอบอบรม","select",["24 ก.ค. เช้า (09:00)","24 ก.ค. บ่าย (13:30)","7 ส.ค. เช้า"]],
      ["หมายเหตุ","textarea"]],btn:"จองที่นั่ง"}}},
  pos:{label:"POS",pages:{
    sell:{t:"POS Sell — หน้าขาย",type:"table",cols:["สินค้า","ราคา/ชิ้น","จำนวน","รวม"],rows:[
      ["Serum Vitamin C 20% (30ml)","890 ฿","2","1,780 ฿"],
      ["Collagen Peptide Shot (กล่อง 10)","450 ฿","1","450 ฿"],
      ["Sunscreen SPF50 PA++++","520 ฿","3","1,560 ฿"]],foot:"ยอดรวมบิลนี้ 3,790 ฿ · ชำระ: QR PromptPay"},
    orders:{t:"POS Sell Order — ประวัติบิล",type:"table",cols:["เลขที่บิล","บูธ","รายการ","ยอด","ชำระ","เวลา"],rows:[
      ["POS-680702-014","Siam Paragon","3 รายการ","3,790 ฿","QR","14:22"],
      ["POS-680702-013","Siam Paragon","1 รายการ","890 ฿","เงินสด","13:58"],
      ["POS-680702-012","EmQuartier","5 รายการ","4,120 ฿","บัตรเครดิต","13:41"],
      ["POS-680702-011","Online Live","12 รายการ","9,860 ฿","โอน","12:30"]]},
    booth:{t:"Booth — จุดขาย",type:"table",cols:["บูธ","สถานที่","พนักงานประจำ","สถานะ"],rows:[
      ["BT-01","Siam Paragon ชั้น G","มิ้นท์ / ฝน","เปิดขาย"],
      ["BT-02","EmQuartier ชั้น M","เจน","เปิดขาย"],
      ["BT-03","Online Live (TikTok)","ทีม Digital","ไลฟ์ 19:00"]]}}},
  wh:{label:"Warehouse Module",pages:{
    onhand:{t:"Inventory Onhand (FG)",type:"table",cols:["Item Code","Item Name","FG (A)","FG (B)","Blocked","Total"],rows:[
      ["FG-RV-SER-030","Serum Vitamin C 20% 30ml","4,210","120","35","4,365"],
      ["FG-RV-COL-010","Collagen Peptide Shot กล่อง 10","2,860","0","12","2,872"],
      ["FG-RV-SUN-050","Sunscreen SPF50 50ml","6,540","230","0","6,770"],
      ["FG-RV-HGS-030","Hair Growth Serum 30ml","1,120","45","8","1,173"]]},
    movement:{t:"Stock Movement (FG)",type:"table",cols:["วันที่","Item Code","รายการ","ประเภท","จำนวน","อ้างอิง"],rows:[
      ["02 ก.ค. 2569","FG-RV-SER-030","Serum Vitamin C","รับเข้า (ผลิตเสร็จ)","+1,000","PO-2406-001"],
      ["02 ก.ค. 2569","FG-RV-SUN-050","Sunscreen SPF50","จ่ายออก (ส่งลูกค้า)","-2,400","DO-680702-08"],
      ["01 ก.ค. 2569","FG-RV-COL-010","Collagen Shot","จ่ายออก (POS)","-36","POS-680701"]]},
    demand:{t:"Demand Planning",type:"table",cols:["สินค้า","Forecast เดือนนี้","คงคลัง FG","ต้องผลิตเพิ่ม","สถานะ"],rows:[
      ["Serum Vitamin C 20%","6,000","4,365","1,635","วางแผนแล้ว (PJ-2406-001)"],
      ["Sunscreen SPF50","5,500","6,770","—","เพียงพอ"],
      ["Collagen Shot","4,000","2,872","1,128","รอเปิดโปรเจกต์"]]}}},
  ev:{label:"Performance Assessment",pages:{
    perf:{t:"Performance Review — ประเมินลูกทีม",type:"form",fields:[
      ["พนักงานที่ประเมิน","select",["สมชาย ใจดี (R&D)","อรพรรณ มั่นคง (Planning)","กิตติ ขยันยิ่ง (Plant)"]],
      ["คุณภาพงาน (1-5)","select",["5 ดีเยี่ยม","4 ดี","3 ปานกลาง","2 พอใช้","1 ต้องปรับปรุง"]],
      ["ความรับผิดชอบ / ตรงเวลา (1-5)","select",["5 ดีเยี่ยม","4 ดี","3 ปานกลาง","2 พอใช้","1 ต้องปรับปรุง"]],
      ["การทำงานเป็นทีม (1-5)","select",["5 ดีเยี่ยม","4 ดี","3 ปานกลาง","2 พอใช้","1 ต้องปรับปรุง"]],
      ["ความเห็นเพิ่มเติม","textarea"]],btn:"บันทึกผลประเมิน"},
    peer:{t:"Peer Review — ประเมินเพื่อนร่วมทีม",type:"form",fields:[
      ["เพื่อนร่วมทีม","select",["เลือกจากทีมเดียวกัน (สุ่มโดยระบบ)"]],
      ["ให้คะแนนภาพรวม (1-5)","select",["5","4","3","2","1"]],
      ["สิ่งที่อยากชม","textarea"],["สิ่งที่อยากให้ปรับ","textarea"]],btn:"ส่งแบบประเมิน"},
    report:{t:"Review Report",type:"table",cols:["พนักงาน","แผนก","หัวหน้าประเมิน","Peer","Upward","คะแนนรวม","เกรด"],rows:[
      ["สมชาย ใจดี","R&D","4.5","4.2","4.8","4.5","A"],
      ["อรพรรณ มั่นคง","Planning","4.8","4.6","4.5","4.6","A"],
      ["กิตติ ขยันยิ่ง","Plant","4.0","4.3","4.1","4.1","B+"]]}}},
  mkt:{label:"Marketing",pages:{
    req:{t:"Create Request (Marketing)",type:"form",fields:[
      ["ประเภทคำขอ","select",["จ้าง Influencer / KOL","ผลิตสื่อโฆษณา","ออกบูธ Event","ยิง Ads Online"]],
      ["Vendor / ผู้รับจ้าง","text"],["งบประมาณ (บาท)","number"],
      ["แคมเปญ / โปรเจกต์ที่เกี่ยวข้อง","text"],["รายละเอียด","textarea"]],btn:"ส่งคำขออนุมัติ"},
    pending:{t:"Pending — เอกสารรอดำเนินการ",type:"table",cols:["เลขที่","ประเภท","ผู้ขอ","Vendor","ยอด","สถานะ"],rows:[
      ["MKT-680701-05","Pending Payment","ทีม Digital","TikTok Ads","85,000 ฿","รอการเงินจ่าย"],
      ["MKT-680630-04","Pending PV","ฝ่ายการตลาด","Studio ถ่ายภาพ","32,000 ฿","รอออก PV"],
      ["MKT-680628-03","Pending Invoice","ทีม Event","Organizer บูธ","120,000 ฿","รอใบแจ้งหนี้"],
      ["MKT-680625-02","Pending Vendor","ทีม Digital","KOL รายใหม่","45,000 ฿","รอขึ้นทะเบียน Vendor"]]}}}
};
