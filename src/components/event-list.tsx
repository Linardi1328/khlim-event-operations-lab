"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Feedback, useRequest } from "./ui";
export function CreateEvent() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const r = useRequest();
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Start a new tournament</h2>
          <p>One day. Eight teams. The benchmark 3×3 format.</p>
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
            const f = new FormData(ev.currentTarget);
            const result = await r.run<{ id: string }>(
              "/api/events",
              {
                name: f.get("name"),
                date: f.get("date"),
                venue: f.get("venue"),
                overview: f.get("overview"),
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
              Event date (MYT)
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
                maxLength={80}
                required
                defaultValue="KHLIM Lab Courts"
              />
            </label>
            <label>
              Public introduction
              <textarea
                name="overview"
                maxLength={1000}
                defaultValue="A synthetic one-day KHLIM 3×3 basketball tournament."
              />
            </label>
          </div>
          <p className="muted">
            Pool play starts at 09:00 MYT. Two courts and fixed 15-minute pool
            slots.
          </p>
          <label className="checkbox">
            <input type="checkbox" required />
            This event will contain synthetic participants only.
          </label>
          <Button busy={r.busy}>Create synthetic event</Button>
          <Feedback request={r} />
        </form>
      )}
    </section>
  );
}
