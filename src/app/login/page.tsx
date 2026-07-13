"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  /* เช็คสถานะ session ตรงนี้ (ไม่ใช่ที่ middleware — มันดูได้แค่ว่ามี cookie ไม่รู้ว่า valid มั้ย)
   *  - ยัง valid  → เด้งเข้าระบบเลย
   *  - เสียแล้ว   → ล้าง cookie ทิ้งผ่าน /api/auth/logout (route handler แก้ cookie ได้)
   *                 ไม่งั้น middleware ยังเห็น cookie แล้วเด้งวนไม่จบ */
  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const j = await r.json();
      if (j.ok && j.user) {
        router.replace(params.get("next") || "/home");
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
        if (params.get("stale")) setErr("เซสชันหมดอายุหรือถูกยกเลิก — กรุณาเข้าสู่ระบบใหม่");
      }
    })();
  }, [router, params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) return setErr(j.error);
    router.replace(params.get("next") || "/home");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="login-card">
      <div className="login-logo">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#15325b" strokeWidth="1.8"
             style={{ margin: "0 auto 12px", display: "block" }}>
          <path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="M12 22V12M3 7l9 5 9-5" />
        </svg>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", letterSpacing: 4 }}>REVOMED</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, letterSpacing: 1 }}>
          ORDER MANAGEMENT SYSTEM
        </div>
      </div>

      <label className="login-label">ชื่อผู้ใช้</label>
      <div className="login-field">
        <input value={username} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" />
      </div>

      <label className="login-label">รหัสผ่าน</label>
      <div className="login-field">
        <input type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
      </div>

      {err && (
        <div className="alert-strip" style={{ marginTop: 4, marginBottom: 4 }}>
          <span>⚠</span><span>{err}</span>
        </div>
      )}

      <button className="btn-signin" disabled={busy}>
        {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>

      <div className="login-foot">Revomed OMS v1.0 · Next.js · Neon</div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <Suspense><LoginForm /></Suspense>
    </div>
  );
}
