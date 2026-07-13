"use client";
import { use } from "react";
import { IwFoot, IwNav } from "@/components/Intranet";
import { IwDocTable, IwSvcGrid } from "@/components/IwFolders";
import { EMP_SERVICES } from "@/lib/intranet";

export default function FolderPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const c = EMP_SERVICES.find((x) => x.key === key);

  return (
    <div className="home">
      <IwNav page="folder" />
      <div className="iw-wrap" style={{ minHeight: "calc(100vh - 320px)" }}>
        {c
          ? <IwDocTable c={c} secTitle="Employee Services" base="/home/services" />
          : <IwSvcGrid title="Employee Services" arr={EMP_SERVICES} base="/home/services" />}
      </div>
      <IwFoot />
    </div>
  );
}
