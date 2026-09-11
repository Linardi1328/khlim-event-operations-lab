"use client";
import { useState } from "react";
import type { EventDTO } from "./operations";
import { Badge, Button, Feedback, useRequest } from "./ui";
type Assignment = {
  entryId: string;
  name: string;
  pool: string;
  expectedPool: string;
};
export function PoolAssignment({ event: e }: { event: EventDTO }) {
  const r = useRequest();
  // Capture the original pools when the form opens, including across refreshes.
  const [draft, setDraft] = useState<Assignment[] | null>(null);
  const locked = e.fixtures.length > 0;
  const assignments = e.entries.map((t) => ({
    entryId: t.id,
    name: t.name,
    pool: e.pools.find((p) => p.id === t.poolId)!.name,
    expectedPool: e.pools.find((p) => p.id === t.poolId)!.name,
  }));
  const shown = draft ?? assignments;
  const valid =
    shown.length === 8 &&
    ["A", "B"].every((p) => shown.filter((t) => t.pool === p).length === 4);
  return (
    <section className="panel" aria-label="Pool assignments">
      <div className="section-title">
        <div>
          <h2>Pool assignments</h2>
          <p>
            Eight teams. Four in each pool. Swap teams together before creating
            fixtures.
          </p>
        </div>
        <Button
          className="secondary"
          disabled={locked || e.entries.length !== 8 || !!draft}
          onClick={() => setDraft(assignments)}
        >
          Manage pools
        </Button>
      </div>
      <div className="two-columns pool-composition">
        {["A", "B"].map((pool) => (
          <section key={pool} aria-label={`Staff Pool ${pool}`}>
            <div className="section-title">
              <h3>Pool {pool}</h3>
              <Badge
                tone={
                  shown.filter((t) => t.pool === pool).length === 4
                    ? "lime"
                    : "amber"
                }
              >
                {shown.filter((t) => t.pool === pool).length}/4 teams
              </Badge>
            </div>
            <ul>
              {shown
                .filter((t) => t.pool === pool)
                .map((t) => (
                  <li key={t.entryId}>{t.name}</li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      {locked ? (
        <p className="notice">
          Pool assignments are locked because fixtures exist. To change the pool
          structure, create a fresh event; existing games and correction history
          remain intact.
        </p>
      ) : e.entries.length < 8 ? (
        <p className="notice">
          Add all eight teams to manage the complete pool composition. Choose a
          pool when adding each team. Fixture generation requires four teams in
          each pool.
        </p>
      ) : null}
      {draft && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (
              await r.run(
                `/api/events/${e.id}/command`,
                {
                  action: "assignPools",
                  assignments: draft.map(({ entryId, pool, expectedPool }) => ({
                    entryId,
                    pool,
                    expectedPool,
                  })),
                },
                "Pool assignments saved. Rosters and check-in are unchanged.",
              )
            )
              setDraft(null);
          }}
        >
          <div className="pool-assignment-list">
            {draft.map((t) => (
              <label key={t.entryId}>
                <span>{t.name}</span>
                <select
                  aria-label={`Pool for ${t.name}`}
                  value={t.pool}
                  onChange={(ev) =>
                    setDraft(
                      draft.map((a) =>
                        a.entryId === t.entryId
                          ? { ...a, pool: ev.target.value }
                          : a,
                      ),
                    )
                  }
                >
                  <option value="A">Pool A</option>
                  <option value="B">Pool B</option>
                </select>
              </label>
            ))}
          </div>
          {!valid && (
            <p className="notice" role="status">
              Both pools need exactly four teams. Move another team to balance
              the pools before saving.
            </p>
          )}
          <div className="button-row">
            <Button busy={r.busy} disabled={!valid || locked}>
              Save pool assignments
            </Button>
            <button
              type="button"
              className="secondary"
              onClick={() => setDraft(null)}
            >
              Cancel pool changes
            </button>
          </div>
        </form>
      )}
      <Feedback request={r} />
    </section>
  );
}
