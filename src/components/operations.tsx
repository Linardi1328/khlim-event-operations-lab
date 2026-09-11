"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  Users,
  Upload,
  CalendarDays,
  BarChart3,
  Trophy,
  Radio,
  History,
  ArrowUpRight,
  Check,
  LayoutDashboard,
  MapPin,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { EventData } from "@/lib/query";
import type { Qualified } from "@/lib/competition/bracket";
import type { Standing } from "@/lib/domain";
import type { Serialized } from "@/lib/display";
import { eventDate, eventTime, stamp } from "@/lib/display";
import {
  Badge,
  Brand,
  Button,
  Empty,
  Feedback,
  SignOut,
  useRequest,
} from "./ui";
import { Teams } from "./teams";
import { ImportTeams } from "./import-teams";
import { Games } from "./games";
import { formatIssues, formatPreview } from "@/lib/competition/format";
import { StandingsTable } from "./standings";
export type EventDTO = Serialized<EventData>;
export type DeskProps = {
  event: EventDTO;
  tables: { name: string; rows: Standing[] }[];
  qualified: Qualified[];
  phase: string;
  view: string;
  username: string;
};
export const resultOf = (f: EventDTO["fixtures"][number]) =>
  f.results.find((r) => r.status === "CONFIRMED") ?? null;
