import { put } from "@vercel/blob";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/http";

export const runtime = "nodejs";

/** แทน Drive upload ของเดิม → Vercel Blob (public URL เปิดดูได้เลย) */
export const POST = handler(async (req: Request) => {
  await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  const ref = String(form.get("ref") || "misc");
  if (!(file instanceof File)) return fail(400, "ไม่พบไฟล์");
  if (file.size > 8 * 1024 * 1024) return fail(400, "ไฟล์ใหญ่เกิน 8MB");

  const blob = await put(`${ref}/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return ok({ name: file.name, url: blob.url });
});
