"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Pencil, Users } from "lucide-react";
import type { EventDTO } from "./operations";
import { Badge, Button, Empty, Feedback, useRequest } from "./ui";
import { PoolAssignment } from "./pool-assignment";
export function Teams({ event: e }: { event: EventDTO }) {
  const r = useRequest();
  const [edit, setEdit] = useState<string | null>(null);
  const editor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!edit || !editor.current) return;
    editor.current.scrollIntoView({ block: "start" });
    editor.current
      .querySelector<HTMLInputElement>('input[name="name"]')
      ?.focus({ preventScroll: true });
  }, [edit]);
  const locked = e.fixtures.length > 0;
  const selected = e.entries.find((t) => t.id === edit);
  return (
    <div className="stack">
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>{e.entries.length} teams on the list</h2>
            <p>
              Three core players + one optional substitute. The official draw
              seeds teams using their top three ranking-point values.
            </p>
          </div>
          <div className="button-row">
            <Link
              className="button secondary"
              href={`/ops/${e.id}?view=import`}
            >
              Import CSV
            </Link>
            <Button
              disabled={locked || e.entries.length >= e.maxTeams}
              onClick={() => setEdit("new")}
            >
              + Add team
            </Button>
          </div>
        </div>
        {locked && (
          <div className="notice">
            Registration and check-in are locked because fixtures exist. Rosters
            and seed priorities remain fixed for this event.
          </div>
        )}
        <Feedback request={r} />
      </section>
      {edit && (
        <section className="panel" ref={editor} style={{ scrollMarginTop: 80 }}>
          <div className="section-title">
            <h2>{selected ? "Edit team entry" : "New team entry"}</h2>
            <button className="secondary" onClick={() => setEdit(null)}>
              Cancel
            </button>
          </div>
          <p className="muted">
            Edit the three required core players below. Add a fourth player in
            the substitute field, or clear that field to remove the substitute.
            A core player must be replaced to keep three core players.
          </p>
          <form
            key={edit}
            onSubmit={async (ev) => {
              ev.preventDefault();
              const f = new FormData(ev.currentTarget);
              const players = [1, 2, 3, 4]
                .map((slot) => ({
                  slot,
                  name: String(f.get(`player${slot}`) ?? "").trim(),
                  fibaPoints: Number(f.get(`points${slot}`) || 0),
                  pointsProvenance: "Staff entered; synthetic lab points",
                }))
                .filter((p) => p.name);
              if (
                await r.run(
                  `/api/events/${e.id}/command`,
                  {
                    action: "saveEntry",
                    entryId: selected?.id,
                    name: f.get("name"),
                    players,
                    synthetic: true,
                  },
                  "Team saved. Review and confirm the entry.",
                )
              )
                setEdit(null);
            }}
          >
            <div className="form-grid">
              <label>
                Team name
                <input
                  name="name"
                  maxLength={80}
                  defaultValue={selected?.name}
                  required
                />
              </label>
            </div>
            <div className="form-grid">
              {[1, 2, 3, 4].map((slot) => (
                <div key={slot}>
                  <label>
                    {slot < 4 ? `Core player ${slot}` : "Substitute (optional)"}
                    <input
                      name={`player${slot}`}
                      maxLength={80}
                      defaultValue={
                        selected?.roster.find((p) => p.slot === slot)?.name
                      }
                      required={slot < 4}
                    />
                  </label>
                  <label>
                    Player {slot} FIBA ranking points
                    <input
                      name={`points${slot}`}
                      type="number"
                      min={0}
                      max={100000000}
                      defaultValue={
                        selected?.roster.find((p) => p.slot === slot)
                          ?.fibaPoints ?? 0
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <p className="muted">
              Ranking points are staff-entered lab data, never fetched from
              FIBA. Use 0 for an unranked player. Saving any entry invalidates
              an existing draw; a reasoned redraw is required.
            </p>
            <label className="checkbox">
              <input type="checkbox" required />
              These participants are synthetic.
            </label>
            {selected && (
              <p className="muted">
                Saving resets entry confirmation and all check-in for this team.
              </p>
            )}
            <Button busy={r.busy}>Save team entry</Button>
            <Feedback request={r} />
          </form>
        </section>
      )}
      <PoolAssignment event={e} />
      <div className="team-grid">
        {e.entries.map((t) => (
          <article className="team-card" key={t.id}>
            <div className="team-heading">
              <span className={`team-avatar seed-${t.seed}`}>
                {t.name.replace("KHLIM ", "").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h3>{t.name}</h3>
                <span>
                  {t.poolId
                    ? `Pool ${e.pools.find((p) => p.id === t.poolId)?.name} · Seed ${t.seed} · ${t.seedScore ?? "legacy"} pts`
                    : "Awaiting official draw"}
                </span>
              </div>
              <button
                className="icon-button"
                disabled={locked}
                onClick={() => setEdit(t.id)}
                aria-label={`Edit ${t.name}`}
              >
                <Pencil size={16} />
              </button>
            </div>
            <div className="team-badges">
              <Badge tone="lime">VALID ROSTER</Badge>
              <Badge tone={t.confirmedAt ? "lime" : "amber"}>
                {t.confirmedAt ? "CONFIRMED" : "NEEDS CONFIRMATION"}
              </Badge>
            </div>
            <div className="roster-list">
              {t.roster.map((p) => (
                <div key={p.id}>
                  <div>
                    <span>{p.name}</span>
                    <small>
                      {p.slot === 4 ? "Substitute" : `Core ${p.slot}`} ·{" "}
                      {p.fibaPoints} ranking pts
                    </small>
                  </div>
                  <button
                    className={`check-button ${p.checkedInAt ? "checked" : ""}`}
                    disabled={locked || !t.confirmedAt || r.busy}
                    aria-label={`${p.checkedInAt ? "Undo check-in" : "Check in"} ${p.name}`}
                    aria-pressed={!!p.checkedInAt}
                    onClick={() =>
                      r.run(
                        `/api/events/${e.id}/command`,
                        {
                          action: "checkIn",
                          entryId: t.id,
                          playerId: p.id,
                          checked: !p.checkedInAt,
                        },
                        `${p.name}: ${p.checkedInAt ? "check-in undone" : "checked in"}.`,
                      )
                    }
                  >
                    <Check size={15} />
                    <span>{p.checkedInAt ? "Present" : "Check in"}</span>
                  </button>
                </div>
              ))}
            </div>
            <div className="team-footer">
              {!t.confirmedAt ? (
                <Button
                  className="secondary"
                  busy={r.busy}
                  disabled={locked}
                  onClick={() =>
                    r.run(
                      `/api/events/${e.id}/command`,
                      { action: "confirmEntry", entryId: t.id },
                      `${t.name} confirmed.`,
                    )
                  }
                >
                  Confirm entry
                </Button>
              ) : (
                <button
                  className={`secondary ${t.checkedInAt ? "checked" : ""}`}
                  disabled={locked || r.busy}
                  aria-pressed={!!t.checkedInAt}
                  onClick={() =>
                    r.run(
                      `/api/events/${e.id}/command`,
                      {
                        action: "checkIn",
                        entryId: t.id,
                        checked: !t.checkedInAt,
                      },
                      `${t.name}: team ${t.checkedInAt ? "check-in undone" : "checked in"}.`,
                    )
                  }
                >
                  <Users size={16} />
                  {t.checkedInAt ? "Team present" : "Check in team"}
                </button>
              )}
              <small>
                {t.roster.filter((p) => p.checkedInAt).length}/{t.roster.length}{" "}
                players present
              </small>
            </div>
          </article>
        ))}
      </div>
      {!e.entries.length && (
        <Empty title="A fresh team sheet">
          Add the first team or import the benchmark CSV to register all eight
          teams.
        </Empty>
      )}
    </div>
  );
}