export const teamName = (
  e: EventDTO,
  id: string | null,
  fallback = "To be determined",
) => e.entries.find((t) => t.id === id)?.name ?? fallback;
const sections = [
  ["overview", "Overview", LayoutDashboard],
  ["teams", "Teams & check-in", Users],
  ["import", "CSV import", Upload],
  ["schedule", "Schedule & scores", CalendarDays],
  ["standings", "Pool standings", BarChart3],
  ["knockout", "Knockout & placements", Trophy],
  ["publish", "Public event", Radio],
  ["history", "Activity & corrections", History],
] as const;
export function OperationsDesk({
  event: e,
  tables,
  qualified,
  phase,
  view,
  username,
}: DeskProps) {
  const router = useRouter();
  const completed = e.fixtures.filter(resultOf).length;
  return (
    <div className="ops-shell">
      <aside className="sidebar">
        <Link href="/ops">
          <Brand />
        </Link>
        <div className="sidebar-event">
          <span className="eyebrow">CURRENT EVENT</span>
          <strong>{e.name}</strong>
          <span>{eventDate(e.startsAt, e.timezone)}</span>
        </div>
        <nav aria-label="Event operations">
          {sections.map(([id, label, Icon]) => (
            <Link
              className={view === id ? "active" : ""}
              key={id}
              href={`/ops/${e.id}?view=${id}`}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {id === "teams" && (
                <span className="nav-count">{e.entries.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Badge tone="lime">SYNTHETIC LAB</Badge>
          <p>
            Astra Experiment #002
            <br />
            Local event operations
          </p>
          <Link href="/ops">← All events</Link>
        </div>
      </aside>
      <div className="ops-body">
        <header className="ops-topbar">
          <span className="breadcrumb">
            Operations <span>/</span>{" "}
            {sections.find((s) => s[0] === view)?.[1] ?? "Overview"}
          </span>
          <div className="header-actions">
            <span className="staff-dot" />
            <span className="staff-name">{username}</span>
            <SignOut />
          </div>
        </header>
        <main id="main" className="ops-main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {eventDate(e.startsAt, e.timezone)} · 3×3 BASKETBALL
              </div>
              <h1>
                {view === "overview"
                  ? "Game day, under control."
                  : (sections.find((s) => s[0] === view)?.[1] ??
                    "Event operations")}
              </h1>
              <p>
                {e.name} <span className="dot-separator">·</span>{" "}
                <MapPin size={14} /> {e.venue}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button"
                aria-label="Refresh event"
                onClick={() => router.refresh()}
              >
                <RefreshCw size={17} />
              </button>
              {e.public && (
                <Link
                  className="button secondary"
                  href={`/events/${e.slug}`}
                  target="_blank"
                >
                  Public event <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          </div>
          <div className="event-status">
            <span>
              <span className="status-dot" />
              {phase}
            </span>
            <span>
              {completed} / {e.fixtures.length} games complete{" "}
              <span className="status-divider">|</span> {e.timezone}
            </span>
          </div>
          {view === "overview" && <Overview e={e} completed={completed} />}
          {view === "teams" && <Teams event={e} />}{" "}
          {view === "import" && <ImportTeams event={e} />}
          {view === "schedule" && <Games event={e} knockout={false} />}{" "}
          {view === "standings" && (
            <section className="stack">
              <div className="notice">
                Top {e.automaticQualifiers} in each pool + {e.wildcardCount}{" "}
                best remaining qualify after all pool results.{" "}
                {e.standingsVersion === "LEGACY_V1"
                  ? "Legacy event: wins → difference → points → original seed."
                  : "Order: wins → head-to-head wins → average points (cap 21, walkover wins excluded) → event seed. Across pools: win ratio → average → seed."}
              </div>
              <div className="two-columns">
                {tables.map((p) => (
                  <section className="panel" key={p.name}>
                    <div className="section-title">
                      <h2>Pool {p.name}</h2>
                      <Badge tone="lime">
                        TOP {e.automaticQualifiers} ADVANCE
                      </Badge>
                    </div>
                    <StandingsTable
                      rows={p.rows}
                      automatic={e.automaticQualifiers}
                    />
                  </section>
                ))}
              </div>
            </section>
          )}
          {view === "standings" && (
            <section className="panel">
              <h2>Playoff qualifiers</h2>
              {qualified.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Qualification order</th>
                        <th>Team</th>
                        <th>Pool finish</th>
                        <th>Route</th>
                        <th>Win ratio</th>
                        <th>Average</th>
                        <th>Event seed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualified.map((q) => (
                        <tr key={q.id}>
                          <td>{q.qualificationRank}</td>
                          <th scope="row">{q.name}</th>
                          <td>
                            {e.pools.find((p) => p.id === q.poolId)?.name}
                            {q.poolRank}
                          </td>
                          <td>{q.wildcard ? "Best remaining" : "Automatic"}</td>
                          <td>
                            {q.won}/{q.played}
                          </td>
                          <td>{q.average.toFixed(2)}</td>
                          <td>{q.seed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>
                  Confirm all pool results to determine automatic and
                  best-remaining qualifiers.
                </p>
              )}
              <p className="table-note">
                Byes favor this order. Opening opponents can be rearranged
                within the lower half to avoid a same-pool rematch.
              </p>
            </section>
          )}
          {view === "knockout" && (
            <>
              <Games event={e} knockout />
              <Placements e={e} />
            </>
          )}
          {view === "publish" && <Publish e={e} />}{" "}
          {view === "history" && <HistoryView e={e} />}
          <footer className="ops-footer">
            <span>KHLIM LABS · SYNTHETIC DATA ONLY</span>
            <span>Durable facts. Better game days.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Overview({ e, completed }: { e: EventDTO; completed: number }) {
  const r = useRequest();
  const count = e.entries.length,
    draw = e.draws.some((d) => d.status === "ACTIVE"),
    preview = formatPreview(e, count),
    total = e.fixtures.length || preview.poolGames + preview.knockoutGames;
  const poolGames = e.fixtures.filter((f) => f.stage === "POOL"),
    poolDone = poolGames.length > 0 && poolGames.every(resultOf);
  const confirmed = e.entries.filter((t) => t.confirmedAt).length,
    checked = e.entries.filter((t) => t.checkedInAt).length,
    players = e.entries.flatMap((t) => t.roster),
    present = players.filter((p) => p.checkedInAt).length;
  const ready =
    draw &&
    !formatIssues(e, count).length &&
    confirmed === count &&
    checked === count &&
    e.entries.every((t) =>
      t.roster.filter((p) => p.slot <= 3).every((p) => p.checkedInAt),
    );
  const steps = [
    {
      label: "Register, confirm & run official draw",
      done: count > 0 && confirmed === count && draw,
      detail: `${confirmed} of ${count} entries confirmed · ${draw ? "draw saved" : "draw required"}`,
      view: "teams",
    },
    {
      label: "Check in teams & core players",
      done: ready,
      detail: `${checked} teams · ${present} players present`,
      view: "teams",
    },
    {
      label: "Create & publish the schedule",
      done: e.schedulePublished,
      detail: e.fixtures.length
        ? "Fixtures created"
        : `${preview.poolGames} pool games + ${preview.knockoutGames} playoff games`,
      view: "schedule",
    },
    {
      label: "Complete pool play",
      done: poolDone,
      detail: "Standings determine the playoff field",
      view: "standings",
    },
    {
      label: "Play knockouts & confirm placements",
      done: !!e.placementsConfirmedAt,
      detail: `${completed} of ${total} results confirmed`,
      view: "knockout",
    },
    {
      label: "Publish the final results",
      done: !!e.placementsConfirmedAt && e.resultsPublished && e.public,
      detail: "Make the complete event available publicly",
      view: "publish",
    },
  ];
  return (
    <>
      <div className="stats-grid">
        {[
          [
            "Teams registered",
            `${count}`,
            `${confirmed} entries confirmed`,
            Users,
          ],
          [
            "Players checked in",
            `${present}/${players.length}`,
            `${checked} of ${count} teams present`,
            Check,
          ],
          [
            "Games complete",
            `${completed}/${total}`,
            `${Math.max(total - completed, 0)} games remaining`,
            Activity,
          ],
          [
            "Event courts",
            String(e.courtCount),
            `${e.slotMinutes}-minute slots · ${e.restMinutes}-minute rest`,
            MapPin,
          ],
        ].map(([label, value, detail, Icon]) => {
          const I = Icon as typeof Users;
          return (
            <div className="stat" key={String(label)}>
              <div className="stat-label">
                {String(label)}
                <I size={17} />
              </div>
              <strong>{String(value)}</strong>
              <span>{String(detail)}</span>
            </div>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">EVENT WORKFLOW</span>
              <h2>The road to the final</h2>
            </div>
            <Badge>{steps.filter((s) => s.done).length}/6 READY</Badge>
          </div>
          <ol className="workflow">
            {steps.map((s, i) => (
              <li key={s.label}>
                <span className={`step-number ${s.done ? "done" : ""}`}>
                  {s.done ? (
                    <Check size={16} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <div>
                  <strong>{s.label}</strong>
                  <p>{s.detail}</p>
                </div>
                <Link
                  aria-label={`Open ${s.label}`}
                  href={`/ops/${e.id}?view=${s.view}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
        <div className="stack">
          <section className="attention-card">
            <span className="eyebrow">NEXT AT THE DESK</span>
            <h2>
              {!e.fixtures.length
                ? "Get everyone court-ready."
                : !poolDone
                  ? "Keep the scores moving."
                  : completed < total
                    ? "The bracket is taking shape."
                    : "Review the final order."}
            </h2>
            <p>
              {!e.fixtures.length
                ? "Confirm eligible rosters, run the official draw, then check in every team and their three core players."
                : !poolDone
                  ? "Confirm each game once the score is agreed. Standings update with every result."
                  : "Review knockout results and sign off the final placements."}
            </p>
            <Link
              className="button"
              href={`/ops/${e.id}?view=${!e.fixtures.length ? "teams" : !poolDone ? "schedule" : "knockout"}`}
            >
              {!e.fixtures.length
                ? "Open team check-in"
                : "Continue operations"}{" "}
              <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="panel">
            <h2>Needs attention</h2>
            <ul className="attention-list">
              {e.entries.length < e.expectedTeams && (
                <li>
                  {e.expectedTeams - e.entries.length} fewer entries than
                  planned. Draw uses actual registrations.
                </li>
              )}
              {confirmed < count && (
                <li>{count - confirmed} entries awaiting confirmation.</li>
              )}
              {!ready && !e.fixtures.length && (
                <li>Core player check-in must finish before scheduling.</li>
              )}
              {!e.public && <li>Event overview is hidden from the public.</li>}
              {e.fixtures.length > 0 && !e.schedulePublished && (
                <li>Fixtures are ready but the schedule is unpublished.</li>
              )}
              {completed === total && !e.placementsConfirmedAt && (
                <li>Final placements need staff sign-off.</li>
              )}
              {ready && e.schedulePublished && (
                <li className="muted">
                  No registration or scheduling blockers.
                </li>
              )}
            </ul>
            {!e.fixtures.length && (
              <Button
                busy={r.busy}
                disabled={!ready}
                onClick={() =>
                  r.run(
                    `/api/events/${e.id}/command`,
                    { action: "generateFixtures" },
                    "Fixtures created. Publish the schedule next.",
                  )
                }
              >
                Generate fixtures
              </Button>
            )}
            <Feedback request={r} />
          </section>
        </div>
      </div>
    </>
  );
}
function Placements({ e }: { e: EventDTO }) {
  const r = useRequest();
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Final placements</h2>
          <p>Review every result before signing off the final order.</p>
        </div>
        <Button
          busy={r.busy}
          disabled={
            !e.fixtures.length ||
            e.fixtures.some((f) => !resultOf(f)) ||
            !!e.placementsConfirmedAt
          }
          onClick={() =>
            r.run(
              `/api/events/${e.id}/command`,
              { action: "confirmPlacements" },
              "Placements confirmed. Publish results in Public event.",
            )
          }
        >
          {e.placementsConfirmedAt
            ? "Placements confirmed"
            : "Confirm final placements"}
        </Button>
      </div>
      <Feedback request={r} />
      {e.placements.length ? (
        <ol className="placement-list">
          {e.placements.map((p) => (
            <li key={p.id}>
              <span>{String(p.place).padStart(2, "0")}</span>
              <strong>{p.entry.name}</strong>
              <Badge tone={p.place === 1 ? "lime" : "neutral"}>
                {p.place === 1
                  ? "CHAMPION"
                  : p.place <= 4
                    ? "KNOCKOUT"
                    : "POOL PLACEMENT"}
              </Badge>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">
          Medal games determine the podium. Remaining places compare elimination
          round, pool finish, then inter-pool ranking (win ratio, average
          points, seed). Any score correction withdraws the sign-off until
          reviewed again.
        </p>
      )}
    </section>
  );
}
function Publish({ e }: { e: EventDTO }) {
  const r = useRequest();
  const [text, setText] = useState("");
  return (
    <div className="two-columns">
      <section className="panel">
        <h2>Publication controls</h2>
        <p>
          Choose what visitors can see. Public views never include roster or
          staff data.
        </p>
        {(
          [
            [
              "public",
              "Event overview",
              "Makes the event page available without sign-in.",
            ],
            [
              "schedulePublished",
              "Schedule & bracket",
              "Shows court times and qualified participants.",
            ],
            [
              "resultsPublished",
              "Scores & standings",
              "Includes final placements after staff sign-off.",
            ],
          ] as const
        ).map(([field, label, detail]) => (
          <div className="publication-row" key={field}>
            <div>
              <strong>{label}</strong>
              <p>{detail}</p>
            </div>
            <Button
              className={e[field] ? "secondary" : "primary"}
              busy={r.busy}
              onClick={() =>
                r.run(`/api/events/${e.id}/command`, {
                  action: "publish",
                  field,
                  value: !e[field],
                })
              }
            >
              {e[field] ? `Unpublish ${label}` : `Publish ${label}`}
            </Button>
          </div>
        ))}
        <Feedback request={r} />
        {e.public && (
          <Link href={`/events/${e.slug}`} className="subtle-link">
            Open public event ↗
          </Link>
        )}
      </section>
      <section className="panel">
        <h2>Event announcements</h2>
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (
              await r.run(
                `/api/events/${e.id}/command`,
                { action: "announce", text },
                "Announcement published.",
              )
            )
              setText("");
          }}
        >
          <label>
            Announcement
            <textarea
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              maxLength={500}
              required
              placeholder="Court update, check-in reminder, or a note for the crowd…"
            />
          </label>
          <Button busy={r.busy}>Publish announcement</Button>
        </form>
        <div className="announcement-list">
          {e.announcements.map((a) => (
            <article key={a.id}>
              <div className="announcement-meta">
                <Clock3 size={13} />
                {eventTime(a.createdAt)}{" "}
                <Badge>{a.published ? "PUBLIC" : "HIDDEN"}</Badge>
              </div>
              <p>{a.text}</p>
              <button
                className="link-button"
                disabled={r.busy}
                onClick={() =>
                  r.run(`/api/events/${e.id}/command`, {
                    action: "toggleAnnouncement",
                    announcementId: a.id,
                    published: !a.published,
                  })
                }
              >
                {a.published ? "Hide announcement" : "Publish announcement"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
function HistoryView({ e }: { e: EventDTO }) {
  return (
    <div className="stack">
      <section className="panel">
        <h2>Result revision history</h2>
        <p>
          Original scores remain available. Voided results no longer count
          toward the event.
        </p>
        {e.fixtures.some((f) => f.results.length) ? (
          e.fixtures
            .filter((f) => f.results.length)
            .map((f) => (
              <details key={f.id} className="history-game">
                <summary>
                  {f.code} · {f.results.length} result revision
                  {f.results.length > 1 ? "s" : ""}
                </summary>
                {f.results.map((r) => (
                  <div className="history-record" key={r.id}>
                    <Badge tone={r.status === "CONFIRMED" ? "lime" : "amber"}>
                      {r.status} · {r.kind}
                    </Badge>
                    <strong>
                      {teamName(e, r.homeId)} {r.homeScore} — {r.awayScore}{" "}
                      {teamName(e, r.awayId)}
                    </strong>
                    <p>
                      {r.staff.username} · {stamp(r.recordedAt)}
                    </p>
                    {r.previousCorrections.map((c) => (
                      <p key={c.id} className="correction-note">
                        {c.replacementId ? "Replaced" : "Voided"} by{" "}
                        {c.staff.username} · {stamp(c.createdAt)}
                        <br />
                        {c.reason}
                      </p>
                    ))}
                  </div>
                ))}
              </details>
            ))
        ) : (
          <Empty title="No results recorded">
            Confirmed scores and correction history will appear here.
          </Empty>
        )}
      </section>
      <section className="panel">
        <h2>Actual timing observations</h2>
        <p>
          Earlier observations remain in history after a timing correction or
          authorized replay.
        </p>
        {e.fixtures
          .filter((f) => f.timings.length)
          .map((f) => (
            <details className="history-game" key={f.id}>
              <summary>
                {f.code} · {f.timings.length} observations
              </summary>
              {f.timings.map((t) => (
                <article key={t.id} className="history-record">
                  <strong>
                    {stamp(t.startedAt, e.timezone)} →{" "}
                    {t.endedAt
                      ? stamp(t.endedAt, e.timezone)
                      : "End not observed"}
                  </strong>
                  <p>{t.reason}</p>
                  <small>
                    {t.staff.username} · recorded{" "}
                    {stamp(t.createdAt, e.timezone)}
                  </small>
                </article>
              ))}
            </details>
          ))}
      </section>
      <section className="panel">
        <h2>Recent operator activity</h2>
        <p>The 30 most recent actions. Full history persists in PostgreSQL.</p>
        <div className="activity-list">
          {e.actions.map((a) => (
            <article key={a.id}>
              <Badge>{a.kind.replaceAll("_", " ")}</Badge>
              <p>{a.detail}</p>
              <small>
                {a.staff.username} · {stamp(a.createdAt)}
              </small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
