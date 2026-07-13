import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements, config, customers, departments, events, kpis, lineOutput, lines, stockLots,
  productTypes, productionSteps, projects, stockItems, stockMoves, tickets, users,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { workflowSteps } from "@/db/schema";

export const dynamic = "force-dynamic";

/** แทน getAllData() ของ Apps Script — โหลดทีเดียวตอนเปิดแอป */
export const GET = handler(async () => {
  await requireUser();

  const [
    projectRows, wf, prod, depts, custs, ptypes, userRows,
    stockRows, moveRows, lineRows, loutRows, ticketRows, annRows, evtRows, cfgRows, kpiRows, lotRows,
  ] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.createdAt)),
    db.select().from(workflowSteps).orderBy(workflowSteps.id),
    db.select().from(productionSteps).orderBy(productionSteps.id),
    db.select().from(departments),
    db.select().from(customers),
    db.select().from(productTypes),
    db.select({
      username: users.username, name: users.name, email: users.email,
      admin: users.admin, perms: users.perms,
    }).from(users),                                  // ไม่ส่ง password ลง client เด็ดขาด
    db.select({
      id: stockItems.id, name: stockItems.name, type: stockItems.type, unit: stockItems.unit,
      qty: stockItems.qty, reserved: stockItems.reserved, safety: stockItems.safety,
      cost: stockItems.cost, supplier: stockItems.supplier, note: stockItems.note,
      available: sql<string>`(${stockItems.qty} - ${stockItems.reserved})`.as("available"),
    }).from(stockItems).orderBy(stockItems.id),
    db.select().from(stockMoves).orderBy(desc(stockMoves.ts)).limit(300),
    db.select().from(lines),
    db.select().from(lineOutput).orderBy(desc(lineOutput.date)).limit(300),
    db.select().from(tickets).orderBy(desc(tickets.updatedAt)),
    db.select().from(announcements).orderBy(desc(announcements.ts)),
    db.select().from(events).orderBy(events.date),
    db.select().from(config),
    db.select().from(kpis).orderBy(kpis.team, kpis.ord),
    db.select().from(stockLots).orderBy(sql`${stockLots.expiry} ASC NULLS LAST`),
  ]);

  return ok({
    projects: projectRows,
    workflow: wf,
    production: prod,
    departments: depts,
    customers: custs,
    productTypes: ptypes.map((p) => p.name),
    users: userRows,
    stock: stockRows,
    moves: moveRows,
    lines: lineRows,
    lineOutput: loutRows,
    tickets: ticketRows,
    announcements: annRows,
    events: evtRows,
    config: Object.fromEntries(cfgRows.map((c) => [c.key, c.value])),
    kpis: kpiRows,
    lots: lotRows,
  });
});
