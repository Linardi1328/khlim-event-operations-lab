import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut, cookieName } from "@/lib/auth";
import { checkOrigin, failure, requireStaff } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireStaff();
    await signOut((await cookies()).get(cookieName)?.value);
    const r = NextResponse.json({ ok: true });
    r.cookies.delete(cookieName);
    return r;
  } catch (e) {
    return failure(e);
  }
}
