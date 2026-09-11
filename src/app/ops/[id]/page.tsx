import { notFound, redirect } from "next/navigation";
import { staffFromCookie } from "@/lib/http";
import { getEvent, poolTables, eventPhase } from "@/lib/query";
import { serialize } from "@/lib/display";
import { OperationsDesk } from "@/components/operations";
export const dynamic = "force-dynamic";
export default async function EventOps({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const staff = await staffFromCookie();
  if (!staff) redirect("/login");
  const event = await getEvent((await params).id);
  if (!event) notFound();
  return (
    <OperationsDesk
      event={serialize(event)}
      tables={poolTables(event)}
      phase={eventPhase(event)}
      view={(await searchParams).view ?? "overview"}
      username={staff.username}
    />
  );
}
