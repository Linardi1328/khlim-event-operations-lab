import { describe, it, expect } from "vitest";
import {
  roundRobin,
  standings,
  qualifiers,
  semifinalPairs,
  medalPairs,
  validateScore,
  validateRoster,
  outcome,
} from "../../src/lib/domain";
import { parseCsv, validateImport } from "../../src/lib/csv";
const teams = ["a", "b", "c", "d"].map((id, i) => ({
  id,
  name: id,
  seed: i + 1,
}));
describe("benchmark tournament domain", () => {
  it("creates six unique matches per pool, each team plays three", () => {
    const games = roundRobin(teams.map((t) => t.id));
    expect(games).toHaveLength(6);
    expect(
      new Set(games.map((g) => [g.homeId, g.awayId].sort().join(""))).size,
    ).toBe(6);
    for (const t of teams)
      expect(
        games.filter((g) => [g.homeId, g.awayId].includes(t.id)),
      ).toHaveLength(3);
    expect(() => roundRobin(["a", "a", "b", "c"])).toThrow();
  });
  it("counts wins, losses, point difference and points scored", () => {
    const rows = standings(teams, [
      { homeId: "a", awayId: "b", result: { homeScore: 18, awayScore: 16 } },
    ]);
    expect(rows[0]).toMatchObject({
      id: "a",
      played: 1,
      won: 1,
      lost: 0,
      for: 18,
      against: 16,
      diff: 2,
    });
    expect(rows.find((t) => t.id === "b")).toMatchObject({ lost: 1, diff: -2 });
  });
  it("breaks ties by difference, then points scored, then visible seed", () => {
    const differenceFirst = standings(teams, [
      { homeId: "a", awayId: "b", result: { homeScore: 12, awayScore: 1 } },
      { homeId: "c", awayId: "d", result: { homeScore: 21, awayScore: 20 } },
    ]);
    expect(differenceFirst[0].id).toBe("a");
    const result = standings(teams, [
      { homeId: "a", awayId: "b", result: { homeScore: 10, awayScore: 5 } },
      { homeId: "c", awayId: "d", result: { homeScore: 15, awayScore: 10 } },
    ]);
    expect(result.map((t) => t.id)).toEqual(["c", "a", "d", "b"]);
    const tied = standings(teams, []);
    expect(tied.map((t) => t.seed)).toEqual([1, 2, 3, 4]);
    expect(tied.every((t) => t.seedTiebreak)).toBe(true);
  });
  it("requires a complete pool before qualifiers and crosses A1/B2, B1/A2", () => {
    expect(() => qualifiers(standings(teams, []))).toThrow();
    const rows = standings(
      teams,
      roundRobin(teams.map((t) => t.id)).map((g) => ({
        ...g,
        result: { homeScore: 21, awayScore: 10 },
      })),
    );
    expect(qualifiers(rows)).toEqual(rows.slice(0, 2).map((t) => t.id));
    expect(semifinalPairs(["a", "b"], ["c", "d"])).toEqual([
      ["a", "d"],
      ["c", "b"],
    ]);
  });
  it("propagates winners and losers to medal games", () => {
    expect(
      medalPairs(
        { homeId: "a", awayId: "b", result: { homeScore: 0, awayScore: 1 } },
        { homeId: "c", awayId: "d", result: { homeScore: 21, awayScore: 10 } },
      ),
    ).toEqual({ final: ["b", "c"], third: ["a", "d"] });
    expect(outcome({ homeId: "a", awayId: "b", result: null })).toBeNull();
  });
  it.each([
    [-1, 4],
    [1.2, 4],
    [5, 5],
    [51, 10],
    [NaN, 5],
  ])("rejects invalid scores %s %s", (h, a) => {
    expect(() => validateScore("a", "b", h, a)).toThrow();
  });
  it("rejects self matches and absent participants", () => {
    expect(() => validateScore("a", "a", 1, 0)).toThrow();
    expect(() => validateScore(null, "b", 1, 0)).toThrow();
  });
  it("distinguishes zero from absent results", () => {
    expect(
      standings(teams, [{ homeId: "a", awayId: "b", result: null }])[0].played,
    ).toBe(0);
    const rows = standings(teams, [
      { homeId: "a", awayId: "b", result: { homeScore: 0, awayScore: 1 } },
    ]);
    expect(rows.find((r) => r.id === "a")).toMatchObject({
      played: 1,
      lost: 1,
      for: 0,
    });
  });
  it("enforces roster size, core slots and normalized uniqueness", () => {
    const p = [1, 2, 3].map((slot) => ({ slot, name: `Synthetic ${slot}` }));
    expect(validateRoster(p)).toEqual([]);
    expect(validateRoster([...p, { slot: 4, name: "Sub" }])).toEqual([]);
    expect(validateRoster(p.slice(0, 2))).not.toEqual([]);
    expect(
      validateRoster([
        ...p,
        { slot: 4, name: "Sub" },
        { slot: 5, name: "Extra" },
      ]),
    ).not.toEqual([]);
    expect(
      validateRoster([
        { slot: 1, name: " Alpha " },
        { slot: 2, name: "alpha" },
        { slot: 3, name: "B" },
      ]),
    ).toContain("Duplicate player within one team.");
  });
});
const valid =
  "team,player,pool,seed,slot\nBlack,Synthetic One,A,1,1\nBlack,Synthetic Two,A,1,2\nBlack,Synthetic Three,A,1,3";
describe("CSV validation", () => {
  it("parses and previews a valid roster", () => {
    expect(parseCsv(valid).errors).toEqual([]);
    expect(parseCsv(valid).rows).toHaveLength(3);
  });
  it("supports explicit mapping, BOM, CRLF and quoted fields", () => {
    const text =
      '\uFEFFClub,Person,Group,Priority,Position\r\n"Black, Lab",One,A,1,1\r\n"Black, Lab",Two,A,1,2\r\n"Black, Lab",Three,A,1,3';
    expect(
      parseCsv(text, {
        team: "Club",
        player: "Person",
        pool: "Group",
        seed: "Priority",
        slot: "Position",
      }).errors,
    ).toEqual([]);
  });
  it.each([
    ["missing team", valid.replace("Black,Synthetic One", ",Synthetic One")],
    ["missing player", valid.replace("Synthetic One", "")],
    ["too many", valid + "\nBlack,Four,A,1,4\nBlack,Five,A,1,5"],
    ["duplicate player", valid.replace("Synthetic Two", "Synthetic One")],
    ["conflicting rows", valid.replace("Synthetic Two,A", "Synthetic Two,B")],
    ["malformed row", valid + "\nshort,row"],
    ["malformed quotes", valid + '\n"broken'],
    ["missing headers", "hello\nworld"],
  ])("rejects %s", (_label, csv) =>
    expect(parseCsv(csv).errors.length).toBeGreaterThan(0),
  );
  it("detects existing team and player conflicts", () => {
    expect(
      validateImport(parseCsv(valid).rows, [
        { name: "black", seed: 4, players: [] },
      ]).join(" "),
    ).toContain("duplicate team entry");
    expect(
      validateImport(parseCsv(valid).rows, [
        { name: "Other", seed: 2, players: ["Synthetic One"] },
      ]).join(" "),
    ).toContain("conflicts");
  });
});
