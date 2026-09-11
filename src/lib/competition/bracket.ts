import {
  DomainError,
  interPoolCompare,
  qualifiers,
  outcome,
  type Standing,
  type Game,
} from "../domain";
export type Qualified = Standing & {
  poolId: string;
  poolRank: number;
  qualificationRank: number;
  wildcard: boolean;
};
export function selectQualifiers(
  pools: { id: string; rows: Standing[] }[],
  automatic: number,
  wildcards: number,
  field: number,
): Qualified[] {
  if (pools.length * automatic + wildcards !== field)
    throw new DomainError("Inconsistent qualification policy.");
  for (const p of pools) qualifiers(p.rows, automatic);
  const all = pools.flatMap((p) =>
    p.rows.map((r) => ({
      ...r,
      poolId: p.id,
      poolRank: r.rank,
      qualificationRank: 0,
      wildcard: r.rank > automatic,
    })),
  );
  const direct = all
    .filter((r) => !r.wildcard)
    .sort((a, b) => a.poolRank - b.poolRank || interPoolCompare(a, b));
  const remaining = all
    .filter((r) => r.wildcard)
    .sort(interPoolCompare)
    .slice(0, wildcards);
  if (direct.length + remaining.length !== field)
    throw new DomainError("Not enough eligible wildcard entries.");
  return [...direct, ...remaining].map((r, i) => ({
    ...r,
    qualificationRank: i + 1,
  }));
}
export type Source =
  | { kind: "QUALIFIER"; qualifierRank: number }
  | { kind: "WINNER" | "LOSER"; sourceCode: string };
export type BracketNode = {
  code: string;
  stage:
    | "PLAY_IN"
    | "ROUND32"
    | "ROUND16"
    | "QUARTERFINAL"
    | "SEMIFINAL"
    | "FINAL"
    | "THIRD";
  round: number;
  home: Source;
  away: Source;
};
export const stageNames: Record<string, string> = {
  POOL: "Pool play",
  PLAY_IN: "Play-in",
  ROUND32: "Round of 32",
  ROUND16: "Round of 16",
  QUARTERFINAL: "Quarterfinals",
  SEMIFINAL: "Semifinals",
  THIRD: "Third-place game",
  FINAL: "Final",
};
function seedPositions(capacity: number): number[] {
  let p = [1, 2];
  for (let size = 4; size <= capacity; size *= 2)
    p = p.flatMap((n) => [n, size + 1 - n]);
  return p;
}
export function bracketGraph(count: number, thirdPlace = true): BracketNode[] {
  if (
    !Number.isInteger(count) ||
    count < 2 ||
    count > 32 ||
    (count < 4 && thirdPlace)
  )
    throw new DomainError(
      "Knockout field must be 2–32; third place needs four qualifiers.",
    );
  const capacity = 2 ** Math.ceil(Math.log2(count));
  let slots: (Source | null)[] = seedPositions(capacity).map((rank) =>
    rank <= count ? { kind: "QUALIFIER", qualifierRank: rank } : null,
  );
  const nodes: BracketNode[] = [];
  for (let size = capacity; size >= 2; size /= 2) {
    const round = Math.log2(size),
      next: Source[] = [];
    const stage =
      size === capacity && count !== capacity
        ? "PLAY_IN"
        : size === 32
          ? "ROUND32"
          : size === 16
            ? "ROUND16"
            : size === 8
              ? "QUARTERFINAL"
              : size === 4
                ? "SEMIFINAL"
                : "FINAL";
    for (let i = 0; i < slots.length; i += 2) {
      const home = slots[i],
        away = slots[i + 1];
      if (!home || !away) {
        next.push((home ?? away)!);
        continue;
      }
      const prefix = {
        PLAY_IN: "PI",
        ROUND32: "R32",
        ROUND16: "R16",
        QUARTERFINAL: "QF",
        SEMIFINAL: "SF",
        FINAL: "FINAL",
      }[stage];
      const code = size === 2 ? "FINAL" : `${prefix}-${i / 2 + 1}`;
      nodes.push({ code, stage, round, home, away });
      next.push({ kind: "WINNER", sourceCode: code });
    }
    slots = next;
  }
  if (thirdPlace) {
    const semis = nodes.filter((n) => n.round === 2);
    nodes.push({
      code: "THIRD",
      stage: "THIRD",
      round: 1,
      home: { kind: "LOSER", sourceCode: semis[0].code },
      away: { kind: "LOSER", sourceCode: semis[1].code },
    });
  }
  return nodes;
}
// Preserve the best qualifiers' byes and high-half positions. Match low-half opponents
// deterministically; augmenting paths find a complete non-rematch assignment when one exists.
export function bracketEntrants(qualified: Qualified[], nodes: BracketNode[]) {
  const slots = new Map(qualified.map((q) => [q.qualificationRank, q.id]));
  const first = nodes.filter(
    (n) => n.home.kind === "QUALIFIER" && n.away.kind === "QUALIFIER",
  );
  const pairs = first.map((n) => ({
    high: Math.min(
      (n.home as { qualifierRank: number }).qualifierRank,
      (n.away as { qualifierRank: number }).qualifierRank,
    ),
    low: Math.max(
      (n.home as { qualifierRank: number }).qualifierRank,
      (n.away as { qualifierRank: number }).qualifierRank,
    ),
  }));
  const byRank = new Map(qualified.map((q) => [q.qualificationRank, q]));
  const assigned = new Map<number, number>();
  function match(high: number, seen: Set<number>): boolean {
    const original = pairs.find((p) => p.high === high)!.low;
    const candidates = pairs
      .map((p) => p.low)
      .sort((a, b) => Number(b === original) - Number(a === original) || b - a);
    for (const low of candidates)
      if (
        !seen.has(low) &&
        byRank.get(high)!.poolId !== byRank.get(low)!.poolId
      ) {
        seen.add(low);
        const old = assigned.get(low);
        if (old === undefined || match(old, seen)) {
          assigned.set(low, high);
          return true;
        }
      }
    return false;
  }
  for (const p of pairs) match(p.high, new Set());
  const matchedHigh = new Set(assigned.values());
  const leftoverLow = pairs.map((p) => p.low).filter((l) => !assigned.has(l));
  for (const p of pairs)
    if (!matchedHigh.has(p.high)) assigned.set(leftoverLow.shift()!, p.high);
  for (const [low, high] of assigned)
    slots.set(pairs.find((p) => p.high === high)!.low, byRank.get(low)!.id);
  return slots;
}
export function resolveGraph(
  nodes: BracketNode[],
  entrants: Map<number, string>,
  results: Map<string, Game["result"]>,
) {
  const games = new Map<string, Game>();
  const resolve = (s: Source) =>
    s.kind === "QUALIFIER"
      ? (entrants.get(s.qualifierRank) ?? null)
      : (outcome(
          games.get(s.sourceCode) ?? {
            homeId: null,
            awayId: null,
            result: null,
          },
        )?.[s.kind === "WINNER" ? "winner" : "loser"] ?? null);
  for (const n of nodes)
    games.set(n.code, {
      homeId: resolve(n.home),
      awayId: resolve(n.away),
      result: results.get(n.code) ?? null,
    });
  return games;
}
