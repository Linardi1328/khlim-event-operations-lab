import { db } from "@/lib/db";
import { eventInclude, publicProjection } from "@/lib/query";
import { serialize } from "@/lib/display";
import { notFound } from "next/navigation";
import { PublicEvent } from "@/components/public-event";
export const dynamic = "force-dynamic";
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const e = await db.event.findUnique({
    where: { slug: (await params).slug },
    include: eventInclude,
  });
  if (!e?.public) notFound();
  return (
    <PublicEvent
      event={serialize(publicProjection(e))}
      view={(await searchParams).view ?? "overview"}
    />
  );
}
