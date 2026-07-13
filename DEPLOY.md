# Deploy — Revomed OMS

> จาก localhost → เว็บที่ทีมใช้จริง มี HTTPS มี DB จริง มีอีเมลอัตโนมัติ
> ครั้งแรกใช้เวลา ~30-40 นาที · รอบต่อไป `git push` แล้วจบ

---

## ขั้น 0 — ทดสอบในเครื่องให้ผ่านก่อน (ห้ามข้าม)

```bash
cd oms-next
npm install
npm run typecheck   # ต้อง 0 error
npm run test        # ต้องผ่าน 22 tests
npm run build       # ต้องผ่าน
```

พังในเครื่อง = พังบน Vercel เหมือนกัน แต่ debug ยากกว่า 10 เท่า

---

## ขั้น 1 — Neon (Database)

1. neon.com → **New Project**
2. **Region: `AWS ap-southeast-1 (Singapore)`** ← ต้องใกล้ Vercel ไม่งั้นทุก query บวก 200ms
3. เอา connection string ไว้ 2 แบบ:
   - **Pooled** (มี `-pooler` ในชื่อ host) → ใส่ใน Vercel `DATABASE_URL`
   - **Direct** (ไม่มี `-pooler`) → ใช้รัน migration ในเครื่อง

> **Pooled vs Direct:** Vercel เป็น serverless — ทุก request คือ process ใหม่
> ต่อ Postgres ตรงๆ 100 req = 100 connection = DB ตายคาที่
> **แอปใช้ pooled · migration ใช้ direct** เท่านั้น

---

## ขั้น 2 — GitHub

```bash
git init
git add .
git commit -m "Revomed OMS — Next.js + Neon"
gh repo create revomed-oms --private --source=. --push
```

**เช็คก่อน push:** `git status` ต้อง**ไม่มี** `.env` โผล่มา
(secret หลุดขึ้น GitHub แล้วเรียกกลับไม่ได้ — ถึงจะลบ commit ก็ยังอยู่ใน history)

CI (`.github/workflows/ci.yml`) จะรัน typecheck + test + build ให้ทุก PR อัตโนมัติ

---

## ขั้น 3 — Vercel

1. vercel.com → **Add New → Project** → เลือก repo
2. **Storage → Create → Neon** (ถ้ายังไม่มี) หรือ **Connect Existing**
3. **Storage → Create → Blob** → ได้ `BLOB_READ_WRITE_TOKEN` อัตโนมัติ (ไฟล์แนบ + COA)
4. **Settings → Functions → Region: Singapore (sin1)** ← ให้ตรงกับ Neon

---

## ขั้น 4 — Environment Variables

Settings → Environment Variables (ติ๊กทั้ง Production + Preview + Development)

| Key | ค่า | จำเป็น |
|---|---|---|
| `DATABASE_URL` | **pooled** URL จาก Neon | ✅ ขาดไม่ได้ |
| `AUTH_SECRET` | `openssl rand -base64 32` | ✅ ขาดไม่ได้ (ต้อง ≥ 32 ตัว ไม่งั้น build fail) |
| `BLOB_READ_WRITE_TOKEN` | Vercel ใส่ให้เอง | ไฟล์แนบ / COA |
| `CRON_SECRET` | `openssl rand -base64 32` (คนละค่ากับ AUTH_SECRET) | อีเมลอัตโนมัติ |
| `RESEND_API_KEY` | จาก resend.com | อีเมลอัตโนมัติ |
| `MAIL_FROM` | `OMS <oms@revomed.co.th>` | อีเมลอัตโนมัติ |
| `SEED_PASSWORD` | รหัสตั้งต้น (≥8 ตัว + ตัวเลข) | ไม่ใส่ = `Revomed2026` |

**⚠️ กับดักที่คนพลาดบ่อยสุด:**
- `AUTH_SECRET` **ห้ามเปลี่ยนหลังใช้จริง** — เปลี่ยนเมื่อไหร่ ทุกคนหลุด login ทันที
- `CRON_SECRET` **ต้องตั้ง** ไม่งั้นใครก็ยิง `/api/cron/digest` ได้ ส่งเมลรัวถล่ม quota
  (Vercel แนบ `Authorization: Bearer $CRON_SECRET` ให้เองถ้าตั้ง env นี้)

---

## ขั้น 5 — Deploy + สร้างตาราง

กด **Deploy** → รอ build (~2 นาที)

**เว็บยังใช้ไม่ได้นะ — DB ยังว่าง เปิดแล้วจะ 500 นี่คือปกติ**

