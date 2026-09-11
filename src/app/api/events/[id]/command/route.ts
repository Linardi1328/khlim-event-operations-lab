import { NextResponse } from "next/server";
import { checkOrigin, requireStaff, failure, readJson } from "@/lib/http";
import { command } from "@/lib/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requireStaff();
    checkOrigin(request);
    return NextResponse.json(
      await command(staff.id, (await params).id, await readJson(request)),
    );
  } catch (e) {
    return failure(e);
  }
}
