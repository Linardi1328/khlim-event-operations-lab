import { eventTime, eventDate } from "@/lib/display";
import { Badge } from "./ui";
export function FixtureTime({
  fixture: f,
  timezone,
  eventStart,
}: {
  fixture: {
    startsAt: string;
    projectedStartsAt: string;
    actualStart: string | null;
    actualEnd: string | null;
    status: string;
  };
  timezone: string;
  eventStart?: string;
}) {
  const delay = Math.max(
    0,
    Math.round(
      (Date.parse(f.projectedStartsAt) - Date.parse(f.startsAt)) / 60000,
    ),
  );
  const time = (date: string) =>
    `${eventStart && eventDate(date, timezone) !== eventDate(eventStart, timezone) ? eventDate(date, timezone) + " · " : ""}${eventTime(date, timezone)}`;
  return (
    <div className="fixture-time">
      <span>
        {time(f.startsAt)} <small>planned</small>
      </span>
      {delay > 0 && (
        <>
          <strong>
            {time(f.projectedStartsAt)} <small>estimated</small>
          </strong>
          <Badge tone="amber">DELAYED +{delay} MIN</Badge>
        </>
      )}
      {f.actualStart && (
        <span>
          {time(f.actualStart)}
          {f.actualEnd ? `–${time(f.actualEnd)}` : ""}{" "}
          <small>actual{f.actualEnd ? "" : " start"}</small>
        </span>
      )}
    </div>
  );
}
