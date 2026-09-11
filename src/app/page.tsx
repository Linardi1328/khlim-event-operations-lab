import Link from "next/link";
import { db } from "@/lib/db";
import { Brand, Badge } from "@/components/ui";
import { eventDate } from "@/lib/display";
export const dynamic = "force-dynamic";
export default async function Home() {
  const events = await db.event.findMany({
    where: { public: true },
    orderBy: { startsAt: "asc" },
  });
  return (
    <>
      <header className="public-header">
        <Link href="/">
          <Brand />
        </Link>
        <Link href="/ops" className="subtle-link">
          Staff access ↗
        </Link>
      </header>
      <main id="main" className="directory">
        <div className="eyebrow">KHLIM LABS / EXPERIMENT 002</div>
        <h1>
          Small court.
          <br />
          <span>Big game day.</span>
        </h1>
        <p className="lede">
          Follow the action, find your court, and see how the day unfolds.
        </p>
        <div className="event-grid">
          {events.map((e) => (
            <Link href={`/events/${e.slug}`} className="event-card" key={e.id}>
              <Badge tone="lime">3×3 BASKETBALL</Badge>
              <h2>{e.name}</h2>
              <p>
                {eventDate(e.startsAt, e.timezone)} · {e.venue}
              </p>
              <span className="event-card-bottom">
                Explore event <span>↗</span>
              </span>
            </Link>
          ))}
        </div>
        {!events.length && (
          <p>
            No public events yet. Staff can publish an event from operations.
          </p>
        )}
        <p className="lab-note">
          All events, teams and participants in this lab are synthetic.
        </p>
      </main>
    </>
  );
}
