"use client";
import Link from "next/link";
import { Pill, Team } from "./ui";
import { currentStepInfo, devDone, overallPct, prodDoneN, projStatus, slaInfo, STATUS_PILL } from "@/lib/domain";
import { TEAM_CLS } from "@/lib/utils";
import type { AppData, Project } from "@/lib/types";

/** แถวเดียวใช้ทั้ง Dashboard และ Projects — ตรงกับ projectRow() เดิมเป๊ะ */
export function ProjectRow({ p, d }: { p: Project; d: AppData }) {
  const info = currentStepInfo(p, d);
  const st = projStatus(p);
  const pct = overallPct(p, d);
  const sla = slaInfo(p, d);
  const cust = d.customers.find((c) => c.id === p.custId);
  const isProd = p.phase !== "dev";
  const total = d.workflow.length + d.production.length;
  const done = devDone(p) + prodDoneN(p);

  return (
    <tr className="clickable">
      <td><span className="code">{p.id}</span></td>
      <td>
        <Link href={`/projects/${p.id}`} style={{ fontWeight: 700, color: "var(--navy)" }}>{p.name}</Link>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{cust?.name ?? ""}</div>
      </td>
      <td><span style={{ fontSize: 12.5 }}>{info.label}</span></td>
      <td>
        {info.team
          ? <Team cls={TEAM_CLS[info.team]}>{info.team}</Team>
          : <span style={{ color: "var(--muted)" }}>—</span>}
      </td>
      <td>
        <Pill kind={STATUS_PILL[st]?.[0] ?? "wait"}>{STATUS_PILL[st]?.[1] ?? st}</Pill>
        {sla?.breach && (
          <div style={{ marginTop: 4 }}>
            <span className="age age-late">ค้าง {sla.age}/{sla.lead} วัน · เกิน {sla.over}</span>
          </div>
        )}
      </td>
      <td>
        <div className={isProd ? "pbar prodbar" : "pbar"}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="pmeta">{done}/{total} · {pct}%</div>
      </td>
    </tr>
  );
}
