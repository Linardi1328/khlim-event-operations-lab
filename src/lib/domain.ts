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
export type Team = { id: string; name: string; seed: number };
export type Score = { homeScore: number; awayScore: number };
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
export function standings(teams: Team[], games: Game[]): Standing[] {
  const rows = teams.map((t) => ({
    id: t.id,
    name: t.name,
    seed: t.seed,
    played: 0,
    won: 0,
    lost: 0,
    for: 0,
    against: 0,
    diff: 0,
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
    h.played++;
    a.played++;
    h.for += g.result.homeScore;
    h.against += g.result.awayScore;
    a.for += g.result.awayScore;
    a.against += g.result.homeScore;
    if (g.result.homeScore > g.result.awayScore) {
      h.won++;
      a.lost++;
    } else {
      a.won++;
      h.lost++;
    }
  }
  for (const r of rows) r.diff = r.for - r.against;
  rows.sort(
    (a, b) =>
      b.won - a.won || b.diff - a.diff || b.for - a.for || a.seed - b.seed,
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
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
export function qualifiers(rows: Standing[]) {
  if (rows.length !== 4 || rows.some((t) => t.played !== 3))
    throw new DomainError(
      "Confirm all six games in each pool before qualification.",
    );
  return rows.slice(0, 2).map((t) => t.id);
}
export function roundRobin(ids: string[]) {
  if (ids.length !== 4 || new Set(ids).size !== 4)
    throw new DomainError("Each pool requires four distinct teams.");
  return [
    [0, 3],
    [1, 2],
    [0, 2],
    [3, 1],
    [0, 1],
    [2, 3],
  ].map(([h, a]) => ({ homeId: ids[h], awayId: ids[a] }));
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
