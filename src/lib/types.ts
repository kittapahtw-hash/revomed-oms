import type { Kpi, Project, StockLot, Ticket } from "@/db/schema";

export type SessionUser = {
  username: string; name: string; email: string;
  admin: boolean; perms: Record<string, 0 | 1>;
};

export type StockRow = {
  id: string; name: string; type: string; unit: string;
  qty: string; reserved: string; safety: string; cost: string;
  supplier: string; note: string; available: string;
};

export type Step = { id: number; team: string; th: string; en: string; lead: number; gate?: string; note?: string };
export type Dept = { key: string; name: string; th: string; cls: string; email: string };
export type Customer = { id: string; name: string; type: string; contact: string };
export type Line = { id: string; name: string; capacity: number; note: string };
export type LineOut = {
  id: number; date: string; lineId: string; projectId: string | null;
  qty: number; hours: string; downtime: string; defect: number; who: string; note: string;
};
export type Move = {
  id: number; ts: string; itemId: string; itemName: string;
  dir: string; qty: string; ref: string; who: string; note: string;
};
export type Ann = { id: string; title: string; body: string; cat: string; by: string; ts: string };
export type Evt = { id: string; date: string; title: string; type: string };

export type AppData = {
  projects: Project[];
  workflow: Step[];
  production: Step[];
  departments: Dept[];
  customers: Customer[];
  productTypes: string[];
  users: SessionUser[];
  stock: StockRow[];
  moves: Move[];
  lines: Line[];
  lineOutput: LineOut[];
  tickets: Ticket[];
  announcements: Ann[];
  events: Evt[];
  config: Record<string, string>;
  kpis: Kpi[];
  lots: StockLot[];
};

export type { Kpi, Project, StockLot, Ticket };