```bash
# ใช้ DIRECT url (ไม่มี -pooler)
export DATABASE_URL="postgresql://...ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

npm run db:push    # สร้างตารางทั้งหมด
npm run db:seed    # master data + ข้อมูลตัวอย่าง + ล็อตตัวอย่าง
```

> ถ้า `db:push` พังกลางทาง (drizzle-kit มีบั๊กเรื่อง primary key) → เอา **`MIGRATE.sql`** ไปวางใน Neon SQL Editor แล้ว Run แทน

รีเฟรชเว็บ → เจอหน้า login

---

## ขั้น 6 — ทำทันทีหลัง deploy (อย่าลืม)

1. **login `MG624001` / `Revomed2026` → เปลี่ยนรหัสทันที** (ไอคอนแม่กุญแจบน topbar)
2. ลบ/เปลี่ยนรหัส user ตัวอย่าง `sale`, `plant`
3. **ตั้งค่า Tracker → แผนก** → ใส่อีเมลทีมจริงทุกแผนก (ไม่งั้นไม่มีใครได้รับแจ้งเตือน)
4. **System Settings → ข้อมูลระบบ** → ล้างข้อมูลตัวอย่าง (โปรเจกต์/ประกาศ/ล็อต)
5. **ตั้งค่า Tracker → Stock Master** → ใส่วัตถุดิบจริง แล้วรับเข้าผ่านหน้า **ล็อต** (ต้องมีเลขล็อต + วันหมดอายุ)

---

## ขั้น 7 — Cron (อีเมลเช้า)

`vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/digest", "schedule": "0 0 * * *" }] }
```
`0 0 * * *` = เที่ยงคืน **UTC** = **07:00 เวลาไทย** · อยากได้ 08:00 → `0 1 * * *`

> **Vercel Hobby รัน cron ได้วันละครั้ง** — ถี่กว่านั้นต้องขึ้น Pro

ทดสอบ: **System Settings → การแจ้งเตือน → ✉ ทดสอบส่งตอนนี้**

---

## ขั้น 8 — Monitoring

**Uptime:** UptimeRobot / BetterStack ชี้มาที่ `https://<โดเมน>/api/health`
(คืน `{ok:true, db:"up", latencyMs:...}` · ถ้า DB ล่มจะได้ 503)

**Backup:** Neon มี **Point-in-Time Restore** ในตัว (ย้อนได้ 7 วันบน free tier)
ก่อนทำอะไรเสี่ยง → Neon → **Branches → Create branch** = snapshot ทันที ฟรี

---

## รอบต่อไป

```bash
git add . && git commit -m "..." && git push
```
Vercel deploy ให้เอง · push branch อื่น = ได้ Preview URL แยกไว้ทดสอบก่อน

**ถ้าแก้ `src/db/schema.ts`** → ต้อง `npm run db:push` ชี้ไป prod ด้วย
ไม่งั้นโค้ดใหม่หาคอลัมน์ที่ยังไม่มีใน DB → พังทั้งแอป

> **บน production อย่าใช้ `db:push`** — ใช้ `npm run db:generate` (สร้าง SQL ให้อ่านก่อน) แล้วค่อย apply จะได้เห็นว่ามันจะไปแตะอะไร

---

## เจอปัญหา → ดูตรงนี้

| อาการ | สาเหตุ 90% |
|---|---|
| `DATABASE_URL is not set` | ลืมใส่ env / ติ๊กแค่ Production ไม่ได้ติ๊ก Preview |
| Build ผ่าน แต่เปิดเว็บ 500 | ยังไม่ได้ `db:push` |
| `AUTH_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร` | ใส่สั้นไป |
| ล็อกอินแล้วเด้งกลับ | `AUTH_SECRET` ไม่ตรงกัน / user ถูก revoke |
| `ใส่รหัสผิดเกิน 8 ครั้ง — ล็อก 15 นาที` | โดน rate limit (ทำงานถูกแล้ว) รอ 15 นาที |
| อัปโหลด/COA ไม่ได้ | ไม่มี `BLOB_READ_WRITE_TOKEN` |
| Cron ได้ 401 | `CRON_SECRET` ไม่ตรง |
| ไม่มีอีเมลเข้า | Resend ยังไม่ verify โดเมน — ทดสอบด้วย `onboarding@resend.dev` ก่อน |
| ช้าผิดปกติ | Neon กับ Vercel คนละ region |
| `เบิกไม่ได้ — ยังไม่ผ่าน QC` | ทำงานถูกแล้ว ไปกด QC ผ่านที่หน้า **ล็อต** ก่อน |
