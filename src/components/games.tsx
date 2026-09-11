"use client";
import { useState } from "react";
import { Clock3, MapPin, Pencil, Check } from "lucide-react";
import { eventTime } from "@/lib/display";
import { Badge, Button, Empty, Feedback, useRequest } from "./ui";
import { resultOf, teamName, type EventDTO } from "./operations";
export function Games({
  event: e,
  knockout,
}: {
  event: EventDTO;
  knockout: boolean;
}) {
  const [court, setCourt] = useState("All courts");
  const r = useRequest();
  const fixtures = e.fixtures.filter(
    (f) =>
      (knockout ? f.stage !== "POOL" : f.stage === "POOL") &&
      (court === "All courts" || f.court === court),
  );
  return (
    <section className="stack">
      <div className="panel">
        <div className="section-title">
          <div>
            <h2>{knockout ? "The knockout route" : "Court schedule"}</h2>
            <p>
              {knockout
                ? "A1 × B2 · B1 × A2. Winners play the final; losers play for third."
                : "Confirm the agreed score. Use “Correct result” to revise a recorded game."}
            </p>
          </div>
          <label className="compact-label">
            Filter by court
            <select value={court} onChange={(ev) => setCourt(ev.target.value)}>
              <option>All courts</option>
              <option>Court 1</option>
              <option>Court 2</option>
            </select>
          </label>
        </div>
        {!e.fixtures.length && (
          <>
            <p className="muted">
              Generate the fixed benchmark schedule after confirming entries and
              core player check-in.
            </p>
            <Button
              busy={r.busy}
              onClick={() =>
                r.run(
                  `/api/events/${e.id}/command`,
                  { action: "generateFixtures" },
                  "Fixtures generated. Publish the schedule from Public event.",
                )
              }
            >
              Generate fixtures
            </Button>
            <Feedback request={r} />
          </>
        )}
      </div>
      {!fixtures.length ? (
        <Empty
          title={
            knockout ? "The bracket starts with pool play" : "No fixtures yet"
          }
        >
          {knockout
            ? "Once the schedule exists, knockout slots appear here. All pool results must be confirmed before semifinal teams are assigned."
            : "Check in the teams, then generate fixtures. No score is different from a zero score."}
        </Empty>
      ) : (
        <div className={knockout ? "knockout-ops-grid" : "games-grid"}>
          {fixtures.map((f) => (
            <ScoreCard key={f.id} event={e} fixture={f} />
          ))}
        </div>
      )}
    </section>
  );
}
function ScoreCard({
  event: e,
  fixture: f,
}: {
  event: EventDTO;
  fixture: EventDTO["fixtures"][number];
}) {
  const r = useRequest();
  const result = resultOf(f);
  const [editing, setEditing] = useState(false);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const original =
    f.results.find((revision) => revision.id === correctionId) ?? result;
  const [replay, setReplay] = useState(false);
  const ready = !!f.homeId && !!f.awayId;
  return (
    <article
      className={`game-card ${result ? "complete" : ""}`}
      data-testid={`game-${f.code}`}
    >
      <div className="game-meta">
        <span>
          {f.code} <span>·</span>{" "}
          {f.stage === "POOL"
            ? `Pool ${e.pools.find((p) => p.id === f.poolId)?.name}`
            : f.stage === "SEMIFINAL"
              ? "Semifinal"
              : f.stage === "THIRD"
                ? "Third place"
                : "Championship"}
        </span>
        <Badge tone={result ? "lime" : "neutral"}>
          {result ? "CONFIRMED" : ready ? "READY" : "AWAITING TEAMS"}
        </Badge>
      </div>
      <div className="game-place">
        <span>
          <Clock3 size={13} />
          {eventTime(f.startsAt)}
        </span>
        <span>
          <MapPin size={13} />
          {f.court}
        </span>
      </div>
      {(!result || editing) && ready ? (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            const fd = new FormData(ev.currentTarget);
            const home = String(fd.get("homeScore")),
              away = String(fd.get("awayScore"));
            if (home === "" || away === "") return;
            const saved = await r.run(
              `/api/events/${e.id}/command`,
              {
                action: "recordResult",
                fixtureId: f.id,
                homeScore: Number(home),
                awayScore: Number(away),
                expectedResultId: editing ? correctionId : null,
                reason: fd.get("reason") || undefined,
                authorizeReplay: replay,
              },
              result
                ? "Correction saved. Standings and bracket reconciled."
                : "Result confirmed.",
            );
            if (saved) {
              setEditing(false);
              setReplay(false);
            }
          }}
        >
          <div className="score-rows">
            <label>
              <span>{teamName(e, f.homeId)}</span>
              <input
                name="homeScore"
                type="number"
                inputMode="numeric"
                aria-label={`${f.code} ${teamName(e, f.homeId)} score`}
                min={0}
                max={50}
                required
                defaultValue={editing ? original?.homeScore : ""}
              />
            </label>
            <label>
              <span>{teamName(e, f.awayId)}</span>
              <input
                name="awayScore"
                type="number"
                inputMode="numeric"
                aria-label={`${f.code} ${teamName(e, f.awayId)} score`}
                min={0}
                max={50}
                required
                defaultValue={editing ? original?.awayScore : ""}
              />
            </label>
          </div>
          {editing && (
            <div className="correction-form">
              <p>
                Previous result: {original!.homeScore}–{original!.awayScore}. A
                correction preserves this value and records your staff identity.
              </p>
              <label>
                Reason for correction
                <textarea
                  name="reason"
                  minLength={8}
                  maxLength={500}
                  required
                  placeholder="Explain the agreed score correction…"
                />
              </label>
              {r.conflicts.length > 0 && (
                <label className="checkbox replay-consent">
                  <input
                    type="checkbox"
                    checked={replay}
                    onChange={(ev) => setReplay(ev.target.checked)}
                  />
                  I authorize voiding results for {r.conflicts.join(", ")} and
                  replaying affected games. Their previous results remain in
                  history.
                </label>
              )}
            </div>
          )}
          <div className="game-actions">
            <Button
              busy={r.busy}
              disabled={r.conflicts.length > 0 && !replay}
              type="submit"
            >
              {editing ? (
                "Save authorized correction"
              ) : (
                <>
                  <Check size={15} />
                  Confirm result
                </>
              )}
            </Button>
            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditing(false);
                  r.clear();
                  setReplay(false);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="score-display">
            <div>
              <span>{teamName(e, f.homeId, f.homeSource)}</span>
              <strong>{result ? result.homeScore : "—"}</strong>
            </div>
            <div>
              <span>{teamName(e, f.awayId, f.awaySource)}</span>
              <strong>{result ? result.awayScore : "—"}</strong>
            </div>
          </div>
          {result && (
            <button
              className="link-button"
              onClick={() => {
                r.clear();
                setCorrectionId(result.id);
                setEditing(true);
              }}
            >
              <Pencil size={14} />
              Correct result
            </button>
          )}
        </>
      )}
      <Feedback request={r} />
    </article>
  );
}
