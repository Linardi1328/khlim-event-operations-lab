import { db } from "./db";
import { standings, type Game } from "./domain";
export const eventInclude = {
  pools: { orderBy: { name: "asc" as const } },
  entries: {
    include: { roster: { orderBy: { slot: "asc" as const } } },
    orderBy: { seed: "asc" as const },
  },
  fixtures: {
    include: {
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
    orderBy: { startsAt: "asc" as const },
  },
  announcements: { orderBy: { createdAt: "desc" as const } },
  placements: { include: { entry: true }, orderBy: { place: "asc" as const } },
  actions: {
    include: { staff: { select: { username: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 30,
  },
} as const;
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
    ),
  }));
}
export function eventPhase(e: EventData) {
  return e.placementsConfirmedAt
    ? "Placements confirmed"
    : e.fixtures.some((f) => f.stage === "SEMIFINAL" && f.homeId)
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
          court: f.court,
          startsAt: f.startsAt,
          homeId: f.homeId,
          awayId: f.awayId,
          homeSource: f.homeSource,
          awaySource: f.awaySource,
          result:
            e.resultsPublished && current(f)
              ? {
                  homeScore: current(f)!.homeScore,
                  awayScore: current(f)!.awayScore,
                }
              : null,
        }))
      : [],
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
