import { DomainError } from "../domain";
export const DRAW_VERSION = "TOP3_POTS_MULBERRY32_V1";
export const SEEDING_VERSION = "TOP_THREE_IMPORTED_FIBA_POINTS_V1";
// Server creates a cryptographically random seed. This generator is for replay, not secrets.
export function seededRng(seed: string) {
  let state = 2166136261;
  for (const c of seed)
    state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(input: T[], random: () => number) {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function seedScore(points: number[]) {
  if (
    points.length < 3 ||
    points.length > 4 ||
    points.some((p) => !Number.isInteger(p) || p < 0 || p > 100_000_000)
  )
    throw new DomainError(
      "Ranking points must be whole nonnegative values (up to 100 million), for three or four players.",
    );
  return [...points]
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((a, b) => a + b, 0);
}
export type DrawTeam = { id: string; points: number[] };
export function runDraw(teams: DrawTeam[], poolCount: number, seed: string) {
  if (
    teams.length < poolCount * 2 ||
    new Set(teams.map((t) => t.id)).size !== teams.length ||
    !seed
  )
    throw new DomainError(
      "Draw needs distinct teams and at least two in every pool.",
    );
  const random = seededRng(seed);
  const ranked = shuffle(teams, random)
    .map((t, i) => ({
      id: t.id,
      seedScore: seedScore(t.points),
      tieBreak: i + 1,
    }))
    .sort((a, b) => b.seedScore - a.seedScore || a.tieBreak - b.tieBreak)
    .map((t, i) => ({
      ...t,
      eventSeed: i + 1,
      pot: Math.floor(i / poolCount) + 1,
      poolIndex: -1,
    }));
  for (let start = 0; start < ranked.length; start += poolCount) {
    const pot = shuffle(ranked.slice(start, start + poolCount), random);
    const pools = shuffle(
      Array.from({ length: poolCount }, (_, i) => i),
      random,
    );
    pot.forEach((t, i) => {
      t.poolIndex = pools[i];
    });
  }
  return ranked;
}
