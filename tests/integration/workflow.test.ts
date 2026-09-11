import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { db } from "../../src/lib/db";
import { seed } from "../../prisma/seed";
import { command } from "../../src/lib/service";
import {
  getEvent,
  current,
  poolTables,
  publicProjection,
} from "../../src/lib/query";
import { signIn, sessionStaff, signOut } from "../../src/lib/auth";
import { makeEvent, ready, pools, score, sample, register } from "../helpers";
let staffId: string;
const ids: string[] = [];
async function event() {
  const e = await makeEvent(staffId);
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
describe("PostgreSQL operational truth", () => {
  it("operates all 16 games, reconciles the Black/Lime correction and handles dangerous corrections with audited replay", async () => {
    const e = await event();
    await ready(staffId, e.id);
    let state = (await getEvent(e.id))!;
    expect(state.fixtures).toHaveLength(16);
    expect(state.fixtures.filter((f) => f.stage === "POOL")).toHaveLength(12);
    expect(state.fixtures.every((f) => current(f) === null)).toBe(true);
    await pools(staffId, e.id);
    state = (await getEvent(e.id))!;
    expect(
      poolTables(state)[0]
        .rows.slice(0, 2)
        .map((t) => t.name),
    ).toEqual(["KHLIM Amber", "KHLIM Black"]);
    const black = state.entries.find((t) => t.name === "KHLIM Black")!,
      lime = state.entries.find((t) => t.name === "KHLIM Lime")!;
    expect(state.fixtures.find((f) => f.code === "SF-2")!.awayId).toBe(
      black.id,
    );
    await score(staffId, e.id, "A-5", 16, 18, {
      reason: "Score sheet verified: Lime won.",
    });
    state = (await getEvent(e.id))!;
    expect(
      poolTables(state)[0]
        .rows.slice(0, 2)
        .map((t) => t.name),
    ).toEqual(["KHLIM Amber", "KHLIM Lime"]);
    expect(state.fixtures.find((f) => f.code === "SF-2")!.awayId).toBe(lime.id);
    const revised = state.fixtures.find((f) => f.code === "A-5")!;
    expect(revised.results).toHaveLength(2);
    expect(
      revised.results.find((r) => r.status === "SUPERSEDED")!
        .previousCorrections[0],
    ).toMatchObject({ staffId, reason: "Score sheet verified: Lime won." });
    // Correct back before play so the mandatory original -> corrected scenario can also be tested after medals.
    await score(staffId, e.id, "A-5", 18, 16, {
      reason: "Reset scenario to original recorded score.",
    });
    await score(staffId, e.id, "SF-1", 21, 10);
    await score(staffId, e.id, "SF-2", 12, 21);
    state = (await getEvent(e.id))!;
    expect(state.fixtures.find((f) => f.code === "FINAL")!.awayId).toBe(
      black.id,
    );
    await score(staffId, e.id, "THIRD", 21, 10);
    await score(staffId, e.id, "FINAL", 21, 10);
    await command(staffId, e.id, { action: "confirmPlacements" });
    for (const field of ["public", "schedulePublished", "resultsPublished"])
      await command(staffId, e.id, { action: "publish", field, value: true });
    state = (await getEvent(e.id))!;
    expect(publicProjection(state).placements).toHaveLength(8);
    const previousResult = current(
      state.fixtures.find((f) => f.code === "A-5")!,
    )!.id;
    await expect(
      score(staffId, e.id, "A-5", 16, 18, {
        reason: "Black / Lime corrected from the verified sheet.",
      }),
    ).rejects.toMatchObject({
      status: 409,
      conflicts: expect.arrayContaining(["SF-2", "FINAL", "THIRD"]),
    });
    state = (await getEvent(e.id))!;
    expect(current(state.fixtures.find((f) => f.code === "A-5")!)!.id).toBe(
      previousResult,
    );
    expect(state.placements).toHaveLength(8);
    await score(staffId, e.id, "A-5", 16, 18, {
      reason: "Black / Lime corrected from the verified sheet.",
      authorizeReplay: true,
    });
    state = (await getEvent(e.id))!;
    expect(state.placements).toHaveLength(0);
    expect(state.placementsConfirmedAt).toBeNull();
    expect(
      current(state.fixtures.find((f) => f.code === "SF-1")!),
    ).not.toBeNull();
    for (const code of ["SF-2", "FINAL", "THIRD"]) {
      const f = state.fixtures.find((f) => f.code === code)!;
      expect(current(f)).toBeNull();
      expect(
        f.results.find((r) => r.status === "VOIDED")!.previousCorrections[0]
          .reason,
      ).toContain("Downstream replay authorized");
    }
    await score(staffId, e.id, "SF-2", 21, 15);
    await score(staffId, e.id, "FINAL", 21, 10);
    await score(staffId, e.id, "THIRD", 0, 1);
    await command(staffId, e.id, { action: "confirmPlacements" });
    state = (await getEvent(e.id))!;
    expect(state.placements).toHaveLength(8);
    expect(new Set(state.placements.map((p) => p.entryId)).size).toBe(8);
    // A new connection recovers current results, sign-off and audit without client state.
    const second = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    expect(
      await second.eventPlacement.count({ where: { eventId: e.id } }),
    ).toBe(8);
    await second.$disconnect();
    const publicData = JSON.stringify(publicProjection(state));
    expect(publicData).not.toContain("Synthetic Black");
    expect(publicData).not.toContain("passwordHash");
    expect(publicData).not.toContain("Score sheet");
    // Same-participant semifinal winner reversal safely blocks played descendants, then reconciles.
    await expect(
      score(staffId, e.id, "SF-1", 10, 21, {
        reason: "Semifinal sheet reviewed.",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await score(staffId, e.id, "SF-1", 10, 21, {
      reason: "Semifinal sheet reviewed.",
      authorizeReplay: true,
    });
    state = (await getEvent(e.id))!;
    expect(current(state.fixtures.find((f) => f.code === "FINAL")!)).toBeNull();
    expect(state.placements).toHaveLength(0);
  }, 60000);
  it("makes preview non-mutating, requires explicit confirmation and rejects stale or repeated commits atomically", async () => {
    const e = await event();
    const preview = await command(staffId, e.id, {
      action: "previewImport",
      filename: "sample.csv",
      csv: sample,
    });
    expect("batchId" in preview).toBe(true);
    const batchId = "batchId" in preview ? preview.batchId : undefined;
    expect(await db.teamEntry.count({ where: { eventId: e.id } })).toBe(0);
    await expect(
      command(staffId, e.id, {
        action: "commitImport",
        batchId,
        confirmed: false,
        synthetic: true,
      }),
    ).rejects.toThrow();
    expect(await db.teamEntry.count({ where: { eventId: e.id } })).toBe(0);
    const attempts = await Promise.allSettled(
      [1, 2].map(() =>
        command(staffId, e.id, {
          action: "commitImport",
          batchId,
          confirmed: true,
          synthetic: true,
        }),
      ),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect(await db.teamEntry.count({ where: { eventId: e.id } })).toBe(8);
    const duplicate = await command(staffId, e.id, {
      action: "previewImport",
      filename: "sample.csv",
      csv: sample,
    });
    expect(
      "errors" in duplicate && (duplicate.errors?.length ?? 0),
    ).toBeGreaterThan(0);
    expect(await db.teamEntry.count({ where: { eventId: e.id } })).toBe(8);
    const other = await event();
    const stale = await command(staffId, other.id, {
      action: "previewImport",
      filename: "sample.csv",
      csv: sample,
    });
    await command(staffId, other.id, {
      action: "saveEntry",
      name: "KHLIM Black",
      pool: "A",
      seed: 1,
      synthetic: true,
      players: [1, 2, 3].map((slot) => ({
        slot,
        name: `Manual synthetic ${slot}`,
      })),
    });
    await expect(
      command(staffId, other.id, {
        action: "commitImport",
        batchId: "batchId" in stale ? stale.batchId : "",
        confirmed: true,
        synthetic: true,
      }),
    ).rejects.toThrow("stale");
    expect(await db.teamEntry.count({ where: { eventId: other.id } })).toBe(1);
  });
  it("gates scheduling, enforces roster and event ownership, and locks seeded roster priorities", async () => {
    const e = await event();
    await expect(
      command(staffId, e.id, { action: "generateFixtures" }),
    ).rejects.toThrow("eight");
    await expect(
      command(staffId, e.id, {
        action: "saveEntry",
        name: "Small",
        pool: "A",
        seed: 1,
        synthetic: true,
        players: [{ slot: 1, name: "One" }],
      }),
    ).rejects.toThrow("3 core");
    await register(staffId, e.id);
    await expect(
      command(staffId, e.id, { action: "generateFixtures" }),
    ).rejects.toThrow("check in");
    const other = await event();
    const t = await db.teamEntry.findFirstOrThrow({ where: { eventId: e.id } });
    await expect(
      command(staffId, other.id, { action: "confirmEntry", entryId: t.id }),
    ).rejects.toThrow("not found");
  });
  it("rejects stale score writers, no reason, invalid scores and database-level self matches", async () => {
    const e = await event();
    await ready(staffId, e.id);
    const state = (await getEvent(e.id))!;
    const f = state.fixtures.find((f) => f.code === "A-1")!;
    const payload = {
      action: "recordResult",
      fixtureId: f.id,
      homeScore: 0,
      awayScore: 1,
      expectedResultId: null,
    };
    const attempts = await Promise.allSettled(
      [1, 2].map(() => command(staffId, e.id, payload)),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    await expect(score(staffId, e.id, "A-1", 1, 0)).rejects.toThrow("reason");
    await expect(
      score(staffId, e.id, "A-1", 5, 5, { reason: "Invalid tied score test." }),
    ).rejects.toThrow("winner");
    await expect(
      db.fixture.update({ where: { id: f.id }, data: { awayId: f.homeId } }),
    ).rejects.toThrow();
    await expect(
      command(staffId, e.id, {
        action: "saveEntry",
        name: "Locked",
        pool: "A",
        seed: 1,
        synthetic: true,
        players: [1, 2, 3].map((slot) => ({ slot, name: `Player ${slot}` })),
      }),
    ).rejects.toThrow("locked");
  });
  it("uses persistent, expiring staff sessions and rejects unauthorized mutations", async () => {
    await expect(
      command("anonymous", "fake", { action: "announce", text: "No" }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(signIn("event.staff", "wrong")).rejects.toMatchObject({
      status: 401,
    });
    const token = await signIn("event.staff", "LabOnly!3x3");
    expect((await sessionStaff(token))?.id).toBe(staffId);
    await signOut(token);
    expect(await sessionStaff(token)).toBeNull();
    expect(await sessionStaff()).toBeNull();
  });
});
