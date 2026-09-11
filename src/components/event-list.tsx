"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatSchema,
  formatIssues,
  formatPreview,
  type CompetitionFormat,
} from "@/lib/competition/format";
import { Button, Feedback, useRequest } from "./ui";
export function CreateEvent() {
  const router = useRouter(),
    r = useRequest();
  const [open, setOpen] = useState(false),
    [format, setFormat] = useState<CompetitionFormat>(formatSchema.parse({}));
  const issues = formatIssues(format),
    preview = formatPreview(format);
  const numeric = [
    ["expectedTeams", "Expected teams", 4, 128],
    ["maxTeams", "Maximum entries", 4, 128],
    ["poolCount", "Number of pools", 1, 16],
    ["automaticQualifiers", "Automatic qualifiers per pool", 1, 16],
    ["wildcardCount", "Best remaining / wildcard slots", 0, 31],
    ["knockoutSize", "Knockout field", 2, 32],
    ["courtCount", "Number of courts", 1, 16],
    ["slotMinutes", "Game slot (minutes)", 5, 60],
    ["restMinutes", "Team rest (minutes)", 0, 120],
    ["turnaroundMinutes", "Court turnaround (minutes)", 0, 30],
  ] as const;
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Start a new tournament</h2>
          <p>
            Build your 3×3 format. Preview the draw, games, and playoff field.
          </p>
        </div>
        <Button
          className="secondary"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? "Close" : "+ Create event"}
        </Button>
      </div>
      {open && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            const fd = new FormData(ev.currentTarget);
            const result = await r.run<{ id: string }>(
              "/api/events",
              {
                ...format,
                name: fd.get("name"),
                date: fd.get("date"),
                venue: fd.get("venue"),
                overview: fd.get("overview"),
              },
              "Event created.",
            );
            if (result) router.push(`/ops/${result.id}?view=teams`);
          }}
        >
          <div className="form-grid">
            <label>
              Event name
              <input
                name="name"
                maxLength={80}
                required
                placeholder="KHLIM Synthetic Cup"
              />
            </label>
            <label>
              Event date
              <input
                type="date"
                name="date"
                required
                defaultValue="2026-10-10"
              />
            </label>
            <label>
              Venue
              <input
                name="venue"
                required
                maxLength={80}
                defaultValue="KHLIM Lab Courts"
              />
            </label>
            <label>
              Timezone (IANA)
              <input
                value={format.timezone}
                onChange={(ev) =>
                  setFormat({ ...format, timezone: ev.target.value })
                }
                required
                list="timezones"
              />
              <datalist id="timezones">
                <option>Asia/Kuala_Lumpur</option>
                <option>Asia/Singapore</option>
                <option>Europe/Paris</option>
                <option>America/New_York</option>
                <option>UTC</option>
              </datalist>
            </label>
            <label>
              Planned start
              <input
                type="time"
                required
                value={format.plannedStart}
                onChange={(ev) =>
                  setFormat({ ...format, plannedStart: ev.target.value })
                }
              />
            </label>
            {numeric.map(([field, label, min, max]) => (
              <label key={field}>
                {label}
                <input
                  type="number"
                  min={min}
                  max={max}
                  required
                  value={format[field]}
                  onChange={(ev) =>
                    setFormat({ ...format, [field]: Number(ev.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={format.thirdPlace}
              onChange={(ev) =>
                setFormat({ ...format, thirdPlace: ev.target.checked })
              }
            />
            Include a third-place game
          </label>
          <section className="format-preview notice" aria-live="polite">
            <h3>Format preview</h3>
            <p>
              {format.expectedTeams} teams · {format.poolCount} pools ·{" "}
              {preview.sizes.join(" / ")} teams per pool
            </p>
            <p>
              {preview.poolGames} pool games · Top {format.automaticQualifiers}{" "}
              per pool
              {format.wildcardCount
                ? ` + ${format.wildcardCount} best remaining`
                : ""}{" "}
              · {format.knockoutSize}-team playoff field
              {preview.byes ? ` · ${preview.byes} byes` : ""}
            </p>
            <p>
              {preview.knockoutGames} playoff games · {format.courtCount} courts
              · Planned start: {format.plannedStart} {format.timezone}
            </p>
            {issues.length > 0 && (
              <ul className="error" role="alert">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            <small>
              Actual confirmed entries determine pool sizes at the draw. The
              format is fixed at creation; create a new event if the
              qualification policy changes.
            </small>
          </section>
          <label>
            Public introduction
            <textarea
              name="overview"
              maxLength={1000}
              defaultValue="A synthetic KHLIM 3×3 basketball tournament."
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" required />
            This event will contain synthetic participants only.
          </label>
          <Button busy={r.busy} disabled={issues.length > 0}>
            Create synthetic event
          </Button>
          <Feedback request={r} />
        </form>
      )}
    </section>
  );
}
