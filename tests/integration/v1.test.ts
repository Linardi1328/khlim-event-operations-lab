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
async function assignments(eventId: string) {
  const e = (await getEvent(eventId))!;
  return e.entries.map((t) => ({
    entryId: t.id,
    pool: e.pools.find((p) => p.id === t.poolId)!.name,
    expectedPool: e.pools.find((p) => p.id === t.poolId)!.name,
  }));
}
describe("V1 setup and public projection", () => {
  it("atomically swaps full pools, retains attendance, rejects invalid/foreign/duplicate and stale assignments", async () => {
    const e = await event();
    await register(staffId, e.id);
    const original = await assignments(e.id);
    const swap = original.map((a, i) => ({
      ...a,
      pool: i === 0 ? "B" : i === 4 ? "A" : a.pool,
    }));
    await command(staffId, e.id, {
      action: "confirmEntry",
      entryId: original[0].entryId,
    });
    await command(staffId, e.id, {
      action: "checkIn",
      entryId: original[0].entryId,
      checked: true,
    });
    const before = (await getEvent(e.id))!;
    for (const invalid of [
      original.map((a, i) => (i === 0 ? { ...a, pool: "B" } : a)),
      original.map((a, i) => (i === 0 ? original[1] : a)),
      original.map((a, i) =>
        i === 0 ? { ...a, entryId: "foreign-entry" } : a,
      ),
    ]) {
      await expect(
        command(staffId, e.id, { action: "assignPools", assignments: invalid }),
      ).rejects.toThrow();
      expect(await assignments(e.id)).toEqual(original);
    }
    await command(staffId, e.id, { action: "assignPools", assignments: swap });
    const after = (await getEvent(e.id))!;
    expect(after.entries[0].roster).toEqual(before.entries[0].roster);
    expect(after.entries[0].checkedInAt).toEqual(before.entries[0].checkedInAt);
    expect(after.entries[0].confirmedAt).toEqual(before.entries[0].confirmedAt);
    expect(
      after.actions.find((a) => a.kind === "POOLS_ASSIGNED"),
    ).toMatchObject({
      staffId,
      detail: expect.stringContaining("KHLIM Black: Pool A → Pool B"),
    });
    await expect(
      command(staffId, e.id, { action: "assignPools", assignments: original }),
    ).rejects.toMatchObject({ status: 409 });
    const persisted = await assignments(e.id);
    // Fail late in the loop, after an earlier update, to prove whole-transaction rollback.
    const lateStale = persisted.map((a, i) => ({
      ...a,
      pool: i === 0 ? "A" : i === 4 ? "B" : a.pool,
      expectedPool: i === 7 ? "A" : a.expectedPool,
    }));
    await expect(
      command(staffId, e.id, { action: "assignPools", assignments: lateStale }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await assignments(e.id)).toEqual(persisted);
  });
  it("blocks invalid composition at scheduling and prevents pool changes after fixtures/results", async () => {
    const e = await event();
    await register(staffId, e.id);
    const before = (await getEvent(e.id))!;
    // Simulate legacy malformed data; generation must defend its own gate.
    await db.teamEntry.update({
      where: { id: before.entries[0].id },
      data: { poolId: before.pools[1].id },
    });
    await expect(
      command(staffId, e.id, { action: "generateFixtures" }),
    ).rejects.toThrow("four");
    expect((await getEvent(e.id))!.fixtures).toHaveLength(0);
    const played = await event();
    await ready(staffId, played.id);
    await score(staffId, played.id, "A-1", 0, 1);
    const oldState = (await getEvent(played.id))!;
    const proposed = (await assignments(played.id)).map((a, i) => ({
      ...a,
      pool: i === 0 ? "B" : i === 4 ? "A" : a.pool,
    }));
    await expect(
      command(staffId, played.id, {
        action: "assignPools",
        assignments: proposed,
      }),
    ).rejects.toThrow("locked");
    expect((await getEvent(played.id))!.fixtures).toEqual(oldState.fixtures);
  });
  it("staff can remove/add a substitute and edit players; invalid rosters never replace valid entries", async () => {
    const e = await event();
    await register(staffId, e.id);
    const t = (await getEvent(e.id))!.entries[0];
    const base = {
      action: "saveEntry",
      entryId: t.id,
      name: t.name,
      pool: "A",
      seed: t.seed,
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
    });
    expect(pub.fixtures.find((f) => f.code === "A-2")!.result).toBeNull();
    for (const t of pub.entries)
      expect(Object.keys(t).sort()).toEqual(["id", "name", "poolId", "seed"]);
    for (const f of pub.fixtures)
      expect(Object.keys(f).sort()).toEqual([
        "awayId",
        "awaySource",
        "code",
        "court",
        "homeId",
        "homeSource",
        "id",
        "result",
        "stage",
        "startsAt",
      ]);
    for (const p of pub.standings)
      for (const row of p.rows)
        expect(Object.keys(row).sort()).toEqual([
          "against",
          "diff",
          "for",
          "id",
          "lost",
          "name",
          "played",
          "rank",
          "seed",
          "seedTiebreak",
          "won",
        ]);
    expect(JSON.stringify(pub)).not.toMatch(
      /roster|staff|password|checkedIn|confirmedAt|Synthetic Black|recordedAt|previousCorrections|nameKey/,
    );
  });
});
