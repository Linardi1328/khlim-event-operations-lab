import { db } from "@/lib/db";
import { eventInclude, publicProjection } from "@/lib/query";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const e = await db.event.findUnique({
    where: { slug: (await params).slug },
    include: eventInclude,
  });
  return e?.public
    ? NextResponse.json(publicProjection(e), {
        headers: { "Cache-Control": "no-store" },
      })
    : NextResponse.json({ error: "Event not found." }, { status: 404 });
}
