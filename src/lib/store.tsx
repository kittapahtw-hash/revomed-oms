"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AppData, SessionUser } from "./types";

type Ctx = {
  data: AppData | null;
  me: SessionUser;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  can: (perm: string) => boolean;
};

const DataCtx = createContext<Ctx | null>(null);

export function DataProvider({ me, children }: { me: SessionUser; children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      const { ok: _ok, ...rest } = j;
      void _ok;
      setData(rest as AppData);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // polling เบาๆ ทุก 60 วิ — เหมือน optimistic-lock check ของเดิม
  useEffect(() => {
    const t = setInterval(() => { void reload(); }, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  /** __admin__ = ต้องเป็น Admin เท่านั้น · อื่นๆ = admin หรือมี perm นั้น */
  const can = useCallback(
    (perm: string) => (perm === "__admin__" ? me.admin : me.admin || me.perms?.[perm] === 1),
    [me]
  );

  return (
    <DataCtx.Provider value={{ data, me, loading, error, reload, can }}>
      {children}
    </DataCtx.Provider>
  );
}

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData ต้องอยู่ใน <DataProvider>");
  return c;
}

/** helper ยิง API + reload อัตโนมัติ */
export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "เกิดข้อผิดพลาด");
  return j as T;
}
