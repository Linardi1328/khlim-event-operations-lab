import { describe, it, expect } from "vitest";
import {
  roundRobin,
  standings,
  interPoolCompare,
  type Game,
} from "../../src/lib/domain";
import {
  formatSchema,
  formatPreview,
  formatIssues,
  zonedStart,
} from "../../src/lib/competition/format";
import { seededRng, runDraw, seedScore } from "../../src/lib/competition/draw";
import {
  bracketGraph,
  bracketEntrants,
  selectQualifiers,
  resolveGraph,
  type Qualified,
} from "../../src/lib/competition/bracket";
import { planGames, projectSchedule } from "../../src/lib/competition/schedule";
import { inspectCsv, parseCsv } from "../../src/lib/csv";
const teams = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Synthetic ${i + 1}`,
    seed: i + 1,
  }));
const played = (
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
  kind: "PLAYED" | "WALKOVER" = "PLAYED",
): Game => ({ homeId, awayId, result: { homeScore, awayScore, kind } });
const complete = (n: number, offset = 0) => {
  const ts = teams(n).map((t) => ({
    ...t,
    id: `${offset}-${t.id}`,
    seed: t.seed + offset,
  }));
  return standings(
    ts,
    roundRobin(ts.map((t) => t.id)).map((g) =>
      played(g.homeId, g.awayId, 21, 12),
    ),
  );
};
describe("flexible format and fixtures", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32])(
    "round robin of %i has unique pairs and no repeated team within a round",
    (n) => {
      const ids = teams(n).map((t) => t.id),
        games = roundRobin(ids);
      expect(games).toHaveLength((n * (n - 1)) / 2);
      expect(
        new Set(games.map((g) => [g.homeId, g.awayId].sort().join("|"))).size,
      ).toBe(games.length);
      for (const id of ids)
        expect(
          games.filter((g) => g.homeId === id || g.awayId === id),
        ).toHaveLength(n - 1);
      for (const round of new Set(games.map((g) => g.round))) {
        const ids = games
          .filter((g) => g.round === round)
          .flatMap((g) => [g.homeId, g.awayId]);
        expect(new Set(ids).size).toBe(ids.length);
      }
    },
  );
  it.each([
    [8, 2, 4, 12],
    [12, 3, 6, 18],
    [16, 4, 8, 24],
    [18, 4, 8, 32],
    [20, 4, 8, 40],
    [24, 6, 12, 36],
    [32, 8, 16, 48],
  ])(
    "previews %i teams / %i pools",
    (expectedTeams, poolCount, knockoutSize, poolGames) => {
      const f = formatSchema.parse({ expectedTeams, poolCount, knockoutSize });
      expect(formatIssues(f)).toEqual([]);
      expect(formatPreview(f).poolGames).toBe(poolGames);
    },
  );
  it("rejects too few entries, inconsistent qualifiers and oversized local workloads", () => {
    expect(formatIssues(formatSchema.parse({ poolCount: 4 }))).not.toEqual([]);
    expect(
      formatIssues(
        formatSchema.parse({
          expectedTeams: 128,
          poolCount: 1,
          automaticQualifiers: 4,
        }),
      ),
    ).toContain(
      "This local lab supports at most 1,024 pool fixtures. Increase the pool count.",
    );
    expect(formatSchema.safeParse({ courtCount: 0 }).success).toBe(false);
  });
  it("resolves configured wall time and rejects invalid/ambiguous DST dates", () => {
    expect(
      zonedStart("2026-10-10", "10:00", "Asia/Kuala_Lumpur").toISOString(),
    ).toBe("2026-10-10T02:00:00.000Z");
    expect(() => zonedStart("2026-02-30", "10:00", "UTC")).toThrow();
    expect(() =>
      zonedStart("2026-03-08", "02:30", "America/New_York"),
    ).toThrow();
    expect(() =>
      zonedStart("2026-11-01", "01:30", "America/New_York"),
    ).toThrow();
  });
});
describe("FIBA-inspired seed inputs and official draw", () => {
  it("sums the three highest of all eligible roster values including a substitute", () => {
    expect(seedScore([500, 100, 200, 400])).toBe(1100);
    expect(seedScore([0, 0, 0])).toBe(0);
    expect(() => seedScore([1, -1, 2])).toThrow();
  });
  it("reproduces the RNG stream and draw including randomized seed-score ties", () => {
    const a = seededRng("audit"),
      b = seededRng("audit");
    expect(Array.from({ length: 100 }, () => a())).toEqual(
      Array.from({ length: 100 }, () => b()),
    );
    const input = teams(12).map((t) => ({ id: t.id, points: [0, 0, 0] }));
    const d = runDraw(input, 3, "replay-me");
    expect(d).toEqual(runDraw(input, 3, "replay-me"));
    expect(d).not.toEqual(runDraw(input, 3, "different"));
    expect(new Set(d.map((t) => t.tieBreak)).size).toBe(12);
    expect(d.map((t) => t.eventSeed)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });
  it.each([
    [8, 2],
    [12, 3],
    [18, 4],
    [20, 4],
    [24, 5],
    [32, 8],
  ])(
    "balances %i entries in %i pools with one team per complete pot per pool",
    (n, pools) => {
      const d = runDraw(
        teams(n).map((t, i) => ({ id: t.id, points: [i, 0, 0] })),
        pools,
        "stable",
      );
      const counts = Array.from(
        { length: pools },
        (_, i) => d.filter((t) => t.poolIndex === i).length,
      );
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(d.map((t) => t.seedScore)).toEqual(
        Array.from({ length: n }, (_, i) => n - 1 - i),
      );
      for (const pot of new Set(d.map((t) => t.pot))) {
        const entries = d.filter((t) => t.pot === pot);
        expect(new Set(entries.map((t) => t.poolIndex)).size).toBe(
          entries.length,
        );
      }
    },
  );
});
describe("FIBA-inspired standings, distinct from display statistics", () => {
  it("uses head-to-head wins before higher average or displayed difference", () => {
    const r = standings(teams(3), [
      played("t1", "t2", 10, 9),
      played("t1", "t3", 0, 21),
      played("t2", "t3", 21, 0),
    ]);
    expect(r.map((t) => t.id)).toEqual(["t2", "t3", "t1"]); // three-way cycle: average, not PD
    const two = standings(teams(4), [
      played("t1", "t2", 10, 9),
      played("t1", "t3", 0, 21),
      played("t2", "t4", 21, 0),
      played("t3", "t4", 21, 0),
    ]);
    expect(two.findIndex((t) => t.id === "t1")).toBeLessThan(
      two.findIndex((t) => t.id === "t2"),
    );
  });
  it("reapplies a smaller tied head-to-head group", () => {
    const r = standings(teams(4), [
      played("t1", "t2", 10, 9),
      played("t1", "t3", 1, 21),
      played("t2", "t3", 21, 1),
      played("t4", "t1", 21, 1),
      played("t4", "t2", 21, 1),
      played("t3", "t4", 21, 1),
    ]);
    expect(r[0].id).toBe("t3");
    expect(r.findIndex((t) => t.id === "t1")).toBeLessThan(
      r.findIndex((t) => t.id === "t2"),
    );
  });
  it("caps scoring contribution at 21 and uses event seed for a cyclic tie", () => {
    const r = standings(teams(3), [
      played("t1", "t2", 25, 20),
      played("t2", "t3", 21, 20),
      played("t3", "t1", 21, 20),
    ]);
    expect(r.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(r[0]).toMatchObject({
      for: 45,
      average: 20.5,
      averageTotal: 41,
      seedTiebreak: true,
    });
  });
  it("shows walkover 21–0 PF/PA/PD but excludes the winner game from tiebreak average", () => {
    const r = standings(teams(3), [
      played("t1", "t2", 21, 0, "WALKOVER"),
      played("t1", "t3", 10, 11),
    ]);
    expect(r.find((t) => t.id === "t1")).toMatchObject({
      played: 2,
      won: 1,
      for: 31,
      against: 11,
      diff: 20,
      average: 10,
      averageGames: 1,
    });
    expect(r.find((t) => t.id === "t2")).toMatchObject({
      lost: 1,
      average: 0,
      averageGames: 1,
    });
    expect(() =>
      standings(teams(2), [played("t1", "t2", 20, 0, "WALKOVER")]),
    ).toThrow();
  });
  it("uses win ratio for unequal inter-pool comparisons, then capped average, then event seed", () => {
    const a = {
        ...complete(4)[0],
        won: 2,
        played: 3,
        averageTotal: 30,
        averageGames: 3,
      },
      b = {
        ...complete(5, 4)[0],
        won: 2,
        played: 4,
        averageTotal: 84,
        averageGames: 4,
      };
    expect(interPoolCompare(a, b)).toBeLessThan(0);
    expect(interPoolCompare({ ...a, won: 1, played: 2 }, b)).toBeGreaterThan(0);
  });
  it("will not break a remaining tie by duplicate seed, team name or ID", () =>
    expect(() =>
      standings(
        [
          { id: "z", name: "Z", seed: 1 },
          { id: "a", name: "A", seed: 1 },
        ],
        [],
      ),
    ).toThrow("ambiguous"));
});
describe("qualification and bracket graph", () => {
  it("derives top three plus best remaining from unequal completed pools", () => {
    const pools = [
      { id: "A", rows: complete(5) },
      { id: "B", rows: complete(4, 5) },
    ];
    const q = selectQualifiers(pools, 3, 1, 7);
    expect(q).toHaveLength(7);
    expect(q.filter((t) => t.wildcard)).toHaveLength(1);
    expect(q.filter((t) => !t.wildcard && t.poolId === "A")).toHaveLength(3);
    expect(() => selectQualifiers(pools, 3, 2, 7)).toThrow();
  });
  it.each([4, 8, 12, 16, 20, 24, 32])(
    "creates and resolves a %i entrant bracket through arbitrary depth",
    (n) => {
      const nodes = bracketGraph(n, true),
        entrants = new Map(
          Array.from({ length: n }, (_, i) => [i + 1, `team${i + 1}`]),
        ),
        results = new Map<string, Game["result"]>();
      expect(nodes).toHaveLength(n);
      for (const node of nodes) {
        const g = resolveGraph(nodes, entrants, results).get(node.code)!;
        expect(g.homeId).toBeTruthy();
        expect(g.awayId).toBeTruthy();
        expect(g.homeId).not.toBe(g.awayId);
        results.set(node.code, { homeScore: 21, awayScore: 10 });
      }
      expect(
        resolveGraph(nodes, entrants, results).get("FINAL")!.result,
      ).not.toBeNull();
      expect(nodes.filter((n) => n.stage === "THIRD")).toHaveLength(1);
    },
  );
  it("gives the top four of twelve byes into the quarterfinals, no fake bye scores", () => {
    const nodes = bracketGraph(12, false);
    expect(nodes.filter((n) => n.stage === "PLAY_IN")).toHaveLength(4);
    expect(nodes).toHaveLength(11);
    const opening = nodes
      .filter((n) => n.stage === "PLAY_IN")
      .flatMap((n) => [n.home, n.away]);
    expect(
      opening.every((s) => s.kind === "QUALIFIER" && s.qualifierRank > 4),
    ).toBe(true);
  });
  it("avoids first-round same-pool matchups by deterministic opponent matching", () => {
    const q = teams(8).map((t, i) => ({
      ...complete(4)[0],
      ...t,
      poolId: i < 4 ? "A" : "B",
      poolRank: (i % 4) + 1,
      qualificationRank: i + 1,
      wildcard: false,
    })) as Qualified[];
    const graph = bracketGraph(8);
    const slots = bracketEntrants(q, graph);
    for (const g of resolveGraph(graph, slots, new Map()).values())
      if (g.homeId && g.awayId)
        expect(q.find((t) => t.id === g.homeId)!.poolId).not.toBe(
          q.find((t) => t.id === g.awayId)!.poolId,
        );
    expect(slots).toEqual(bracketEntrants(q, graph));
  });
});
describe("planned vs projected scheduling", () => {
  const policy = {
      courtCount: 2,
      slotMinutes: 15,
      restMinutes: 10,
      turnaroundMinutes: 2,
    },
    start = new Date("2026-10-10T02:00:00Z");
  const games = planGames(
    roundRobin(teams(5).map((t) => t.id)).map((g, i) => ({
      ...g,
      id: String(i),
      stage: "POOL",
    })),
    start,
    policy,
  ).map((g) => ({ ...g, actualStart: null, actualEnd: null }));
  it("respects court turnaround and player rest in the original planned schedule", () => {
    for (const g of games) {
      const earlier = games.filter((f) => f.startsAt < g.startsAt);
      for (const f of earlier) {
        if (g.court === f.court)
          expect(
            g.startsAt.getTime() - f.startsAt.getTime(),
          ).toBeGreaterThanOrEqual(17 * 60000);
        if ([g.homeId, g.awayId].some((t) => [f.homeId, f.awayId].includes(t)))
          expect(
            g.startsAt.getTime() - f.startsAt.getTime(),
          ).toBeGreaterThanOrEqual(25 * 60000);
      }
    }
  });
  it("propagates late actual finish and a court delay without mutating planned times", () => {
    const before = games.map((g) => g.startsAt.toISOString());
    const observed = games.map((g, i) =>
      i === 0
        ? {
            ...g,
            completed: true,
            actualStart: g.startsAt,
            actualEnd: new Date(g.startsAt.getTime() + 40 * 60000),
          }
        : g,
    );
    const p = projectSchedule(observed, policy);
    expect(p.some((g) => g.proposed > g.previous)).toBe(true);
    const delayed = projectSchedule(games, policy, {
      court: "Court 1",
      minutes: 12,
    });
    expect(delayed[0].proposed.getTime() - delayed[0].previous.getTime()).toBe(
      12 * 60000,
    );
    expect(games.map((g) => g.startsAt.toISOString())).toEqual(before);
  });
});
describe("deterministic flexible CSV normalization", () => {
  it("maps aliases, arbitrary order and extra columns in long format", () => {
    const csv =
      "irrelevant, FIBA Ranking Points , SQUAD , ATHLETE\nx,12,Black,One\nx,,Black,Two\nx,35,Black,Three";
    const p = parseCsv(csv);
    expect(p.errors).toEqual([]);
    expect(p.rows.map((r) => [r.slot, r.fibaPoints])).toEqual([
      [1, 12],
      [2, 0],
      [3, 35],
    ]);
    expect(p.ignored).toEqual(["irrelevant"]);
    expect(p.rows[0]).toMatchObject({ line: 2, playerColumn: "ATHLETE" });
  });
  it("normalizes wide format, optional substitutes and source columns", () => {
    const csv =
      "Team Name,Player 3,Player 1 points,Player 1,Player 2,Player 2 points,Substitute,Substitute points\nBlack,Three,40,One,Two,20,Four,99";
    const p = parseCsv(csv);
    expect(p.errors).toEqual([]);
    expect(p.rows.map((r) => r.fibaPoints)).toEqual([40, 20, 0, 99]);
    expect(new Set(p.rows.map((r) => r.line))).toEqual(new Set([2]));
  });
  it("blocks ambiguous aliases until staff explicitly map them", () => {
    const csv =
      "team,squad,athlete\nBlack,Ignore,One\nBlack,Ignore,Two\nBlack,Ignore,Three";
    expect(inspectCsv(csv).ambiguities).toHaveLength(1);
    expect(parseCsv(csv).errors[0]).toContain("Ambiguous");
    expect(
      parseCsv(csv, { layout: "long", team: "team", player: "athlete" }).errors,
    ).toEqual([]);
  });
  it("stops unknown layouts, conflicting fields and malformed wide rosters", () => {
    expect(parseCsv("x,y\nA,B").errors.length).toBeGreaterThan(0);
    expect(
      parseCsv("team,player\nA,B", {
        layout: "long",
        team: "team",
        player: "team",
      }).errors[0],
    ).toContain("multiple");
    expect(
      parseCsv("team,player1,player2,player3\nA,B,B,C").errors.join(),
    ).toContain("Duplicate player");
  });
});
