"use client";
import { IwFoot, IwNav } from "@/components/Intranet";
import { IwSvcGrid } from "@/components/IwFolders";
import { EMP_SERVICES } from "@/lib/intranet";

export default function Page() {
  return (
    <div className="home">
      <IwNav page="services" />
      <div className="iw-wrap" style={{ minHeight: "calc(100vh - 320px)" }}>
        <IwSvcGrid title="Employee Services" arr={EMP_SERVICES} base="/home/services" />
      </div>
      <IwFoot />
    </div>
  );
}
