"use client";
import { useState } from "react";
import { eventTime, stamp } from "@/lib/display";
import { zonedStart } from "@/lib/competition/format";
import { resultOf, type EventDTO } from "./operations";
import { Badge, Button, Feedback, useRequest } from "./ui";
export function LiveOperations({ event: e }: { event: EventDTO }) {
  const r = useRequest(),
    [court, setCourt] = useState(""),
    [minutes, setMinutes] = useState(0);
  return (
    <details className="panel live-operations">
      <summary>Live timing & schedule recovery</summary>
      <p>
        Record actual timing, calculate the impact, then approve estimates.
        Planned starts stay fixed. All times below use {e.timezone}.
      </p>
      <div className="two-columns">
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            const fd = new FormData(ev.currentTarget);
            const convert = (s: string) =>
              zonedStart(
                s.slice(0, 10),
                s.slice(11, 16),
                e.timezone,
              ).toISOString();
            try {
              await r.run(
                `/api/events/${e.id}/command`,
                {
                  action: "observeTiming",
                  fixtureId: fd.get("fixtureId"),
                  expectedRevision: e.scheduleRevision,
                  startedAt: convert(String(fd.get("startedAt"))),
                  endedAt: fd.get("endedAt")
                    ? convert(String(fd.get("endedAt")))
                    : null,
                  reason: fd.get("reason"),
                },
                "Actual timing saved. Calculate recovery to review affected starts.",
              );
            } catch {
              r.setError(
                "Use an unambiguous local date and time in the event timezone.",
              );
            }
          }}
        >
          <h3>1. Observe actual timing</h3>
          <label>
            Game
            <select name="fixtureId" aria-label="Game" required>
              {e.fixtures
                .filter(
                  (f) =>
                    f.homeId && f.awayId && resultOf(f)?.kind !== "WALKOVER",
                )
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} · {f.court}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Actual start
            <input name="startedAt" type="datetime-local" required />
          </label>
          <label>
            Actual end (optional)
            <input name="endedAt" type="datetime-local" />
          </label>
          <label>
            Timing observation reason
            <textarea name="reason" minLength={8} maxLength={500} required />
          </label>
          <Button busy={r.busy}>Save actual timing</Button>
        </form>
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            const fd = new FormData(ev.currentTarget);
            await r.run(
              `/api/events/${e.id}/command`,
              {
                action: "proposeRecovery",
                expectedRevision: e.scheduleRevision,
                court: court || undefined,
                delayMinutes: minutes,
                reason: fd.get("reason"),
              },
              "Recovery calculated. Review affected games and approve below.",
            );
          }}
        >
          <h3>2. Calculate impact</h3>
          <label>
            Disruption
            <select
              aria-label="Disruption"
              value={court}
              onChange={(ev) => {
                setCourt(ev.target.value);
                if (!ev.target.value) setMinutes(0);
              }}
            >
              <option value="">Recalculate from actual observations</option>
              {Array.from({ length: e.courtCount }, (_, i) => (
                <option key={i}>Court {i + 1}</option>
              ))}
            </select>
          </label>
          <label>
            Additional court delay (minutes)
            <input
              type="number"
              min={0}
              max={720}
              value={minutes}
              disabled={!court}
              onChange={(ev) => setMinutes(Number(ev.target.value))}
            />
          </label>
          <label>
            Recovery reason
            <textarea name="reason" minLength={8} maxLength={500} required />
          </label>
          <Button busy={r.busy}>Calculate recovery proposal</Button>
        </form>
      </div>
      <Feedback request={r} />
      {e.recoveryProposals.map((p) => (
        <article className="history-record" key={p.id}>
          <h3>
            3.{" "}
            {p.status === "APPLIED" ? "Approved recovery" : "Review recovery"}{" "}
            <Badge tone={p.status === "APPLIED" ? "lime" : "amber"}>
              {p.status}
            </Badge>
          </h3>
          <p>
            {p.reason} · {p.staff.username} · {stamp(p.createdAt, e.timezone)}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Planned</th>
                  <th>Previous estimate</th>
                  <th>Proposed estimate</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((i) => (
                  <tr key={i.id}>
                    <th scope="row">
                      {e.fixtures.find((f) => f.id === i.fixtureId)?.code}
                    </th>
                    <td>
                      {eventTime(
                        e.fixtures.find((f) => f.id === i.fixtureId)!.startsAt,
                        e.timezone,
                      )}
                    </td>
                    <td>{eventTime(i.previous, e.timezone)}</td>
                    <td>{eventTime(i.proposed, e.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.status === "PROPOSED" &&
            (p.baseRevision !== e.scheduleRevision ? (
              <p className="notice">
                Stale proposal. Recalculate from current event state.
              </p>
            ) : (
              <form
                onSubmit={async (ev) => {
                  ev.preventDefault();
                  await r.run(
                    `/api/events/${e.id}/command`,
                    {
                      action: "approveRecovery",
                      proposalId: p.id,
                      confirmed: true,
                    },
                    "Estimated times approved. Published schedule updated.",
                  );
                }}
              >
                <label className="checkbox">
                  <input type="checkbox" required />I reviewed the affected
                  starts and approve these public estimates.
                </label>
                <Button busy={r.busy}>Approve recovery</Button>
              </form>
            ))}
        </article>
      ))}
    </details>
  );
}
