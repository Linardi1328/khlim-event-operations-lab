import { NextResponse } from "next/server";
import { checkOrigin, requireStaff, failure, readJson } from "@/lib/http";
import { createEvent } from "@/lib/service";
export async function POST(request: Request) {
  try {
    const staff = await requireStaff();
    checkOrigin(request);
    return NextResponse.json(
      await createEvent(staff.id, await readJson(request)),
    );
  } catch (e) {
    return failure(e);
  }
}
