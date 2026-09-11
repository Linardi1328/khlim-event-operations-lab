import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { cookieName, sessionStaff } from "./auth";
import { DomainError } from "./domain";
export async function staffFromCookie() {
  return sessionStaff((await cookies()).get(cookieName)?.value);
}
export async function requireStaff() {
  const staff = await staffFromCookie();
  if (!staff) throw new DomainError("Event staff authorization required.", 401);
  return staff;
}
export function checkOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN ?? "http://127.0.0.1:3000";
  if (request.headers.get("origin") !== expected)
    throw new DomainError("Request origin is not authorized.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new DomainError("Use JSON requests.", 415);
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length")) > 2_000_000)
    throw new DomainError("Request too large.", 413);
  const body = await request.text();
  if (Buffer.byteLength(body) > 2_000_000)
    throw new DomainError("Request too large.", 413);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new DomainError("Malformed request JSON.");
  }
}
export function failure(error: unknown) {
  if (error instanceof DomainError)
    return NextResponse.json(
      { error: error.message, conflicts: error.conflicts },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" "),
      },
      { status: 400 },
    );
  console.error(error);
  return NextResponse.json(
    { error: "The operation could not be saved. Refresh and try again." },
    { status: 500 },
  );
}
