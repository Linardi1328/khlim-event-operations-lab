import { db } from "@/lib/db";
import { eventInclude, publicProjection } from "@/lib/query";
import { serialize } from "@/lib/display";
import { notFound, redirect } from "next/navigation";
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
  const requested = (await searchParams).view ?? "overview";
  const aliases: Record<string, string> = {
    standings: "pools",
    knockout: "playoffs",
    placements: "playoffs",
    announcements: "overview",
  };
  if (aliases[requested])
    redirect(`/events/${e.slug}?view=${aliases[requested]}`);
  const view = ["overview", "pools", "schedule", "scores", "playoffs"].includes(
    requested,
  )
    ? requested
    : "overview";
  return <PublicEvent event={serialize(publicProjection(e))} view={view} />;
}
