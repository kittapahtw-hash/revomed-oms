"use client";
import { createContext, useCallback, useContext, useState } from "react";

export type ToastKind = "ok" | "block" | "gate" | "prod" | "gold" | "";
type T = { id: number; msg: string; kind: ToastKind };

const Ctx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);

  const push = useCallback((msg: string, kind: ToastKind = "") => {
    const id = Date.now() + Math.random();
    setList((v) => [...v, { id, msg, kind }]);
    setTimeout(() => setList((v) => v.filter((t) => t.id !== id)), 3800);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span>{ICON[t.kind]}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

const ICON: Record<ToastKind, string> = {
  ok: "✓", block: "✕", gate: "🚦", prod: "⚙", gold: "★", "": "•",
};
