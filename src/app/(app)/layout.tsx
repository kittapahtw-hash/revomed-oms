import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  // ❗ ห้ามลบ cookie ตรงนี้ — Next.js แก้ cookie ใน Server Component ไม่ได้ (prod จะ 500 ทันที)
  //    ส่งธง stale ไปให้หน้า login ล้าง cookie ให้แทน (หน้านั้นเรียก route handler ได้)
  if (!me) redirect("/login?stale=1");
  return <Shell me={me}>{children}</Shell>;
}
