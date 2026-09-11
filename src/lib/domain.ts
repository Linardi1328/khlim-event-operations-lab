export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
    public conflicts: string[] = [],
  ) {
    super(message);
  }
}
export const key = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
export type Team = { id: string; name: string; seed: number | null };
export type Score = {
  homeScore: number;
  awayScore: number;
  kind?: "PLAYED" | "WALKOVER";
};
export type Game = {
  homeId: string | null;
  awayId: string | null;
  result: Score | null;
};
export type Standing = Team & {
  played: number;
  won: number;
  lost: number;
  for: number;
  against: number;
  diff: number;
  average: number;
  averageTotal: number;
  averageGames: number;
  winRatio: number;
  rank: number;
  seedTiebreak: boolean;
};
export function validateScore(
  homeId: string | null,
  awayId: string | null,
  homeScore: number,
  awayScore: number,
) {
  if (!homeId || !awayId || homeId === awayId)
    throw new DomainError("Two distinct, qualified teams are required.");
  if (
    ![homeScore, awayScore].every(
      (s) => Number.isInteger(s) && s >= 0 && s <= 50,
    )
  )
    throw new DomainError("Scores must be whole numbers from 0 to 50.");
  if (homeScore === awayScore)
    throw new DomainError(
      "A game must have a winner. Resolve overtime before confirming.",
    );
}
export function standings(
  teams: Team[],
  games: Game[],
  policy = "FIBA_INSPIRED_V2",
): Standing[] {
  const rows: Standing[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    seed: t.seed,
    played: 0,
    won: 0,
    lost: 0,
    for: 0,
    against: 0,
    diff: 0,
    average: 0,
    averageTotal: 0,
    averageGames: 0,
    winRatio: 0,
    rank: 0,
    seedTiebreak: false,
  }));
  for (const g of games) {
    if (!g.result) continue;
    const h = rows.find((t) => t.id === g.homeId),
      a = rows.find((t) => t.id === g.awayId);
    if (!h || !a)
      throw new DomainError("Result references a team outside this pool.");
    validateScore(g.homeId, g.awayId, g.result.homeScore, g.result.awayScore);
    const homeWins = g.result.homeScore > g.result.awayScore;
    if (
      g.result.kind === "WALKOVER" &&
      !(
        (g.result.homeScore === 21 && g.result.awayScore === 0) ||
        (g.result.homeScore === 0 && g.result.awayScore === 21)
      )
    )
      throw new DomainError("Walkover must be recorded as 21–0 or 0–21.");
    h.played++;
    a.played++;
    h.for += g.result.homeScore;
    h.against += g.result.awayScore;
    a.for += g.result.awayScore;
    a.against += g.result.homeScore;
    if (homeWins) {
      h.won++;
      a.lost++;
    } else {
      a.won++;
      h.lost++;
    }
    for (const [t, points, won] of [
      [h, g.result.homeScore, homeWins],
      [a, g.result.awayScore, !homeWins],
    ] as const) {
      if (g.result.kind === "WALKOVER" && won) continue;
      t.averageTotal += Math.min(points, 21);
      t.averageGames++;
    }
  }
  for (const r of rows) {
    r.diff = r.for - r.against;
    r.average = r.averageGames ? r.averageTotal / r.averageGames : 0;
    r.winRatio = r.played ? r.won / r.played : 0;
  }
  if (policy === "LEGACY_V1") {
    rows.sort(
      (a, b) =>
        b.won - a.won || b.diff - a.diff || b.for - a.for || compareSeed(a, b),
    );
  } else {
    // Resolve equal-win groups using a win-only mini-table. Reapply head-to-head to a smaller tied subgroup.
    const resolve = (group: Standing[]): Standing[] => {
      if (group.length < 2) return group;
      const ids = new Set(group.map((r) => r.id));
      const mini = new Map(group.map((r) => [r.id, 0]));
      for (const g of games)
        if (g.result && ids.has(g.homeId!) && ids.has(g.awayId!)) {
          const winner =
            g.result.homeScore > g.result.awayScore ? g.homeId! : g.awayId!;
          mini.set(winner, mini.get(winner)! + 1);
        }
      const wins = [...new Set(mini.values())].sort((a, b) => b - a);
      if (wins.length > 1)
        return wins.flatMap((w) =>
          resolve(group.filter((r) => mini.get(r.id) === w)),
        );
      for (const r of group)
        r.seedTiebreak = group.some(
          (x) => x.id !== r.id && compareAverage(x, r) === 0,
        );
      return group.sort((a, b) => compareAverage(a, b) || compareSeed(a, b));
    };
    const sorted = [...new Set(rows.map((r) => r.won))]
      .sort((a, b) => b - a)
      .flatMap((w) => resolve(rows.filter((r) => r.won === w)));
    rows.splice(0, rows.length, ...sorted);
  }
  rows.forEach((r, i) => {
    r.rank = i + 1;
    if (policy === "LEGACY_V1")
      r.seedTiebreak = rows.some(
        (x) =>
          x.id !== r.id &&
          x.won === r.won &&
          x.diff === r.diff &&
          x.for === r.for,
      );
  });
  return rows;
}
export function compareSeed(a: Team, b: Team) {
  if (a.seed == null || b.seed == null) return 0;
  if (a.id !== b.id && a.seed === b.seed)
    throw new DomainError(
      "Duplicate event seeds make this tie ambiguous. Review the draw.",
    );
  return a.seed - b.seed;
}
export function compareAverage(a: Standing, b: Standing) {
  return (
    b.averageTotal * (a.averageGames || 1) -
    a.averageTotal * (b.averageGames || 1)
  );
}
export function interPoolCompare(a: Standing, b: Standing) {
  return (
    b.won * (a.played || 1) - a.won * (b.played || 1) ||
    compareAverage(a, b) ||
    compareSeed(a, b)
  );
}
export function qualifiers(rows: Standing[], count = 2) {
  if (
    rows.length < 2 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > rows.length ||
    rows.some((t) => t.played !== rows.length - 1)
  )
    throw new DomainError("Confirm every pool game before qualification.");
  return rows.slice(0, count).map((t) => t.id);
}
export function roundRobin(ids: string[]) {
  if (ids.length < 2 || new Set(ids).size !== ids.length)
    throw new DomainError("A pool requires at least two distinct teams.");
  const rotation: (string | null)[] = [...ids];
  if (rotation.length % 2) rotation.push(null);
  const games: { homeId: string; awayId: string; round: number }[] = [];
  for (let round = 0; round < rotation.length - 1; round++) {
    for (let i = 0; i < rotation.length / 2; i++) {
      const h = rotation[i],
        a = rotation[rotation.length - 1 - i];
      if (h && a) games.push({ homeId: h, awayId: a, round });
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return games;
}
export function outcome(g: Game) {
  if (!g.result || !g.homeId || !g.awayId) return null;
  validateScore(g.homeId, g.awayId, g.result.homeScore, g.result.awayScore);
  return g.result.homeScore > g.result.awayScore
    ? { winner: g.homeId, loser: g.awayId }
    : { winner: g.awayId, loser: g.homeId };
}
export function semifinalPairs(a: string[], b: string[]) {
  return [
    [a[0], b[1]],
    [b[0], a[1]],
  ];
}
export function medalPairs(one: Game, two: Game) {
  const a = outcome(one),
    b = outcome(two);
  return {
    final: [a?.winner ?? null, b?.winner ?? null],
    third: [a?.loser ?? null, b?.loser ?? null],
  };
}
export function validateRoster(players: { name: string; slot: number }[]) {
  const errors: string[] = [];
  if (players.length < 3 || players.length > 4)
    errors.push("A roster needs 3 core players and at most 1 substitute.");
  if (players.some((p) => !p.name.trim() || p.name.length > 80))
    errors.push("Every player needs a name of 1–80 characters.");
  if (new Set(players.map((p) => key(p.name))).size !== players.length)
    errors.push("Duplicate player within one team.");
  if (
    new Set(players.map((p) => p.slot)).size !== players.length ||
    players.some((p) => ![1, 2, 3, 4].includes(p.slot)) ||
    ![1, 2, 3].every((s) => players.some((p) => p.slot === s))
  )
    errors.push("Use core slots 1, 2, 3 and optional substitute slot 4.");
  return errors;
}
