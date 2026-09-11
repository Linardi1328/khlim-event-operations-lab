import type { Prisma } from "../generated/prisma/client";
import { db } from "./db";
import { selectQualifiers } from "./competition/bracket";
import { standings, type Game } from "./domain";
export const eventInclude = {
  draws: {
    orderBy: { version: "desc" as const },
    include: {
      staff: { select: { username: true } },
      entries: {
        orderBy: { inputOrder: "asc" as const },
        include: { players: true },
      },
    },
  },
  recoveryProposals: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    include: { staff: { select: { username: true } }, items: true },
  },
  pools: { orderBy: { name: "asc" as const } },
  entries: {
    include: { roster: { orderBy: { slot: "asc" as const } } },
    orderBy: [
      { seed: "asc" as const },
      { createdAt: "asc" as const },
      { id: "asc" as const },
    ],
  },
  fixtures: {
    include: {
      sources: true,
      timings: {
        orderBy: { createdAt: "desc" as const },
        include: { staff: { select: { username: true } } },
      },
      results: {
        orderBy: { recordedAt: "desc" as const },
        include: {
          staff: { select: { username: true } },
          previousCorrections: {
            include: { staff: { select: { username: true } } },
          },
        },
      },
    },
    orderBy: [
      { startsAt: "asc" as const },
      { court: "asc" as const },
      { code: "asc" as const },
    ],
  },
  announcements: { orderBy: { createdAt: "desc" as const } },
  placements: { include: { entry: true }, orderBy: { place: "asc" as const } },
  actions: {
    include: { staff: { select: { username: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 30,
  },
} satisfies Prisma.EventInclude;
export async function getEvent(id: string) {
  return db.event.findUnique({ where: { id }, include: eventInclude });
}
export type EventData = NonNullable<Awaited<ReturnType<typeof getEvent>>>;
export const current = (f: EventData["fixtures"][number]) =>
  f.results.find((r) => r.status === "CONFIRMED") ?? null;
export const game = (f: EventData["fixtures"][number]): Game => ({
  homeId: f.homeId,
  awayId: f.awayId,
  result: current(f),
});
export function poolTables(e: EventData) {
  return e.pools.map((p) => ({
    ...p,
    rows: standings(
      e.entries.filter((t) => t.poolId === p.id),
      e.fixtures.filter((f) => f.poolId === p.id).map(game),
      e.standingsVersion,
    ),
  }));
}
export function eventPhase(e: EventData) {
  return e.placementsConfirmedAt
    ? "Placements confirmed"
    : e.fixtures.some((f) => f.stage !== "POOL" && f.homeId)
      ? "Knockout stage"
      : e.fixtures.length
        ? "Pool play"
        : "Registration";
}
export function publicProjection(e: EventData) {
  return {
    id: e.id,
    name: e.name,
    slug: e.slug,
    startsAt: e.startsAt,
    timezone: e.timezone,
    courtCount: e.courtCount,
    automaticQualifiers: e.automaticQualifiers,
    wildcardCount: e.wildcardCount,
    knockoutSize: e.knockoutSize,
    thirdPlace: e.thirdPlace,
    standingsVersion: e.standingsVersion,
    drawComplete:
      e.draws.some((d) => d.status === "ACTIVE") || e.fixtures.length > 0,
    venue: e.venue,
    overview: e.overview,
    schedulePublished: e.schedulePublished,
    resultsPublished: e.resultsPublished,
    entries: e.entries.map(({ id, name, seed, poolId }) => ({
      id,
      name,
      seed,
      poolId,
    })),
    pools: e.pools.map(({ id, name }) => ({ id, name })),
    fixtures: e.schedulePublished
      ? e.fixtures.map((f) => ({
          id: f.id,
          code: f.code,
          stage: f.stage,
          poolId: f.poolId,
          round: f.round,
          status:
            !e.resultsPublished && ["COMPLETED", "WALKOVER"].includes(f.status)
              ? "AWAITING_SCORE_PUBLICATION"
              : f.status,
          projectedStartsAt: f.projectedStartsAt,
          actualStart: f.actualStart,
          actualEnd: f.actualEnd,
          court: f.court,
          startsAt: f.startsAt,
          homeId: f.homeId,
          awayId: f.awayId,
          homeSource: f.homeSource,
          awaySource: f.awaySource,
          result:
            e.resultsPublished && current(f)
              ? {
                  kind: current(f)!.kind,
                  homeScore: current(f)!.homeScore,
                  awayScore: current(f)!.awayScore,
                }
              : null,
        }))
      : [],
    qualifiedIds: e.resultsPublished ? qualification(e).map((q) => q.id) : [],
    standings: e.resultsPublished
      ? poolTables(e).map((p) => ({ name: p.name, rows: p.rows }))
      : [],
    announcements: e.announcements
      .filter((a) => a.published)
      .map(({ id, text, createdAt }) => ({ id, text, createdAt })),
    placements:
      e.resultsPublished && e.placementsConfirmedAt
        ? e.placements.map((p) => ({ place: p.place, name: p.entry.name }))
        : [],
  };
}

export function qualification(e: EventData) {
  const tables = poolTables(e);
  if (
    !e.fixtures.length ||
    tables.some(
      (p) =>
        p.rows.length < 2 ||
        p.rows.some((r) => r.played !== p.rows.length - 1 || r.seed == null),
    )
  )
    return [];
  return selectQualifiers(
    tables,
    e.automaticQualifiers,
    e.wildcardCount,
    e.knockoutSize,
  );
}
