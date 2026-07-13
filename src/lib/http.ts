import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { ZodError } from "zod";

export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, ...(data as object) });
}

export function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** ครอบ handler ให้ error กลายเป็น JSON สวยๆ แทน stack trace หลุด */
export function handler<T extends unknown[]>(fn: (...a: T) => Promise<Response>) {
  return async (...a: T): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      if (e instanceof ZodError) return fail(400, e.issues.map((i) => i.message).join(", "));
      console.error(e);
      return fail(500, e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  };
}
