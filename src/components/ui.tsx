"use client";

export function Panel({ title, sub, right, children, noPad }: {
  title?: string; sub?: string; right?: React.ReactNode;
  children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <section className="panel">
      {(title || right) && (
        <div className="panel-head">
          <h3>{title}</h3>
          {sub && <span className="sub">{sub}</span>}
          {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
        </div>
      )}
      <div className="panel-body" style={noPad ? { padding: "14px 18px" } : undefined}>{children}</div>
    </section>
  );
}

/** KPI การ์ด — k1=ฟ้า k2=เขียว k3=ส้ม k4=ม่วง k5=เขียวน้ำทะเล (แถบซ้าย) */
export function Kpi({ label, value, delta, k = 1 }: {
  label: string; value: React.ReactNode; delta?: string; k?: 1 | 2 | 3 | 4 | 5;
}) {
  return (
    <div className={`kpi k${k}`}>
      <div className="lab">{label}</div>
      <div className="val">{value}</div>
      {delta && <div className="delta">{delta}</div>}
    </div>
  );
}

export function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={`pill s-${kind}`}><span className="dot" />{children}</span>;
}

export function Team({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`team ${cls}`}>{children}</span>;
}

export function Bar({ pct, prod }: { pct: number; prod?: boolean }) {
  return (
    <div className={`pbar ${prod ? "prodbar" : ""}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, foot, wide }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; foot?: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 760 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="ปิด">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon = "◎", children }: { icon?: string; children: React.ReactNode }) {
  return <div className="empty"><div className="big">{icon}</div>{children}</div>;
}

export function Alert({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="alert-strip"><span>⚠</span><span>{children}</span>{action}</div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
