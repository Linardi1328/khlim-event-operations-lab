"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  MapPin,
  RefreshCw,
  Megaphone,
  Trophy,
} from "lucide-react";
import type { publicProjection } from "@/lib/query";
import type { Serialized } from "@/lib/display";
import { eventDate, eventTime } from "@/lib/display";
import { Brand, Badge, Empty } from "./ui";
import { stageNames } from "@/lib/competition/bracket";
import { FixtureTime } from "./fixture-time";
import { StandingsTable } from "./standings";
type PublicData = Serialized<ReturnType<typeof publicProjection>>;
type PublicFixture = PublicData["fixtures"][number];
const tabs = [
  ["overview", "Overview"],
  ["pools", "Pools"],
  ["schedule", "Schedule"],
  ["scores", "Scores"],
  ["playoffs", "Playoffs"],
];
function stageLabel(f: PublicFixture) {
  return f.stage === "POOL"
    ? `Pool ${f.code.split("-")[0]} · Game ${f.code.split("-")[1]}`
    : `${stageNames[f.stage]}${["FINAL", "THIRD"].includes(f.stage) ? "" : ` · ${f.code}`}`;
}
export function PublicEvent({
  event: e,
  view,
}: {
  event: PublicData;
  view: string;
}) {
  const router = useRouter();
  const [court, setCourt] = useState("All courts");
  const done = e.fixtures.filter((f) => f.result);
  const pending = e.fixtures
    .filter((f) => !f.result && f.homeId && f.awayId)
    .sort(
      (a, b) =>
        Date.parse(a.projectedStartsAt) - Date.parse(b.projectedStartsAt),
    );
  const games = e.fixtures.filter(
    (f) => court === "All courts" || f.court === court,
  );
  // Only published facts inform the public status; hidden results never leak here.
  const status = e.placements.length
    ? "Tournament complete"
    : e.fixtures.length > 0 && done.length === e.fixtures.length
      ? "Final review"
      : done.some((f) => f.stage !== "POOL") ||
          (e.resultsPublished &&
            e.fixtures.some((f) => f.stage !== "POOL" && f.homeId))
        ? "Playoffs"
        : done.length
          ? "Pool play"
          : e.schedulePublished
            ? "Schedule published"
            : "Getting ready";
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link href="/">
          <Brand />
        </Link>
        <div className="button-row">
          <button
            className="icon-button"
            aria-label="Refresh scores"
            onClick={() => router.refresh()}
          >
            <RefreshCw size={17} />
          </button>
          <Link className="subtle-link" href="/ops">
            Staff access ↗
          </Link>
        </div>
      </header>
      <section
        className={`public-hero ${view !== "overview" ? "compact-hero" : ""}`}
      >
        <div className="hero-court" aria-hidden="true">
          <div />
          <span>3×3</span>
        </div>
        <div className="hero-content">
          <div className="hero-eyebrow">
            <Badge tone="lime">{status}</Badge>
            <span>SYNTHETIC 3×3 TOURNAMENT</span>
          </div>
          <h1>{e.name}</h1>
          {view === "overview" && (
            <>
              <p>{e.overview}</p>
              <div className="hero-meta">
                <span>▦ {eventDate(e.startsAt, e.timezone)}</span>
                <span>
                  <MapPin size={16} />
                  {e.venue}
                </span>
              </div>
            </>
          )}
        </div>
        {view === "overview" && (
          <div className="hero-stats">
            <div>
              <strong>{e.entries.length}</strong>
              <span>TEAMS</span>
            </div>
            <div>
              <strong>{e.pools.length}</strong>
              <span>POOLS</span>
            </div>
            <div>
              <strong>
                {done.length}
                <small>/{e.fixtures.length || "—"}</small>
              </strong>
              <span>PUBLISHED SCORES</span>
            </div>
          </div>
        )}
      </section>
      <div className="public-nav-wrap">
        <nav className="public-nav" aria-label="Public event">
          {tabs.map(([id, label]) => (
            <Link
              key={id}
              href={`/events/${e.slug}?view=${id}`}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <main id="main" className="public-main">
        {view === "overview" && (
          <>
            {e.placements.length > 0 && (
              <section className="champion">
                <Trophy size={30} />
                <span>CHAMPION</span>
                <h2>{e.placements[0].name}</h2>
                <Link href={`/events/${e.slug}?view=playoffs`}>
                  Playoffs & final placements <ArrowUpRight size={17} />
                </Link>
              </section>
            )}
            <div className="public-overview-grid">
              <section>
                <div className="section-title">
                  <h2>
                    {e.resultsPublished ? "Next on court" : "On the schedule"}
                  </h2>
                  <Link
                    className="subtle-link"
                    href={`/events/${e.slug}?view=schedule`}
                  >
                    Full schedule ↗
                  </Link>
                </div>
                {pending.length ? (
                  <div className="stack">
                    {pending.slice(0, 2).map((f) => (
                      <PublicGame key={f.id} e={e} f={f} />
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={
                      e.fixtures.length > 0 && done.length === e.fixtures.length
                        ? "All games complete"
                        : e.schedulePublished
                          ? "Next teams to be confirmed"
                          : "Schedule coming soon"
                    }
                  >
                    {e.fixtures.length > 0 && done.length === e.fixtures.length
                      ? "See Scores for every result and Playoffs for the final outcome."
                      : "Staff will publish the next games here."}
                  </Empty>
                )}
              </section>
              <section className="public-guide">
                <h2>Your courtside guide</h2>
                <Link href={`/events/${e.slug}?view=pools`}>
                  <span>
                    <strong>Find your pool</strong>
                    <small>
                      {e.pools.length} pools · Teams, matchups & standings
                    </small>
                  </span>
                  <ArrowUpRight size={20} />
                </Link>
                <Link href={`/events/${e.slug}?view=scores`}>
                  <span>
                    <strong>Check the scores</strong>
                    <small>Every published, completed game</small>
                  </span>
                  <ArrowUpRight size={20} />
                </Link>
                <Link href={`/events/${e.slug}?view=playoffs`}>
                  <span>
                    <strong>Follow the playoffs</strong>
                    <small>{e.knockoutSize} teams in the playoff field</small>
                  </span>
                  <ArrowUpRight size={20} />
                </Link>
              </section>
            </div>
            {e.announcements.length > 0 && (
              <section className="overview-updates">
                <h3>From the event desk</h3>
                <div className="public-announcements">
                  {e.announcements.map((a) => (
                    <article key={a.id}>
                      <div className="announcement-meta">
                        <Megaphone size={16} />
                        <span>EVENT DESK</span>
                        <time>
                          {eventDate(a.createdAt, e.timezone)} ·{" "}
                          {eventTime(a.createdAt, e.timezone)}
                        </time>
                      </div>
                      <p>{a.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        {view === "pools" && (
          <>
            <div className="section-title">
              <div>
                <h2>Find your pool.</h2>
                <p>
                  Every team plays each opponent once. Top{" "}
                  {e.automaticQualifiers} per pool
                  {e.wildcardCount
                    ? ` + ${e.wildcardCount} best remaining`
                    : ""}{" "}
                  advance.
                </p>
              </div>
            </div>
            {!e.drawComplete && (
              <Empty title="Official draw coming soon">
                Staff will publish pool assignments after the official draw.
              </Empty>
            )}
            <div className="stack public-pools">
              {e.pools.map((p) => {
                const entries = e.entries.filter((t) => t.poolId === p.id),
                  table = e.standings.find((t) => t.name === p.name);
                return (
                  <section
                    className="panel public-pool"
                    key={p.id}
                    aria-label={`Pool ${p.name}`}
                  >
                    <div className="section-title">
                      <h3>Pool {p.name}</h3>
                      <Badge>{entries.length} teams</Badge>
                    </div>
                    <ul className="pool-team-list">
                      {entries.map((t) => (
                        <li key={t.id}>
                          <span
                            className={`pool-dot seed-${t.seed}`}
                            aria-hidden="true"
                          />
                          {t.name}
                        </li>
                      ))}
                    </ul>
                    {entries.length > 0 && (
                      <>
                        <p className="table-note">
                          Read a row for that team’s scores. — = same team · vs
                          = no published result · W/O = walkover. Swipe tables
                          sideways on a small screen.
                        </p>
                        <div
                          className="table-scroll matrix-scroll"
                          role="region"
                          tabIndex={0}
                          aria-label={`Pool ${p.name} matchups`}
                        >
                          <table className="matchup-matrix">
                            <thead>
                              <tr>
                                <th scope="col">Team / opponent</th>
                                {entries.map((t) => (
                                  <th scope="col" key={t.id}>
                                    {t.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map((t) => (
                                <tr key={t.id}>
                                  <th scope="row">{t.name}</th>
                                  {entries.map((op) => {
                                    const f = e.fixtures.find(
                                        (f) =>
                                          f.poolId === p.id &&
                                          ((f.homeId === t.id &&
                                            f.awayId === op.id) ||
                                            (f.awayId === t.id &&
                                              f.homeId === op.id)),
                                      ),
                                      r = f?.result;
                                    return (
                                      <td
                                        key={op.id}
                                        className={
                                          op.id === t.id ? "matrix-self" : ""
                                        }
                                      >
                                        {op.id === t.id ? (
                                          "—"
                                        ) : r ? (
                                          <span>
                                            {f!.homeId === t.id
                                              ? r.homeScore
                                              : r.awayScore}
                                            –
                                            {f!.homeId === t.id
                                              ? r.awayScore
                                              : r.homeScore}
                                            {r.kind === "WALKOVER" && (
                                              <small>W/O</small>
                                            )}
                                          </span>
                                        ) : (
                                          <span aria-label="No published result">
                                            vs
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    {table && (
                      <StandingsTable
                        rows={table.rows}
                        automatic={e.automaticQualifiers}
                        qualifiedIds={e.qualifiedIds}
                      />
                    )}
                  </section>
                );
              })}
            </div>
            {e.standings.length > 0 && (
              <p className="table-note">
                {e.standingsVersion === "LEGACY_V1"
                  ? "This earlier lab event uses its original wins, difference, points and seed rule."
                  : "Rank: wins → head-to-head wins → average points → event seed. AVG PTS caps each game at 21 and excludes walkover winning games. PF, PA and PD show recorded scores; PD does not break ties. Wildcards compare win ratio, average, then seed."}
              </p>
            )}
          </>
        )}
        {view === "schedule" && (
          <>
            <div className="section-title">
              <div>
                <h2>Find your next game.</h2>
                <p>
                  {eventDate(e.startsAt, e.timezone)} · All times {e.timezone}.
                </p>
              </div>
              <label className="compact-label">
                Court
                <select
                  aria-label="Court"
                  value={court}
                  onChange={(ev) => setCourt(ev.target.value)}
                >
                  <option>All courts</option>
                  {Array.from({ length: e.courtCount }, (_, i) => (
                    <option key={i}>Court {i + 1}</option>
                  ))}
                </select>
              </label>
            </div>
            {games.length ? (
              <div className="games-grid">
                {games.map((f) => (
                  <PublicGame key={f.id} e={e} f={f} />
                ))}
              </div>
            ) : (
              <Empty title="Schedule coming soon">
                Fixtures will appear once event staff publish the schedule.
              </Empty>
            )}
          </>
        )}
        {view === "scores" && (
          <>
            <div className="section-title">
              <div>
                <h2>Every final score.</h2>
                <p>
                  Completed games, confirmed by event staff. Refresh for the
                  latest scores.
                </p>
              </div>
              <Badge tone="lime">{done.length} completed</Badge>
            </div>
            {done.length ? (
              <div className="stack score-groups">
                {[
                  ...e.pools.map((p) => ({
                    key: p.id,
                    label: `Pool ${p.name}`,
                    fixtures: done.filter((f) => f.poolId === p.id),
                  })),
                  ...Object.entries(stageNames)
                    .filter(([stage]) => stage !== "POOL")
                    .map(([stage, label]) => ({
                      key: stage,
                      label,
                      fixtures: done.filter((f) => f.stage === stage),
                    })),
                ]
                  .filter((g) => g.fixtures.length)
                  .map((g) => (
                    <section key={g.key}>
                      <h3>{g.label}</h3>
                      <div className="games-grid">
                        {g.fixtures.map((f) => (
                          <PublicGame key={f.id} e={e} f={f} />
                        ))}
                      </div>
                    </section>
                  ))}
              </div>
            ) : (
              <Empty title="No scores published yet">
                Completed results will appear here. An unplayed game has no
                score; a recorded zero is shown as 0.
              </Empty>
            )}
          </>
        )}
        {view === "playoffs" && (
          <>
            <div className="section-title">
              <div>
                <h2>The road to Champion.</h2>
                <p>
                  {e.knockoutSize} qualifiers · Higher qualification positions
                  receive available byes. Winners follow the next game shown on
                  each card.
                </p>
              </div>
            </div>
            {!e.fixtures.length && (
              <Empty title="The bracket is being prepared">
                Times and teams appear once staff publish the schedule and
                confirm pool results.
              </Empty>
            )}
            <div className="public-bracket dynamic-bracket">
              {[
                ...new Set(
                  e.fixtures
                    .filter((f) => f.stage !== "POOL")
                    .map((f) => f.round),
                ),
              ]
                .sort((a, b) => b - a)
                .map((round) => (
                  <section key={round}>
                    <h3>
                      {round === 1
                        ? "Medal games"
                        : stageNames[
                            e.fixtures.find(
                              (f) => f.stage !== "POOL" && f.round === round,
                            )!.stage
                          ]}
                    </h3>
                    {e.fixtures
                      .filter((f) => f.stage !== "POOL" && f.round === round)
                      .map((f) => (
                        <PublicGame key={f.id} e={e} f={f} progression />
                      ))}
                  </section>
                ))}
            </div>
            <section className="final-outcome">
              <h2>Final tournament outcome</h2>
              {e.placements.length ? (
                <ol className="public-placements">
                  {e.placements.map((p) => (
                    <li className={p.place === 1 ? "winner" : ""} key={p.place}>
                      <strong className="place-number">
                        {String(p.place).padStart(2, "0")}
                      </strong>
                      <div>
                        <strong>{p.name}</strong>
                        <span>
                          {p.place === 1
                            ? "CHAMPION"
                            : p.place === 2
                              ? "RUNNER-UP"
                              : p.place === 3
                                ? "THIRD PLACE"
                                : p.place === 4
                                  ? "FOURTH PLACE"
                                  : "FINAL PLACEMENT"}
                        </span>
                      </div>
                      {p.place === 1 && <Trophy size={28} />}
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty title="Every game brings us closer">
                  Final placements appear after all games are played and event
                  staff sign off the results.
                </Empty>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="public-footer">
        <Brand />
        <span>Astra Experiment #002 · Synthetic teams and players only.</span>
        <Link href="/">All events ↗</Link>
      </footer>
    </div>
  );
}
function PublicGame({
  e,
  f,
  progression = false,
}: {
  e: PublicData;
  f: PublicFixture;
  progression?: boolean;
}) {
  const next = e.fixtures.find(
    (g) =>
      g.homeSource === `Winner ${f.code}` ||
      g.awaySource === `Winner ${f.code}`,
  );
  const sourceLabel = (source: string) =>
    source.replace("Qualifier ", "Playoff slot ") +
    (e.fixtures.some((g) => g.stage === "PLAY_IN") &&
    f.stage !== "PLAY_IN" &&
    /^(Qualifier|Playoff slot) /.test(source)
      ? " (bye)"
      : "");
  const name = (id: string | null, source: string) =>
    e.entries.find((t) => t.id === id)?.name ?? sourceLabel(source);
  const winner = f.result
    ? f.result.homeScore > f.result.awayScore
      ? name(f.homeId, f.homeSource)
      : name(f.awayId, f.awaySource)
    : null;
  return (
    <article
      data-testid={`public-game-${f.code}`}
      className={`game-card public-game ${f.stage === "FINAL" ? "final-game" : ""}`}
    >
      <div className="game-meta">
        <span>{stageLabel(f)}</span>
        <Badge tone={f.result ? "lime" : "neutral"}>
          {f.result
            ? f.result.kind === "WALKOVER"
              ? "WALKOVER"
              : "FINAL SCORE"
            : !f.homeId || !f.awayId
              ? "AWAITING TEAMS"
              : e.resultsPublished
                ? f.status.replaceAll("_", " ")
                : "SCORES NOT PUBLISHED"}
        </Badge>
      </div>
      {progression && (
        <p className="playoff-source">
          {sourceLabel(f.homeSource)} vs {sourceLabel(f.awaySource)}
        </p>
      )}
      <div className="game-place">
        <FixtureTime
          fixture={f}
          timezone={e.timezone}
          eventStart={e.startsAt}
        />
        <span>
          <MapPin size={13} />
          {f.court}
        </span>
      </div>
      <div className="score-display">
        {[
          {
            id: f.homeId,
            source: f.homeSource,
            score: f.result?.homeScore,
          },
          {
            id: f.awayId,
            source: f.awaySource,
            score: f.result?.awayScore,
          },
        ].map(({ id, source, score }, i) => (
          <div
            key={i}
            className={
              f.result &&
              (i === 0
                ? f.result.homeScore > f.result.awayScore
                : f.result.awayScore > f.result.homeScore)
                ? "winning-team"
                : ""
            }
          >
            <span>{name(id, source)}</span>
            <strong aria-label={score === undefined ? "No result" : undefined}>
              {score ?? "—"}
            </strong>
          </div>
        ))}
      </div>
      {progression && !winner && next && (
        <p className="progression-note">Winner → {next.code}</p>
      )}
      {progression && winner && (
        <p className="winner-caption">
          {f.stage === "FINAL"
            ? "Champion"
            : f.stage === "THIRD"
              ? "Third place"
              : `Advances to ${next?.code ?? "next round"}`}
          : <strong>{winner}</strong>
        </p>
      )}
    </article>
  );
}
