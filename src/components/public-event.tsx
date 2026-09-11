"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  MapPin,
  RefreshCw,
  Megaphone,
  Trophy,
} from "lucide-react";
import type { publicProjection } from "@/lib/query";
import type { Serialized } from "@/lib/display";
import { eventDate, eventTime } from "@/lib/display";
import { Brand, Badge, Empty } from "./ui";
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
const playoffSlots = [
  { code: "SF-1", label: "Semifinal 1", home: "A1", away: "B2" },
  { code: "SF-2", label: "Semifinal 2", home: "B1", away: "A2" },
  {
    code: "THIRD",
    label: "Third-place game",
    home: "Loser of Semifinal 1",
    away: "Loser of Semifinal 2",
  },
  {
    code: "FINAL",
    label: "Final",
    home: "Winner of Semifinal 1",
    away: "Winner of Semifinal 2",
  },
];
function stageLabel(f: PublicFixture) {
  return (
    playoffSlots.find((s) => s.code === f.code)?.label ??
    `Pool ${f.code.split("-")[0]} · Game ${f.code.split("-")[1]}`
  );
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
  const pending = e.fixtures.filter((f) => !f.result && f.homeId && f.awayId);
  const games = e.fixtures.filter(
    (f) => court === "All courts" || f.court === court,
  );
  // Only published facts inform the public status; hidden results never leak here.
  const status = e.placements.length
    ? "Tournament complete"
    : done.length === 16
      ? "Final review"
      : done.some((f) => f.stage !== "POOL") ||
          (e.resultsPublished &&
            e.fixtures.some((f) => f.stage === "SEMIFINAL" && f.homeId))
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
                <span>▦ {eventDate(e.startsAt)}</span>
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
                <small>/{e.fixtures.length || 16}</small>
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
                      done.length === 16
                        ? "All games complete"
                        : e.schedulePublished
                          ? "Next teams to be confirmed"
                          : "Schedule coming soon"
                    }
                  >
                    {done.length === 16
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
                    <small>Pool A or Pool B · Four teams each</small>
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
                    <small>Top two in each pool advance</small>
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
                          {eventDate(a.createdAt)} · {eventTime(a.createdAt)}
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
                  Each team plays the other three teams in its pool. Top two
                  advance to the semifinals.
                </p>
              </div>
            </div>
            <div className="two-columns public-pools">
              {e.pools.map((p) => {
                const entries = e.entries.filter((t) => t.poolId === p.id);
                return (
                  <section
                    className="panel public-pool"
                    key={p.id}
                    aria-label={`Pool ${p.name}`}
                  >
                    <div className="section-title">
                      <h3>Pool {p.name}</h3>
                      <Badge>{entries.length}/4 teams</Badge>
                    </div>
                    {entries.length ? (
                      <ul>
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
                    ) : (
                      <p>Teams to be announced.</p>
                    )}
                  </section>
                );
              })}
            </div>
            {e.standings.length > 0 && (
              <details className="pool-standings">
                <summary>Pool standings & qualification</summary>
                <p>
                  Wins → point difference → points scored → lower seed priority.
                  Top two advance after all pool games.
                </p>
                <div className="two-columns">
                  {e.standings.map((p) => (
                    <section className="panel" key={p.name}>
                      <h3>Pool {p.name} standings</h3>
                      <StandingsTable rows={p.rows} />
                    </section>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        {view === "schedule" && (
          <>
            <div className="section-title">
              <div>
                <h2>Find your next game.</h2>
                <p>{eventDate(e.startsAt)} · All times Malaysia time (MYT).</p>
              </div>
              <label className="compact-label">
                Court
                <select
                  aria-label="Court"
                  value={court}
                  onChange={(ev) => setCourt(ev.target.value)}
                >
                  <option>All courts</option>
                  <option>Court 1</option>
                  <option>Court 2</option>
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
                {["Pool A", "Pool B", "Semifinals", "Medal games"].map(
                  (group, index) => {
                    const fixtures = done.filter((f) =>
                      index < 2
                        ? f.stage === "POOL" &&
                          f.code.startsWith(index === 0 ? "A-" : "B-")
                        : index === 2
                          ? f.stage === "SEMIFINAL"
                          : f.stage === "FINAL" || f.stage === "THIRD",
                    );
                    return (
                      fixtures.length > 0 && (
                        <section key={group}>
                          <h3>{group}</h3>
                          <div className="games-grid">
                            {fixtures.map((f) => (
                              <PublicGame key={f.id} e={e} f={f} />
                            ))}
                          </div>
                        </section>
                      )
                    );
                  },
                )}
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
                  A1 and B1 are the pool winners; A2 and B2 are the runners-up.
                </p>
              </div>
            </div>
            {!e.fixtures.length && (
              <Empty title="The bracket is being prepared">
                Times and teams appear once staff publish the schedule and
                confirm pool results.
              </Empty>
            )}
            <div className="public-bracket">
              {[0, 1].map((round) => (
                <section key={round}>
                  <h3>
                    {round === 0 ? "01 / Semifinals" : "02 / Medal games"}
                  </h3>
                  {round === 1 && (
                    <p className="progression-note">
                      Winners → Final · Losing teams → Third-place game
                    </p>
                  )}
                  {playoffSlots.slice(round * 2, round * 2 + 2).map((slot) => {
                    const fixture = e.fixtures.find(
                      (f) => f.code === slot.code,
                    );
                    return fixture ? (
                      <PublicGame
                        key={slot.code}
                        e={e}
                        f={fixture}
                        progression
                      />
                    ) : (
                      <article
                        className="game-card public-game playoff-placeholder"
                        key={slot.code}
                      >
                        <h4>{slot.label}</h4>
                        <p>
                          {slot.home} <span>vs</span> {slot.away}
                        </p>
                        <small>Awaiting published schedule</small>
                      </article>
                    );
                  })}
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
                                  : "POOL PLACEMENT"}
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
  const slot = playoffSlots.find((s) => s.code === f.code);
  const name = (id: string | null, source: string) =>
    e.entries.find((t) => t.id === id)?.name ?? source;
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
            ? "FINAL SCORE"
            : !f.homeId || !f.awayId
              ? "AWAITING TEAMS"
              : e.resultsPublished
                ? "SCHEDULED"
                : "SCORES NOT PUBLISHED"}
        </Badge>
      </div>
      {progression && slot && (
        <p className="playoff-source">
          {slot.home} vs {slot.away}
        </p>
      )}
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
      <div className="score-display">
        {[
          {
            id: f.homeId,
            source: slot?.home ?? f.homeSource,
            score: f.result?.homeScore,
          },
          {
            id: f.awayId,
            source: slot?.away ?? f.awaySource,
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
      {progression && winner && (
        <p className="winner-caption">
          {f.stage === "SEMIFINAL"
            ? "To the Final"
            : f.stage === "FINAL"
              ? "Final winner"
              : "Third place"}
          : <strong>{winner}</strong>
        </p>
      )}
    </article>
  );
}
