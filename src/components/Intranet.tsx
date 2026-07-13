"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/lib/store";
import { useToast } from "./Toast";
import { HOME_MODULES } from "@/lib/intranet";

export function Logo({ size = 26, color = "#15325b" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="M12 22V12M3 7l9 5 9-5" />
    </svg>
  );
}

/** navbar ของ Home intranet — Home / About Us / Employee Services / Business Resources / Modules ▾ */
export function IwNav({ page }: { page: "main" | "about" | "services" | "resources" | "folder" | "preview" }) {
  const { me, can } = useData();
  const router = useRouter();
  const toast = useToast();
  const [drop, setDrop] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function openModule(k: string) {
    const m = HOME_MODULES.find((x) => x.key === k);
    if (!m || !m.active) { toast(`โมดูล ${m?.name ?? k} — เร็ว ๆ นี้`, "gold"); return; }
    if (m.adminOnly && !me.admin) { toast(`โมดูล ${m.name} เฉพาะ Admin`, "block"); return; }
    if (m.mock) { router.push(`/home/preview?m=${m.mock}`); return; }
    if (m.perm && !can(m.perm)) { toast("มึงไม่มีสิทธิ์เข้าโมดูลนี้ — ติดต่อ Admin", "block"); return; }
    router.push(m.href!);
  }

  const L = (p: string, href: string, label: string) => (
    <Link href={href} className={`iw-link ${page === p ? "active" : ""}`}>{label}</Link>
  );

  return (
    <div className="iw-nav" onClick={() => setDrop(false)}>
      <Link href="/home" className="iw-brand">
        <Logo />
        <b style={{ color: "var(--navy)", letterSpacing: 2 }}>REVOMED</b>
      </Link>

      <div className="iw-links">
        {L("main", "/home", "Home")}
        {L("about", "/home/about", "About Us")}
        {L("services", "/home/services", "Employee Services")}
        {L("resources", "/home/resources", "Business Resources")}
        <div className={`iw-drop-wrap ${drop ? "open" : ""}`}>
          <button className="iw-link" onClick={(e) => { e.stopPropagation(); setDrop((v) => !v); }}>
            Modules ▾
          </button>
          <div className="iw-drop" onClick={(e) => e.stopPropagation()}>
            {HOME_MODULES.map((m) => (
              <button key={m.key} className={m.active ? "" : "soon"}
                onClick={() => { setDrop(false); openModule(m.key); }}>
                {m.name}{m.active ? "" : " · เร็ว ๆ นี้"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="iw-user">
        <div className="iw-ava">{me.name.trim().charAt(0).toUpperCase() || "?"}</div>
        {me.name}
        <button className="logout" onClick={() => void logout()} title="ออกจากระบบ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function IwFoot() {
  return (
    <div className="iw-foot">
      <div className="iw-foot-in">
        <div>
          <div className="f-logo">REVO<br />MED</div>
          <div className="f-dots"><span /><span /><span /></div>
        </div>
        <div>
          <div className="f-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span>Revomed Group Co., Ltd.<br />สำนักงานใหญ่ กรุงเทพมหานคร</span>
          </div>
        </div>
        <div>
          <div className="f-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6L22 7" />
            </svg>
            hr@revomed.co.th
          </div>
          <div className="f-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z" />
            </svg>
            0301
          </div>
        </div>
      </div>
    </div>
  );
}

export const DOC_ICO = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" />
  </svg>
);
export const CAL_ICO = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ verticalAlign: -2, marginRight: 3 }}>
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);
