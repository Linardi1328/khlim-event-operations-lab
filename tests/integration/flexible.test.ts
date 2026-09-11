import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { db } from "../../src/lib/db";
import { seed } from "../../prisma/seed";
import { command, createEvent } from "../../src/lib/service";
import {
  getEvent,
  current,
  qualification,
  publicProjection,
} from "../../src/lib/query";
import { runDraw } from "../../src/lib/competition/draw";
import { formatPreview } from "../../src/lib/competition/format";
import { flexibleReady, finish, score } from "../helpers";
let staffId: string;
const ids: string[] = [];
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
async function event(
  count: number,
  pools: number,
  auto: number,
  wildcards = 0,
) {
  const e = await createEvent(staffId, {
    name: `Flexible ${count} ${crypto.randomUUID().slice(0, 6)}`,
    date: "2026-10-10",
    venue: "Synthetic lab",
    expectedTeams: count,
    poolCount: pools,
    automaticQualifiers: auto,
    wildcardCount: wildcards,
    knockoutSize: pools * auto + wildcards,
    courtCount: 3,
    plannedStart: "10:00",
    slotMinutes: 12,
    restMinutes: 8,
    turnaroundMinutes: 2,
  });
  ids.push(e.id);
  return e;
}
describe("PostgreSQL flexible tournament operations", () => {
  it.each([
    [8, 2, 2, 0],
    [12, 3, 2, 2],
    [16, 4, 3, 0],
    [18, 4, 2, 0],
    [20, 4, 3, 0],
    [24, 6, 2, 4],
    [32, 8, 4, 0],
  ])(
    "runs %i teams / %i pools / top %i + %i to persisted final placements",
    async (count, pools, auto, wildcards) => {
      const e = await event(count, pools, auto, wildcards);
      await flexibleReady(
        staffId,
        e.id,
        count,
        count % 3 === 0 ? "wide" : "long",
      );
      let state = (await getEvent(e.id))!;
      const preview = formatPreview(state);
      expect(state.fixtures.filter((f) => f.stage === "POOL")).toHaveLength(
        preview.poolGames,
      );
      expect(state.fixtures.filter((f) => f.stage !== "POOL")).toHaveLength(
        preview.knockoutGames,
      );
      expect(state.fixtures.every((f) => f.startsAt >= e.startsAt)).toBe(true);
      expect(state.fixtures[0].startsAt.toISOString()).toBe(
        "2026-10-10T02:00:00.000Z",
      );
      const d = state.draws[0];
      const replay = runDraw(
        d.entries.map((t) => ({
          id: t.entryId,
          points: t.players.map((p) => p.points),
        })),
        pools,
        d.rngSeed,
      );
      for (const t of replay) {
        const stored = d.entries.find((s) => s.entryId === t.id)!;
        expect(stored).toMatchObject({
          seedScore: t.seedScore,
          eventSeed: t.eventSeed,
          tieBreak: t.tieBreak,
          pot: t.pot,
          poolId: state.pools[t.poolIndex].id,
        });
      }
      await finish(staffId, e.id);
      await command(staffId, e.id, { action: "confirmPlacements" });
      for (const field of ["public", "schedulePublished", "resultsPublished"])
        await command(staffId, e.id, { action: "publish", field, value: true });
      state = (await getEvent(e.id))!;
      expect(qualification(state)).toHaveLength(e.knockoutSize);
      expect(new Set(state.placements.map((p) => p.entryId)).size).toBe(count);
      expect(state.fixtures.every((f) => !!current(f))).toBe(true);
      expect(publicProjection(state).placements).toHaveLength(count);
      const independent = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      expect(
        await independent.eventPlacement.count({ where: { eventId: e.id } }),
      ).toBe(count);
      await independent.$disconnect();
    },
    120000,
  );
  it("reconciles a result reversal through a deep bracket, with atomic conflict and selective replay", async () => {
    const e = await event(16, 4, 3);
    await flexibleReady(staffId, e.id, 16);
    await finish(staffId, e.id);
    await command(staffId, e.id, { action: "confirmPlacements" });
    const before = (await getEvent(e.id))!;
    // Force each winner on one opening-to-final route to be the home participant, then reverse its first outcome.
    const opening = before.fixtures.find((f) => f.stage === "PLAY_IN")!;
    const firstResult = current(opening)!;
    const data = {
      action: "recordResult",
      fixtureId: opening.id,
      homeScore: firstResult.awayScore,
      awayScore: firstResult.homeScore,
      expectedResultId: firstResult.id,
      reason: "Verified deep bracket result reversal.",
    };
    await expect(command(staffId, e.id, data)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      current(
        (await getEvent(e.id))!.fixtures.find((f) => f.id === opening.id)!,
      )!.id,
    ).toBe(firstResult.id);
    expect((await getEvent(e.id))!.placements).toHaveLength(16);
    await command(staffId, e.id, { ...data, authorizeReplay: true });
    let state = (await getEvent(e.id))!;
    expect(state.placements).toHaveLength(0);
    const voided = state.fixtures.filter((f) =>
      f.results.some((r) => r.status === "VOIDED"),
    );
    expect(voided.length).toBeGreaterThanOrEqual(2);
    expect(voided.every((f) => f.status === "REPLAY_REQUIRED")).toBe(true);
    for (const f of before.fixtures.filter(
      (f) => f.id !== opening.id && !voided.some((g) => g.id === f.id),
    ))
      expect(current(state.fixtures.find((g) => g.id === f.id)!)?.id).toBe(
        current(f)?.id,
      );
    expect(
      voided.every((f) =>
        f.results
          .filter((r) => r.status === "VOIDED")
          .every((r) => r.previousCorrections.length > 0),
      ),
    ).toBe(true);
    await finish(staffId, e.id);
    await command(staffId, e.id, { action: "confirmPlacements" });
    state = (await getEvent(e.id))!;
    expect(state.placements).toHaveLength(16);
    // A pool correction can reshuffle the same deep field: qualify from revised facts, never copied entrants.
    const beforeQualification = qualification(state)
      .map((t) => t.id)
      .join();
    const poolChange = state.fixtures
      .filter((f) => f.stage === "POOL")
      .find((f) => {
        const copy = structuredClone(state),
          result = current(copy.fixtures.find((g) => g.id === f.id)!)!;
        [result.homeScore, result.awayScore] = [
          result.awayScore,
          result.homeScore,
        ];
        return (
          qualification(copy)
            .map((t) => t.id)
            .join() !== beforeQualification
        );
      })!;
    expect(poolChange).toBeTruthy();
    const old = current(poolChange)!;
    const correction = { reason: "Pool sheet changes the deep playoff field." };
    await expect(
      score(
        staffId,
        e.id,
        poolChange.code,
        old.awayScore,
        old.homeScore,
        correction,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getEvent(e.id))!.placements).toHaveLength(16);
    await score(staffId, e.id, poolChange.code, old.awayScore, old.homeScore, {
      ...correction,
      authorizeReplay: true,
    });
    expect((await getEvent(e.id))!.placements).toHaveLength(0);
    await finish(staffId, e.id);
    await command(staffId, e.id, { action: "confirmPlacements" });
    expect((await getEvent(e.id))!.placements).toHaveLength(16);
  }, 120000);
  it("records attributable walkovers and excludes the winning score from public average points", async () => {
    const e = await event(8, 2, 2);
    await flexibleReady(staffId, e.id, 8);
    const f = (await getEvent(e.id))!.fixtures[0];
    await command(staffId, e.id, {
      action: "recordWalkover",
      fixtureId: f.id,
      winner: "HOME",
      expectedResultId: null,
      reason: "Opponent absent after the agreed waiting period.",
    });
    for (const field of ["schedulePublished", "resultsPublished"])
      await command(staffId, e.id, { action: "publish", field, value: true });
    let state = (await getEvent(e.id))!;
    const pub = publicProjection(state),
      row = pub.standings
        .flatMap((p) => p.rows)
        .find((r) => r.id === f.homeId)!;
    expect(row).toMatchObject({
      won: 1,
      for: 21,
      against: 0,
      diff: 21,
      average: 0,
      averageGames: 0,
    });
    expect(pub.fixtures.find((g) => g.id === f.id)!.result).toEqual({
      homeScore: 21,
      awayScore: 0,
      kind: "WALKOVER",
    });
    await score(staffId, e.id, f.code, 21, 0, {
      reason: "Actually played; walkover classification corrected.",
    });
    state = (await getEvent(e.id))!;
    expect(
      publicProjection(state)
        .standings.flatMap((p) => p.rows)
        .find((r) => r.id === f.homeId)!.average,
    ).toBe(21);
    expect(state.fixtures.find((g) => g.id === f.id)!.results).toHaveLength(2);
    expect(JSON.stringify(pub)).not.toMatch(
      /fibaPoints|roster|staffId|seedScore|provenance|rngSeed|password/,
    );
  }, 60000);
  it("persists observations and approves only fresh schedule projections, preserving planned times", async () => {
    const e = await event(12, 3, 2, 2);
    await flexibleReady(staffId, e.id, 12);
    let state = (await getEvent(e.id))!;
    const f = state.fixtures[0],
      planned = state.fixtures.map((f) => [f.id, f.startsAt.toISOString()]);
    await command(staffId, e.id, {
      action: "observeTiming",
      fixtureId: f.id,
      expectedRevision: state.scheduleRevision,
      startedAt: f.startsAt.toISOString(),
      endedAt: new Date(f.startsAt.getTime() + 40 * 60000).toISOString(),
      reason: "Referee recorded late actual completion.",
    });
    state = (await getEvent(e.id))!;
    expect(state.fixtures[0].timings).toHaveLength(1);
    const proposal = await command(staffId, e.id, {
      action: "proposeRecovery",
      expectedRevision: state.scheduleRevision,
      reason: "Propagate observed court delay with player rest.",
    });
    expect("proposalId" in proposal).toBe(true);
    state = (await getEvent(e.id))!;
    expect(
      state.fixtures.every(
        (f) => f.startsAt.getTime() === f.projectedStartsAt.getTime(),
      ),
    ).toBe(true);
    const p = state.recoveryProposals[0];
    expect(p.items.length).toBeGreaterThan(0);
    await expect(
      command(staffId, e.id, {
        action: "approveRecovery",
        proposalId: p.id,
        confirmed: false,
      }),
    ).rejects.toThrow();
    await score(staffId, e.id, f.code, 21, 12);
    await expect(
      command(staffId, e.id, {
        action: "approveRecovery",
        proposalId: p.id,
        confirmed: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
    state = (await getEvent(e.id))!;
    await command(staffId, e.id, {
      action: "proposeRecovery",
      expectedRevision: state.scheduleRevision,
      court: "Court 1",
      delayMinutes: 12,
      reason: "Approve refreshed recovery after score confirmation.",
    });
    state = (await getEvent(e.id))!;
    await command(staffId, e.id, {
      action: "approveRecovery",
      proposalId: state.recoveryProposals[0].id,
      confirmed: true,
    });
    state = (await getEvent(e.id))!;
    expect(state.fixtures.map((f) => [f.id, f.startsAt.toISOString()])).toEqual(
      planned,
    );
    expect(
      state.fixtures.some(
        (f) => f.projectedStartsAt > f.startsAt && f.status === "DELAYED",
      ),
    ).toBe(true);
    expect(state.recoveryProposals[0].status).toBe("APPLIED");
    await command(staffId, e.id, {
      action: "publish",
      field: "schedulePublished",
      value: true,
    });
    const pub = publicProjection((await getEvent(e.id))!);
    expect(pub.fixtures.some((f) => f.projectedStartsAt > f.startsAt)).toBe(
      true,
    );
    const beforePools = (await getEvent(e.id))!;
    for (const f of beforePools.fixtures.filter(
      (f) => f.stage === "POOL" && !current(f),
    ))
      await score(staffId, e.id, f.code, 21, 12);
    const qualifiedState = (await getEvent(e.id))!;
    const delayedPlayoffs = qualifiedState.fixtures.filter(
      (f) =>
        f.stage !== "POOL" &&
        f.projectedStartsAt > f.startsAt &&
        f.homeId &&
        f.awayId,
    );
    expect(delayedPlayoffs.length).toBeGreaterThan(0);
    expect(delayedPlayoffs.every((f) => f.status === "DELAYED")).toBe(true);
  }, 60000);
});
