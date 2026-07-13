"use client";
import { IwFoot, IwNav } from "@/components/Intranet";
import { IwSvcGrid } from "@/components/IwFolders";
import { BIZ_RESOURCES } from "@/lib/intranet";

export default function Page() {
  return (
    <div className="home">
      <IwNav page="resources" />
      <div className="iw-wrap" style={{ minHeight: "calc(100vh - 320px)" }}>
        <IwSvcGrid title="Business Resources" arr={BIZ_RESOURCES} base="/home/resources" />
      </div>
      <IwFoot />
    </div>
  );
}
