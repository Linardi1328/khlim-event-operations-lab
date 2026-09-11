import { DomainError } from "../domain";
export type SchedulingPolicy = {
  courtCount: number;
  slotMinutes: number;
  restMinutes: number;
  turnaroundMinutes: number;
};
export type ScheduledGame = {
  id: string;
  court: string;
  startsAt: Date;
  projectedStartsAt: Date;
  actualStart: Date | null;
  actualEnd: Date | null;
  homeId: string | null;
  awayId: string | null;
  round: number;
  stage: string;
  completed?: boolean;
};
const minute = 60_000;
export function planGames<
  T extends {
    id: string;
    homeId: string | null;
    awayId: string | null;
    round: number;
    stage: string;
  },
>(games: T[], start: Date, policy: SchedulingPolicy) {
  const courtEnd = Array(policy.courtCount).fill(
    start.getTime() - policy.turnaroundMinutes * minute,
  ) as number[];
  const teamEnd = new Map<string, number>();
  let barrier = start.getTime();
  let lastGroup = "POOL";
  const result: (T & {
    court: string;
    startsAt: Date;
    projectedStartsAt: Date;
  })[] = [];
  for (const g of games) {
    const group = g.stage === "POOL" ? "POOL" : `ROUND-${g.round}`;
    if (group !== lastGroup) {
      barrier = Math.max(...courtEnd) + policy.restMinutes * minute;
      lastGroup = group;
    }
    const teamReady = Math.max(
      barrier,
      ...[g.homeId, g.awayId].map((id) =>
        id
          ? (teamEnd.get(id) ?? start.getTime() - policy.restMinutes * minute) +
            policy.restMinutes * minute
          : barrier,
      ),
    );
    const available = courtEnd.map((end) =>
      Math.max(teamReady, end + policy.turnaroundMinutes * minute),
    );
    const time = Math.min(...available),
      court = available.indexOf(time),
      end = time + policy.slotMinutes * minute;
    courtEnd[court] = end;
    for (const id of [g.homeId, g.awayId]) if (id) teamEnd.set(id, end);
    result.push({
      ...g,
      court: `Court ${court + 1}`,
      startsAt: new Date(time),
      projectedStartsAt: new Date(time),
    });
  }
  return result;
}
export function projectSchedule(
  games: ScheduledGame[],
  policy: SchedulingPolicy,
  delay?: { court: string; minutes: number },
) {
  if (
    delay &&
    (!Number.isInteger(delay.minutes) ||
      delay.minutes < 0 ||
      delay.minutes > 720 ||
      !games.some((g) => g.court === delay.court))
  )
    throw new DomainError(
      "Select an event court and a delay of 0–720 minutes.",
    );
  const ordered = [...games].sort(
    (a, b) =>
      a.startsAt.getTime() - b.startsAt.getTime() ||
      a.court.localeCompare(b.court),
  );
  const courtEnd = new Map<string, number>(),
    teamEnd = new Map<string, number>();
  const roundEnd = new Map<string, number>();
  let delayed = false;
  return ordered.map((g) => {
    const stage = g.stage === "POOL" ? "POOL" : `ROUND-${g.round}`;
    const upstream =
      g.stage === "POOL"
        ? 0
        : Math.max(
            roundEnd.get("POOL") ?? 0,
            ...[...roundEnd]
              .filter(
                ([k]) => k.startsWith("ROUND-") && Number(k.slice(6)) > g.round,
              )
              .map(([, end]) => end),
          ) +
          policy.restMinutes * minute;
    let at = Math.max(
      g.startsAt.getTime(),
      g.projectedStartsAt.getTime(),
      upstream,
      (courtEnd.get(g.court) ?? 0) + policy.turnaroundMinutes * minute,
      ...[g.homeId, g.awayId].map((id) =>
        id ? (teamEnd.get(id) ?? 0) + policy.restMinutes * minute : 0,
      ),
    );
    if (
      delay &&
      !delayed &&
      delay.court === g.court &&
      !g.actualStart &&
      !g.completed
    ) {
      at += delay.minutes * minute;
      delayed = true;
    }
    // Observations are facts. Recovery changes only unstarted games.
    if (g.actualStart || g.completed)
      at = g.actualStart?.getTime() ?? g.projectedStartsAt.getTime();
    const end = g.actualEnd?.getTime() ?? at + policy.slotMinutes * minute;
    courtEnd.set(g.court, Math.max(courtEnd.get(g.court) ?? 0, end));
    for (const id of [g.homeId, g.awayId])
      if (id) teamEnd.set(id, Math.max(teamEnd.get(id) ?? 0, end));
    roundEnd.set(stage, Math.max(roundEnd.get(stage) ?? 0, end));
    return {
      fixtureId: g.id,
      previous: g.projectedStartsAt,
      proposed: new Date(
        g.actualStart || g.completed ? g.projectedStartsAt : at,
      ),
    };
  });
}
