import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { seed } from "../../prisma/seed";
import { command } from "../../src/lib/service";
import { getEvent, publicProjection } from "../../src/lib/query";
import { makeEvent, register, ready, score } from "../helpers";
let staffId: string;
const ids: string[] = [];
async function event() {
  const e = await makeEvent(staffId, "V1 integration");
  ids.push(e.id);
  return e;
}
beforeAll(async () => {
  await seed();
  staffId = (
    await db.staff.findUniqueOrThrow({ where: { username: "event.staff" } })
  ).id;
});
afterAll(async () => {
  await db.event.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
describe("V2 draw setup and public projection (supersedes manual V1 pools)", () => {
  it("atomically records draw inputs/assignments and protects explicit redraw versions", async () => {
    const e = await event();
    await register(staffId, e.id);
    await expect(
      command(staffId, e.id, {
        action: "runDraw",
        confirmed: true,
        expectedDrawVersion: null,
      }),
    ).rejects.toThrow("Confirm");
    for (const t of (await getEvent(e.id))!.entries)
      await command(staffId, e.id, { action: "confirmEntry", entryId: t.id });
    await expect(
      command(staffId, e.id, { action: "assignPools", assignments: [] }),
    ).rejects.toThrow("Manual");
    const attempts = await Promise.allSettled(
      [1, 2].map(() =>
        command(staffId, e.id, {
          action: "runDraw",
          confirmed: true,
          expectedDrawVersion: null,
        }),
      ),
    );
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const first = (await getEvent(e.id))!.draws[0];
    expect(first.entries).toHaveLength(8);
    expect(first.entries.every((t) => t.players.length === 4)).toBe(true);
    await expect(
      command(staffId, e.id, {
        action: "runDraw",
        confirmed: true,
        expectedDrawVersion: 1,
      }),
    ).rejects.toThrow("reason");
    await command(staffId, e.id, {
      action: "runDraw",
      confirmed: true,
      expectedDrawVersion: 1,
      reason: "Publicly witnessed synthetic redraw.",
    });
    const state = (await getEvent(e.id))!;
    expect(state.draws.map((d) => d.status)).toEqual(["ACTIVE", "SUPERSEDED"]);
    expect(state.draws[1].entries).toEqual(first.entries);
    const t = state.entries[0];
    const players = t.roster.map((p) => ({
      name: p.name,
      slot: p.slot,
      fibaPoints: p.fibaPoints,
    }));
    await expect(
      command(staffId, e.id, {
        action: "saveEntry",
        entryId: t.id,
        name: t.name,
        players,
        synthetic: true,
        pool: "A",
        seed: 1,
      }),
    ).rejects.toThrow();
    await command(staffId, e.id, {
      action: "saveEntry",
      entryId: t.id,
      name: t.name,
      players,
      synthetic: true,
    });
    const invalidated = (await getEvent(e.id))!;
    expect(invalidated.draws[0].status).toBe("INVALIDATED");
    expect(
      invalidated.entries.every((t) => t.poolId === null && t.seed === null),
    ).toBe(true);
    expect(invalidated.draws[0].entries).toEqual(state.draws[0].entries);
  });
  it("blocks malformed composition and dangerous redraw after scheduling", async () => {
    const e = await event();
    await ready(staffId, e.id);
    await score(staffId, e.id, "A-1", 0, 1);
    const before = (await getEvent(e.id))!;
    await expect(
      command(staffId, e.id, {
        action: "runDraw",
        confirmed: true,
        expectedDrawVersion: 1,
        reason: "Cannot redraw after play.",
      }),
    ).rejects.toThrow("locked");
    expect((await getEvent(e.id))!.fixtures).toEqual(before.fixtures);
    const other = await event();
    await register(staffId, other.id);
    for (const t of (await getEvent(other.id))!.entries)
      await command(staffId, other.id, {
        action: "confirmEntry",
        entryId: t.id,
      });
    await command(staffId, other.id, {
      action: "runDraw",
      confirmed: true,
      expectedDrawVersion: null,
    });
    const drawn = (await getEvent(other.id))!;
    const t = drawn.entries.find((t) => t.poolId === drawn.pools[0].id)!;
    await db.teamEntry.update({
      where: { id: t.id },
      data: { poolId: drawn.pools[1].id },
    });
    await expect(
      command(staffId, other.id, { action: "generateFixtures" }),
    ).rejects.toThrow("composition");
    expect((await getEvent(other.id))!.fixtures).toHaveLength(0);
  });
  it("staff can remove/add a substitute and edit players; invalid rosters never replace valid entries", async () => {
    const e = await event();
    await register(staffId, e.id);
    const t = (await getEvent(e.id))!.entries[0];
    const base = {
      action: "saveEntry",
      entryId: t.id,
      name: t.name,
      synthetic: true,
    };
    const core = t.roster
      .filter((p) => p.slot <= 3)
      .map(({ name, slot }) => ({ name, slot }));
    await command(staffId, e.id, { ...base, players: core });
    expect((await getEvent(e.id))!.entries[0].roster).toHaveLength(3);
    const four = [
      ...core.map((p, i) =>
        i === 0 ? { ...p, name: "Synthetic Revised Core" } : p,
      ),
      { name: "Synthetic New Substitute", slot: 4 },
    ];
    await command(staffId, e.id, { ...base, players: four });
    const saved = (await getEvent(e.id))!.entries[0];
    expect(saved.roster.map((p) => p.name)).toContain("Synthetic Revised Core");
    expect(saved.roster).toHaveLength(4);
    for (const players of [
      core.slice(0, 2),
      [...four, { name: "Fifth", slot: 4 }],
      four.map((p, i) => (i === 1 ? { ...p, name: four[0].name } : p)),
    ]) {
      await expect(
        command(staffId, e.id, { ...base, players }),
      ).rejects.toThrow();
      expect((await getEvent(e.id))!.entries[0].roster).toEqual(saved.roster);
    }
  });
  it("exposes only public fields, exactly two pools, and distinguishes unpublished, missing and zero results", async () => {
    const e = await event();
    await ready(staffId, e.id);
    await score(staffId, e.id, "A-1", 0, 1);
    await command(staffId, e.id, {
      action: "publish",
      field: "schedulePublished",
      value: true,
    });
    let pub = publicProjection((await getEvent(e.id))!);
    expect(pub.fixtures.every((f) => f.result === null)).toBe(true);
    await command(staffId, e.id, {
      action: "publish",
      field: "resultsPublished",
      value: true,
    });
    pub = publicProjection((await getEvent(e.id))!);
    expect(pub.pools.map((p) => p.name)).toEqual(["A", "B"]);
    for (const p of pub.pools)
      expect(pub.entries.filter((t) => t.poolId === p.id)).toHaveLength(4);
    expect(pub.fixtures.find((f) => f.code === "A-1")!.result).toEqual({
      homeScore: 0,
      awayScore: 1,
      kind: "PLAYED",
    });
    expect(pub.fixtures.find((f) => f.code === "A-2")!.result).toBeNull();
    for (const t of pub.entries)
      expect(Object.keys(t).sort()).toEqual(["id", "name", "poolId", "seed"]);
    for (const f of pub.fixtures)
      expect(Object.keys(f).sort()).toEqual([
        "actualEnd",
        "actualStart",
        "awayId",
        "awaySource",
        "code",
        "court",
        "homeId",
        "homeSource",
        "id",
        "poolId",
        "projectedStartsAt",
        "result",
        "round",
        "stage",
        "startsAt",
        "status",
      ]);
    for (const p of pub.standings)
      for (const row of p.rows)
        expect(Object.keys(row).sort()).toEqual([
          "against",
          "average",
          "averageGames",
          "averageTotal",
          "diff",
          "for",
          "id",
          "lost",
          "name",
          "played",
          "rank",
          "seed",
          "seedTiebreak",
          "winRatio",
          "won",
        ]);
    expect(JSON.stringify(pub)).not.toMatch(
      /roster|staff|password|checkedIn|confirmedAt|Synthetic Black|recordedAt|previousCorrections|nameKey|fibaPoints|seedScore|provenance|rngSeed|drawEntries/,
    );
  });
});
