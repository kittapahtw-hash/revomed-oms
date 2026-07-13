-- ============================================================
-- Revomed OMS — migration รอบ "Production Hardening"
-- รันใน Neon Console → SQL Editor (วางทั้งก้อน กด Run ครั้งเดียว)
--
-- ⚠️ ลบ projects ทิ้ง เพราะโครงสร้าง stage เปลี่ยน
--    ถ้ามีข้อมูลจริงที่เสียไม่ได้ อย่ารัน — บอกกูก่อน จะเขียน converter ให้
-- ============================================================

-- 1) KPI Dashboard
CREATE TABLE IF NOT EXISTS kpis (
  id      text PRIMARY KEY,
  team    text NOT NULL DEFAULT '',
  topic   text NOT NULL,
  how     text NOT NULL DEFAULT '',
  op      text NOT NULL DEFAULT '>=',
  target  numeric(12,2) NOT NULL DEFAULT 0,
  unit    text NOT NULL DEFAULT '%',
  src     text NOT NULL DEFAULT 'manual',
  active  boolean NOT NULL DEFAULT true,
  ord     integer NOT NULL DEFAULT 0,
  vals    jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 2) ประเภทงาน New / Repeat / ปรับสูตร
ALTER TABLE projects ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'new';

-- 3) SECURITY: revoke session ได้ (ไล่คนออกแล้วเตะออกทันที)
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 1;

-- 4) SECURITY: กัน brute-force login
CREATE TABLE IF NOT EXISTS login_attempts (
  id  serial PRIMARY KEY,
  key text NOT NULL,
  ts  timestamptz NOT NULL DEFAULT now(),
  ok  boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS attempts_key_ts_idx ON login_attempts (key, ts);

-- 5) GMP: LOT / BATCH TRACKING ────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_lots (
  id          serial PRIMARY KEY,
  item_id     text NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  lot_no      text NOT NULL,
  qty         numeric(14,3) NOT NULL DEFAULT 0,   -- คงเหลือในล็อต
  received    numeric(14,3) NOT NULL DEFAULT 0,   -- รับเข้ามาเท่าไหร่ (ไม่เปลี่ยน)
  expiry      date,
  mfg_date    date,
  supplier    text NOT NULL DEFAULT '',
  coa_url     text NOT NULL DEFAULT '',
  po_no       text NOT NULL DEFAULT '',
  qc_status   text NOT NULL DEFAULT 'pending',    -- pending | passed | failed | quarantine
  note        text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lots_item_idx   ON stock_lots (item_id);
CREATE INDEX IF NOT EXISTS lots_expiry_idx ON stock_lots (expiry);

-- ใครใช้ล็อตไหนไปเท่าไหร่ — หัวใจของ recall
CREATE TABLE IF NOT EXISTS lot_usage (
  id         serial PRIMARY KEY,
  lot_id     integer NOT NULL REFERENCES stock_lots(id) ON DELETE CASCADE,
  item_id    text NOT NULL,
  lot_no     text NOT NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  qty        numeric(14,3) NOT NULL,
  kind       text NOT NULL DEFAULT 'issue',       -- issue | return | out
  who        text NOT NULL DEFAULT '',
  ts         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_lot_idx     ON lot_usage (lot_id);
CREATE INDEX IF NOT EXISTS usage_project_idx ON lot_usage (project_id);

ALTER TABLE stock_moves ADD COLUMN IF NOT EXISTS lot_no text NOT NULL DEFAULT '';

-- 6) รีเซ็ตข้อมูลให้ seed ใหม่ (stage machine + ล็อตตัวอย่าง)
DELETE FROM projects;
DELETE FROM stock_lots;
UPDATE stock_items SET reserved = '0';

-- 7) เติมสิทธิ์ใหม่ให้ Admin
UPDATE users
SET perms = perms || '{"kpi":1,"production":1,"aging":1,"summary":1,"report":1}'::jsonb
WHERE admin = true;
