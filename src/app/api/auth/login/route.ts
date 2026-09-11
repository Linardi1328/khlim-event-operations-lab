import { NextResponse } from "next/server";
import { z } from "zod";
import { cookieName, signIn } from "@/lib/auth";
import { checkOrigin, failure, readJson } from "@/lib/http";
import { DomainError } from "@/lib/domain";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const d = z
      .object({ username: z.string().max(80), password: z.string().max(200) })
      .parse(await readJson(request));
    const prior = attempts.get(d.username);
    if (prior && prior.until > Date.now() && prior.count >= 10)
      throw new DomainError(
        "Too many attempts. Try again in five minutes.",
        429,
      );
    attempts.set(d.username, {
      count: prior && prior.until > Date.now() ? prior.count + 1 : 1,
      until: Date.now() + 300_000,
    });
    const token = await signIn(d.username, d.password);
    attempts.delete(d.username);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
      path: "/",
      maxAge: 8 * 3600,
    });
    return res;
  } catch (error) {
    return failure(error);
  }
}
