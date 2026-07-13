import "dotenv/config";           // ← อ่าน .env ให้อัตโนมัติ ไม่ต้องเซ็ต env var เอง
import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — เช็คไฟล์ .env ว่ามีบรรทัด DATABASE_URL=... หรือยัง");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
} satisfies Config;
