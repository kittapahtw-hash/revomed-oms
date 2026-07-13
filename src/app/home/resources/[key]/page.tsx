"use client";
import { use } from "react";
import { IwFoot, IwNav } from "@/components/Intranet";
import { IwDocTable, IwSvcGrid } from "@/components/IwFolders";
import { BIZ_RESOURCES } from "@/lib/intranet";

export default function FolderPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const c = BIZ_RESOURCES.find((x) => x.key === key);

  return (
    <div className="home">
      <IwNav page="folder" />
      <div className="iw-wrap" style={{ minHeight: "calc(100vh - 320px)" }}>
        {c
          ? <IwDocTable c={c} secTitle="Business Resources" base="/home/resources" />
          : <IwSvcGrid title="Business Resources" arr={BIZ_RESOURCES} base="/home/resources" />}
      </div>
      <IwFoot />
    </div>
  );
}
