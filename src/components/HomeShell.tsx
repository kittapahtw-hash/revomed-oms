"use client";
import { DataProvider } from "@/lib/store";
import { ToastProvider } from "./Toast";
import type { SessionUser } from "@/lib/types";

export function HomeShell({ me, children }: { me: SessionUser; children: React.ReactNode }) {
  return (
    <DataProvider me={me}>
      <ToastProvider>{children}</ToastProvider>
    </DataProvider>
  );
}
