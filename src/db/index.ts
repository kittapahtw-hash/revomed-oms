import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

/* neon-http (ตัวเดิม) เร็วกว่าแต่ "ไม่รองรับ transaction"
 * ระบบสต็อกที่มีการจอง/ตัดของ ถ้าไม่มี transaction = สองคนกดพร้อมกันแล้วขายเกินสต็อก
 * เลยย้ายมาใช้ WebSocket pool ที่ทำ db.transaction() ได้จริง */
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { schema, pool };
