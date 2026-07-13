"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DataProvider, useData } from "@/lib/store";
import { MODULES, PAGE_META, moduleOf } from "@/lib/modules";
import type { SessionUser } from "@/lib/types";
import { ToastProvider, useToast } from "./Toast";
import { Modal } from "./ui";
import { aging, lowStock } from "@/lib/domain";

function Sidebar({ collapsed }: { collapsed: boolean }) {
  void collapsed;
  const path = usePathname();
  const { can, data } = useData();
  const mod = moduleOf(path) ?? MODULES[0];

  // badge บนเมนู — งานค้าง / สต็อกต่ำ / ticket เปิดอยู่
  const badges: Record<string, { n: number; red: boolean }> = {};
  if (data) {
    const late = data.projects.filter((p) => !p.archived && aging(p, data).late).length;
    if (late) badges["/dashboard"] = { n: late, red: true };
    const low = lowStock(data).length;
    if (low) badges["/stock"] = { n: low, red: true };
    const open = data.tickets.filter((t) => t.status === "open").length;
    if (open) badges["/tickets"] = { n: open, red: false };
  }

  return (
    <aside className="sidebar">
      <Link href="/home" className="brand" title="กลับหน้าแรก">
        <div className="logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e4a9b0" strokeWidth="2">
            <path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="M12 22V12M3 7l9 5 9-5" />
          </svg>
        </div>
        <h1>REVOMED</h1>
      </Link>

      <nav className="nav">
        <div className="nav-label">{mod.name}</div>
        {mod.groups.map((g, gi) => (
          <div key={g.label}>
            {gi > 0 && <div className="nav-label">{g.label}</div>}
            {g.items.filter((i) => can(i.perm)).map((i) => {
              const b = badges[i.href];
              return (
                <Link key={i.href} href={i.href}
                  className={`nav-item ${path.startsWith(i.href) ? "active" : ""}`}>
                  <span className="ic">{i.ic}</span>
                  <span>{i.label}</span>
                  {b && <span className={`badge ${b.red ? "red" : ""}`}>{b.n}</span>}
                </Link>
              );
            })}
          </div>
        ))}

        <div className="nav-label">สลับโมดูล</div>
        {MODULES.filter((m) => m.key !== mod.key && can(m.perm)).map((m) => (
          <Link key={m.key} href={m.groups[0].items[0].href} className="nav-item">
            <span className="ic">↗</span><span>{m.name}</span>
          </Link>
        ))}
        <Link href="/home" className="nav-item">
          <span className="ic">⌂</span><span>หน้าแรก</span>
        </Link>
      </nav>

      <div className="side-foot">
        Revomed OMS <b>v1.0</b><br />Next.js · Neon · Vercel
      </div>
    </aside>
  );
}

function Topbar({ toggle }: { toggle: () => void }) {
  const path = usePathname();
  const { me, reload, loading } = useData();
  const router = useRouter();
  const toast = useToast();
  const [pw, setPw] = useState(false);

  const meta = PAGE_META[Object.keys(PAGE_META).find((k) => path.startsWith(k)) ?? ""] ?? {
    title: "Revomed OMS", sub: "",
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="topbar">
      <button className="hamb" onClick={toggle} aria-label="เมนู">☰</button>
      <div>
        <h2>{meta.title}</h2>
        <div className="sub">{meta.sub}</div>
      </div>
      <div className="top-actions">
        {loading && <span className="lang">ซิงก์…</span>}
        <button className="btn btn-sm" onClick={() => { void reload(); toast("โหลดข้อมูลล่าสุดแล้ว", "ok"); }}>
          ⟳ รีเฟรช
        </button>
        <button className="btn btn-sm" onClick={() => setPw(true)} title="เปลี่ยนรหัสผ่าน">🔒</button>
        <span className="usel">{me.name}</span>
        <button className="logout" onClick={() => void logout()} title="ออกจากระบบ">⏻</button>
      </div>
      <PasswordModal open={pw} close={() => setPw(false)} />
    </div>
  );
}

function PasswordModal({ open, close }: { open: boolean; close: () => void }) {
  const [cur, setCur] = useState(""); const [nx, setNx] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    const r = await fetch("/api/auth/password", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: cur, next: nx }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) { toast("เปลี่ยนรหัสผ่านเรียบร้อย", "ok"); setCur(""); setNx(""); close(); }
    else toast(j.error, "block");
  }

  return (
    <Modal open={open} onClose={close} title="เปลี่ยนรหัสผ่าน"
      foot={<>
        <button className="btn" onClick={close}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>บันทึก</button>
      </>}>
      <div className="field">
        <label>รหัสผ่านเดิม</label>
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
      </div>
      <div className="field">
        <label>รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)</label>
        <input type="password" value={nx} onChange={(e) => setNx(e.target.value)} />
      </div>
    </Modal>
  );
}

export function Shell({ me, children }: { me: SessionUser; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <DataProvider me={me}>
      <ToastProvider>
        <div className={`app ${collapsed ? "sb-collapsed" : ""}`}>
          <Sidebar collapsed={collapsed} />
          <div className="main">
            <Topbar toggle={() => setCollapsed((v) => !v)} />
            <div className="content">{children}</div>
          </div>
        </div>
      </ToastProvider>
    </DataProvider>
  );
}
