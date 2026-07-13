import { redirect } from "next/navigation";
import { destroySession, getSession } from "@/lib/auth";
import { HomeShell } from "@/components/HomeShell";

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  if (!me) {
    // session ใช้ไม่ได้แล้ว (หมดอายุ / ถูก revoke / token version ไม่ตรง)
    // ต้องลบ cookie ทิ้งด้วย ไม่งั้น middleware ยังเห็นว่า "มี cookie" แล้ววนกลับมาอีก
    await destroySession();
    redirect("/login");
  }
  return <HomeShell me={me}>{children}</HomeShell>;
}
