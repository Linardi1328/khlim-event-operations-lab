"use client";
import { useState } from "react";
import { formatIssues } from "@/lib/competition/format";
import { stamp } from "@/lib/display";
import type { EventDTO } from "./operations";
import { Badge, Button, Feedback, useRequest } from "./ui";
export function PoolAssignment({ event: e }: { event: EventDTO }) {
  const r = useRequest(),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState("");
  const latest = e.draws[0],
    active = latest?.status === "ACTIVE",
    locked = !!e.fixtures.length;
  const issues = formatIssues(e, e.entries.length);
  if (e.entries.some((t) => !t.confirmedAt))
    issues.push("Confirm every eligible entry before drawing.");
  return (
    <section className="panel" data-testid="official-draw">
      <div className="section-title">
        <div>
          <h2>Official pool draw</h2>
          <p>
            Top-three player points → event seeds → randomized seeding pots →
            balanced pools.
          </p>
        </div>
        <Badge tone={active ? "lime" : "amber"}>
          {active
            ? `DRAW ${latest.version}`
            : locked
              ? "LOCKED"
              : "DRAW REQUIRED"}
        </Badge>
      </div>
      <div className="pool-composition-grid">
        {e.pools.map((p) => {
          const teams = e.entries.filter((t) => t.poolId === p.id);
          return (
            <div className="pool-composition" key={p.id}>
              <h3>
                Pool {p.name} <small>{teams.length} teams</small>
              </h3>
              {teams.length ? (
                <ol>
                  {teams.map((t) => (
                    <li key={t.id}>
                      {t.name} <small>Seed {t.seed ?? "—"}</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">Awaiting draw</p>
              )}
            </div>
          );
        })}
      </div>
      {locked ? (
        <p className="notice">
          The draw is locked because fixtures exist. Individual pool
          reassignment and redraw are blocked. Start a new event for a different
          format or roster.
        </p>
      ) : (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (
              await r.run(
                `/api/events/${e.id}/command`,
                {
                  action: "runDraw",
                  expectedDrawVersion: latest?.version ?? null,
                  confirmed,
                  reason: reason || undefined,
                },
                "Official draw saved. Review pools and check in teams before scheduling.",
              )
            ) {
              setConfirmed(false);
              setReason("");
            }
          }}
        >
          {issues.length > 0 && (
            <ul className="notice">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {latest && (
            <label>
              Reason for redraw
              <textarea
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
                minLength={8}
                maxLength={500}
                required
                placeholder="Explain why another draw is necessary…"
              />
            </label>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(ev) => setConfirmed(ev.target.checked)}
            />
            I confirm the eligible entry list and authorize{" "}
            {latest
              ? "a new draw version; the previous draw stays in history"
              : "the official draw"}
            .
          </label>
          <Button busy={r.busy} disabled={issues.length > 0 || !confirmed}>
            {latest ? "Run official redraw" : "Run official draw"}
          </Button>
        </form>
      )}
      <Feedback request={r} />
      {e.draws.length > 0 && (
        <details className="history-game">
          <summary>
            Draw audit & reproducibility ({e.draws.length} versions)
          </summary>
          {e.draws.map((d) => (
            <article key={d.id} className="history-record">
              <h3>
                Draw {d.version} · {d.status}
              </h3>
              <p>
                {d.staff.username} · {stamp(d.createdAt, e.timezone)} ·{" "}
                {d.reason}
              </p>
              <p className="audit-code">
                Algorithm: {d.algorithmVersion}
                <br />
                Seeding: {d.seedingVersion}
                <br />
                RNG seed: {d.rngSeed}
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Input</th>
                      <th>Team</th>
                      <th>Top-three sum</th>
                      <th>Random tie value</th>
                      <th>Seed</th>
                      <th>Pot</th>
                      <th>Pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.entries.map((t) => (
                      <tr key={t.id}>
                        <td>{t.inputOrder + 1}</td>
                        <th scope="row">
                          {t.teamName}
                          <details>
                            <summary>Points inputs</summary>
                            {t.players.map((p) => (
                              <p key={p.id}>
                                {p.name}: {p.points} · {p.provenance}
                              </p>
                            ))}
                          </details>
                        </th>
                        <td>{t.seedScore}</td>
                        <td>{t.tieBreak}</td>
                        <td>{t.eventSeed}</td>
                        <td>{t.pot}</td>
                        <td>{e.pools.find((p) => p.id === t.poolId)?.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </details>
      )}
    </section>
  );
}
