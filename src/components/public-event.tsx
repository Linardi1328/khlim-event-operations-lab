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
const tabs = [
  ["overview", "Overview"],
  ["schedule", "Schedule"],
  ["standings", "Standings"],
  ["knockout", "Knockout"],
  ["announcements", "Updates"],
  ["placements", "Final results"],
];
export function PublicEvent({
  event: e,
  view,
}: {
  event: PublicData;
  view: string;
}) {
  const router = useRouter();
  const [court, setCourt] = useState("All courts");
  const done = e.fixtures.filter((f) => f.result).length;
  const pending = e.fixtures.filter((f) => !f.result && f.homeId && f.awayId);
  const games = e.fixtures.filter(
    (f) => court === "All courts" || f.court === court,
  );
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link href="/">
          <Brand />
        </Link>
        <Link className="subtle-link" href="/ops">
          Staff access ↗
        </Link>
      </header>
      <section className="public-hero">
        <div className="hero-court" aria-hidden="true">
          <div />
          <span>3×3</span>
        </div>
        <div className="hero-content">
          <div className="hero-eyebrow">
            <Badge tone="lime">ONE DAY. ALL GAME.</Badge>
            <span>SYNTHETIC TOURNAMENT</span>
          </div>
          <h1>{e.name}</h1>
          <p>{e.overview}</p>
          <div className="hero-meta">
            <span>
              <CalendarIcon />
              {eventDate(e.startsAt)}
            </span>
            <span>
              <MapPin size={16} />
              {e.venue}
            </span>
            <span>
              <Clock3 size={16} />
              09:00–12:15 MYT
            </span>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <strong>08</strong>
            <span>TEAMS</span>
          </div>
          <div>
            <strong>02</strong>
            <span>COURTS</span>
          </div>
          <div>
            <strong>
              {String(done).padStart(2, "0")}
              <small>/16</small>
            </strong>
            <span>GAMES COMPLETE</span>
          </div>
        </div>
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
        <button
          className="icon-button"
          aria-label="Refresh scores"
          onClick={() => router.refresh()}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <main id="main" className="public-main">
        {view === "overview" && (
          <>
            <div className="section-title">
              <div>
                <span className="eyebrow">AROUND THE COURTS</span>
                <h2>
                  {e.placements.length
                    ? "The final whistle."
                    : "Your game-day guide."}
                </h2>
              </div>
              <Badge tone="lime">
                {e.placements.length
                  ? "FINAL RESULTS"
                  : e.schedulePublished
                    ? "SCHEDULE PUBLISHED"
                    : "GETTING READY"}
              </Badge>
            </div>
            {e.placements.length > 0 && (
              <section className="champion">
                <Trophy size={30} />
                <span>TOURNAMENT CHAMPION</span>
                <h2>{e.placements[0].name}</h2>
                <Link href={`/events/${e.slug}?view=placements`}>
                  See all final placements <ArrowUpRight size={17} />
                </Link>
              </section>
            )}
            <div className="public-overview-grid">
              <section>
                <div className="section-title">
                  <h3>Next on court</h3>
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
                      done === 16
                        ? "All games complete"
                        : "Schedule coming soon"
                    }
                  >
                    {done === 16
                      ? "See the final results for the complete tournament order."
                      : "Staff are preparing the team entries and court times."}
                  </Empty>
                )}
              </section>
              <section>
                <div className="section-title">
                  <h3>From the event desk</h3>
                  <Link
                    className="subtle-link"
                    href={`/events/${e.slug}?view=announcements`}
                  >
                    All updates ↗
                  </Link>
                </div>
                <Announcements e={e} limit={2} />
              </section>
            </div>
            <section className="format-strip">
              <div>
                <strong>Pool play</strong>
                <p>
                  2 pools · 4 teams each
                  <br />
                  Everyone plays everyone.
                </p>
              </div>
              <span>→</span>
              <div>
                <strong>Semifinals</strong>
                <p>
                  Top 2 from each pool
                  <br />
                  A1 vs B2 · B1 vs A2
                </p>
              </div>
              <span>→</span>
              <div>
                <strong>The medal games</strong>
                <p>
                  Third-place playoff
                  <br />
                  Then the championship final.
                </p>
              </div>
            </section>
          </>
        )}
        {view === "schedule" && (
          <>
            <div className="section-title">
              <div>
                <h2>Find your next game.</h2>
                <p>
                  All times Malaysia time (MYT). Refresh for the latest updates.
                </p>
              </div>
              <label className="compact-label">
                Court
                <select
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
        {view === "standings" && (
          <>
            <div className="section-title">
              <div>
                <h2>The pool picture.</h2>
                <p>
                  Wins → point difference → points scored → lower seed. Top two
                  advance.
                </p>
              </div>
            </div>
            {e.standings.length ? (
              <div className="two-columns">
                {e.standings.map((p) => (
                  <section key={p.name} className="panel">
                    <div className="section-title">
                      <h3>Pool {p.name}</h3>
                      <Badge tone="lime">TOP 2 ADVANCE</Badge>
                    </div>
                    <StandingsTable rows={p.rows} />
                  </section>
                ))}
              </div>
            ) : (
              <Empty title="Standings are not published yet">
                Check back after staff publish scores and standings.
              </Empty>
            )}
          </>
        )}
        {view === "knockout" && (
          <>
            <div className="section-title">
              <div>
                <h2>The road to first place.</h2>
                <p>Semifinals feed the championship and third-place games.</p>
              </div>
            </div>
            {e.fixtures.length ? (
              <div className="public-bracket">
                <section>
                  <h3>01 / Semifinals</h3>
                  {e.fixtures
                    .filter((f) => f.stage === "SEMIFINAL")
                    .map((f) => (
                      <PublicGame key={f.id} e={e} f={f} />
                    ))}
                </section>
                <section className="medal-column">
                  <h3>02 / Medal games</h3>
                  {e.fixtures
                    .filter((f) => f.stage === "FINAL" || f.stage === "THIRD")
                    .sort((a) => (a.stage === "FINAL" ? -1 : 1))
                    .map((f) => (
                      <PublicGame key={f.id} e={e} f={f} />
                    ))}
                </section>
              </div>
            ) : (
              <Empty title="The bracket is being prepared">
                Qualifiers will appear after all pool games are confirmed.
              </Empty>
            )}
          </>
        )}
        {view === "announcements" && (
          <>
            <div className="section-title">
              <div>
                <h2>From the event desk.</h2>
                <p>
                  Court updates and announcements for everyone at the event.
                </p>
              </div>
            </div>
            <Announcements e={e} />
          </>
        )}
        {view === "placements" && (
          <>
            <div className="section-title">
              <div>
                <h2>The final order.</h2>
                <p>Final placements reviewed and confirmed by event staff.</p>
              </div>
            </div>
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
function CalendarIcon() {
  return <span aria-hidden="true">▦</span>;
}
function PublicGame({
  e,
  f,
}: {
  e: PublicData;
  f: PublicData["fixtures"][number];
}) {
  const name = (id: string | null, source: string) =>
    e.entries.find((t) => t.id === id)?.name ?? source;
  return (
    <article
      className={`game-card public-game ${f.stage === "FINAL" ? "final-game" : ""}`}
    >
      <div className="game-meta">
        <span>
          {f.code === "THIRD"
            ? "THIRD PLACE"
            : f.code === "FINAL"
              ? "CHAMPIONSHIP FINAL"
              : f.code}
        </span>
        <Badge tone={f.result ? "lime" : "neutral"}>
          {f.result
            ? "FINAL SCORE"
            : !f.homeId || !f.awayId
              ? "AWAITING TEAMS"
              : e.resultsPublished
                ? "SCHEDULED"
                : "SCORES HIDDEN"}
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
      <div className="score-display">
        <div
          className={
            f.result && f.result.homeScore > f.result.awayScore
              ? "winning-team"
              : ""
          }
        >
          <span>{name(f.homeId, f.homeSource)}</span>
          <strong>{f.result ? f.result.homeScore : "—"}</strong>
        </div>
        <div
          className={
            f.result && f.result.awayScore > f.result.homeScore
              ? "winning-team"
              : ""
          }
        >
          <span>{name(f.awayId, f.awaySource)}</span>
          <strong>{f.result ? f.result.awayScore : "—"}</strong>
        </div>
      </div>
    </article>
  );
}
function Announcements({ e, limit }: { e: PublicData; limit?: number }) {
  return e.announcements.length ? (
    <div className="public-announcements">
      {e.announcements.slice(0, limit).map((a) => (
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
  ) : (
    <Empty title="No announcements yet">Event updates will appear here.</Empty>
  );
}
