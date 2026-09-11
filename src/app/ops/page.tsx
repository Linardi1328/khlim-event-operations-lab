import Link from "next/link";
import { redirect } from "next/navigation";
import { staffFromCookie } from "@/lib/http";
import { db } from "@/lib/db";
import { Brand, Badge, SignOut } from "@/components/ui";
import { CreateEvent } from "@/components/event-list";
import { eventDate } from "@/lib/display";
export const dynamic = "force-dynamic";
export default async function Operations() {
  const staff = await staffFromCookie();
  if (!staff) redirect("/login");
  const events = await db.event.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { entries: true, fixtures: true } } },
  });
  return (
    <>
      <header className="public-header">
        <Link href="/ops">
          <Brand />
        </Link>
        <div className="header-actions">
          <Badge>EVENT STAFF</Badge>
          <SignOut />
        </div>
      </header>
      <main id="main" className="workspace">
        <div className="eyebrow">OPERATIONS DESK</div>
        <h1>Your events</h1>
        <p className="lede">From the first check-in to the final whistle.</p>
        <div className="event-grid">
          {events.map((e) => (
            <Link key={e.id} href={`/ops/${e.id}`} className="event-card">
              <Badge tone={e.public ? "lime" : "neutral"}>
                {e.public ? "PUBLIC EVENT" : "DRAFT EVENT"}
              </Badge>
              <h2>{e.name}</h2>
              <p>{eventDate(e.startsAt, e.timezone)}</p>
              <div className="event-card-bottom">
                {e._count.entries} teams · {e._count.fixtures} games{" "}
                <span>↗</span>
              </div>
            </Link>
          ))}
        </div>
        <CreateEvent />
      </main>
    </>
  );
}
