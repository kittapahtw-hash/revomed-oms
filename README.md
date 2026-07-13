# Revomed OMS — Next.js + TypeScript + Postgres (Neon) + Vercel

ย้ายมาจาก Google Apps Script (`Code.gs` + `Index.html`) + Google Sheets
มาเป็นเว็บแอปจริง ที่ deploy บน Vercel และเก็บข้อมูลใน Neon Postgres

---

## Stack

| ชั้น | ของเดิม (Apps Script) | ของใหม่ |
|---|---|---|
| Runtime | Google Apps Script | **Next.js 15 (App Router) + TypeScript** |
| Database | Google Sheets (15 tabs) | **Neon Postgres + Drizzle ORM** |
| Auth | SHA-256 + CacheService token | **bcrypt + JWT ใน httpOnly cookie (jose)** |
| ไฟล์แนบ | Google Drive | **Vercel Blob** |
| อีเมล digest | GmailApp + time trigger | **Resend + Vercel Cron** |
| Optimistic lock | ScriptProperties `rev` | **คอลัมน์ `projects.rev` + `WHERE rev = ?`** |
| Hosting | Web App deployment | **Vercel** |

---

## Setup (ครั้งแรก)

```bash
npm install
cp .env.example .env
# ใส่ DATABASE_URL (Neon) + AUTH_SECRET (openssl rand -base64 32)

npm run db:push     # สร้างตารางใน Neon
npm run db:seed     # ใส่ master data + ข้อมูลตัวอย่าง
npm run dev
```

เข้าที่ http://localhost:3000 — login: `MG624001` / `123`
(ผู้ใช้ตัวอย่างอื่น: `sale` / `123`, `plant` / `123`)

> ⚠️ เปลี่ยนรหัสผ่านทันทีหลัง deploy จริง (ปุ่มแม่กุญแจบน topbar)

---

## Deploy บน Vercel

1. Push repo นี้ขึ้น GitHub
2. Vercel → **New Project** → เลือก repo
3. **Storage → Create → Neon** — Vercel จะใส่ `DATABASE_URL` ให้เอง
4. **Storage → Create → Blob** — จะได้ `BLOB_READ_WRITE_TOKEN` อัตโนมัติ
5. ใส่ env ที่เหลือใน **Settings → Environment Variables**:
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `RESEND_API_KEY` + `MAIL_FROM` (ถ้าจะส่ง digest)
   - `CRON_SECRET` — กัน endpoint cron ถูกยิงมั่ว
6. Deploy → แล้วรัน migration ครั้งแรก:
   ```bash
   DATABASE_URL="<neon url>" npm run db:push
   DATABASE_URL="<neon url>" npm run db:seed
   ```
7. Cron อ่านจาก `vercel.json` (default: ทุกวัน 00:00 UTC = 07:00 ไทย)
   แก้เวลาได้ที่ `"schedule"` ในไฟล์นั้น

---

## โครงสร้าง

```
src/
  db/
    schema.ts     # 15 ตาราง — ยกมาจาก Sheets tabs เดิม แต่ normalize แล้ว
    seed.ts       # master data (workflow 14 ขั้น, production 6 ขั้น, แผนก, users…)
  lib/
    auth.ts       # JWT cookie, bcrypt, requireUser/requirePerm/requireAdmin
    stock.ts      # ⭐ Reserve Stock model — หัวใจของระบบ
    domain.ts     # aging, ETA, progress, OEE
    store.tsx     # DataProvider ฝั่ง client (โหลด /api/data ทีเดียว + poll 60 วิ)
  app/
    (app)/        # หน้าที่ต้องล็อกอิน — dashboard, projects, board, stock, plant, tickets, exec, settings
    api/          # REST routes
  middleware.ts   # กันคนไม่ล็อกอิน
```

---

## Reserve Stock Model (v0.8 logic — ยกมาครบ)

```
เปิดโปรเจกต์ + ผูก BOM   →  reserve   จองสต็อก (ไม่ตัดจริง)
ผลิตเสร็จ (phase=done)   →  issue     ตัดจริงตาม BOM + ปล่อยจอง
Archive ตอนยังจองอยู่     →  release   ปล่อยจองเฉยๆ
Archive หลังตัดจริงแล้ว   →  return    รับกลับเข้าคลัง
กู้คืนโปรเจกต์            →  reserve   กลับมาจองใหม่
แก้ BOM/จำนวน ตอนจองอยู่  →  release เดิม + reserve ใหม่
แก้ BOM หลังตัดจริง       →  ❌ บล็อก
```

**ใช้ได้ (available) = คงเหลือจริง − จอง** · Safety stock เทียบกับยอด "ใช้ได้"
จ่ายออกด้วยมือเกินยอดใช้ได้ → ระบบบล็อกทันที (`src/lib/stock.ts`)

การเช็คสต็อกทำแบบ **all-or-nothing** — ถ้ามีวัตถุดิบตัวไหนไม่พอ ไม่แตะสักตัว

---

## API

| Method | Path | สิทธิ์ |
|---|---|---|
| POST | `/api/auth/login` `/logout` `/password` | — |
| GET | `/api/data` | ล็อกอิน (แทน `getAllData()` เดิม) |
| POST/GET | `/api/projects` | `projects` |
| GET/PATCH | `/api/projects/[id]` | `projects` (ต้องส่ง `rev` — optimistic lock) |
| POST | `/api/stock/move` | `stock` |
| POST/DELETE | `/api/stock/items` | `stock` |
| GET/POST | `/api/tickets` · PATCH/DELETE `/api/tickets/[id]` | `tickets` |
| GET/POST | `/api/lines/output` | `plant` |
| POST | `/api/upload` | ล็อกอิน (Vercel Blob, ≤ 8MB) |
| POST/DELETE | `/api/users` | Admin |
| GET | `/api/cron/digest` | `CRON_SECRET` |

---

## ที่หายไปจากของเดิม (ตั้งใจ)

- **LINE notify** — ยังไม่ port (เพิ่มได้ที่ `src/lib/` ยิง LINE Messaging API จาก API route)
- **Export เป็น Google Sheets** — เปลี่ยนเป็น export CSV/xlsx ฝั่ง client ได้ทีหลัง
- **Daily backup ไป Drive** — Neon มี point-in-time restore ในตัวแล้ว ไม่ต้องทำเอง
- **กติกาเหล็ก `https:\/\/`** — ตายไปพร้อม Apps Script 🎉 เขียน URL ปกติได้แล้ว
