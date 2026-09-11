import { readFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { command, createEvent } from "../src/lib/service";
import { getEvent, current } from "../src/lib/query";
export const sample = readFileSync(
  new URL("../public/samples/benchmark-teams.csv", import.meta.url),
  "utf8",
);
export const poolScores: Record<string, [number, number]> = {
  "A-1": [21, 10],
  "A-2": [10, 21],
  "A-3": [10, 21],
  "A-4": [10, 21],
  "A-5": [18, 16],
  "A-6": [21, 10],
};
export async function makeEvent(staffId: string, prefix = "integration") {
  return createEvent(staffId, {
    name: `${prefix} ${crypto.randomUUID().slice(0, 8)}`,
    date: "2026-10-10",
    venue: "Synthetic Lab Courts",
  });
}
export async function register(staffId: string, eventId: string) {
  const preview = await command(staffId, eventId, {
    action: "previewImport",
    filename: "benchmark.csv",
    csv: sample,
  });
  if (!("batchId" in preview)) throw new Error("Invalid preview");
  await command(staffId, eventId, {
    action: "commitImport",
    batchId: preview.batchId,
    confirmed: true,
    synthetic: true,
  });
}
export async function ready(staffId: string, eventId: string) {
  await register(staffId, eventId);
  const entries = await db.teamEntry.findMany({
    where: { eventId },
    include: { roster: true },
  });
  for (const t of entries) {
    await command(staffId, eventId, { action: "confirmEntry", entryId: t.id });
    await command(staffId, eventId, {
      action: "checkIn",
      entryId: t.id,
      checked: true,
    });
    for (const p of t.roster.filter((p) => p.slot <= 3))
      await command(staffId, eventId, {
        action: "checkIn",
        entryId: t.id,
        playerId: p.id,
        checked: true,
      });
  }
  await command(staffId, eventId, {
    action: "runDraw",
    expectedDrawVersion: null,
    confirmed: true,
  });
  await command(staffId, eventId, { action: "generateFixtures" });
}
export async function pools(staffId: string, eventId: string) {
  const e = (await getEvent(eventId))!;
  for (const f of e.fixtures.filter((f) => f.stage === "POOL")) {
    const [homeScore, awayScore] = poolScores[f.code] ?? [21, 10];
    await command(staffId, eventId, {
      action: "recordResult",
      fixtureId: f.id,
      homeScore,
      awayScore,
      expectedResultId: null,
    });
  }
}
export async function score(
  staffId: string,
  eventId: string,
  code: string,
  homeScore: number,
  awayScore: number,
  extra: Record<string, unknown> = {},
) {
  const e = (await getEvent(eventId))!;
  const f = e.fixtures.find((f) => f.code === code)!;
  return command(staffId, eventId, {
    action: "recordResult",
    fixtureId: f.id,
    homeScore,
    awayScore,
    expectedResultId: current(f)?.id ?? null,
    ...extra,
  });
}

// Compatibility fixture for the migrated V1 event boundary. New events never use this setup.
export async function legacyReady(staffId: string, eventId: string) {
  await register(staffId, eventId);
  const e = (await getEvent(eventId))!;
  const names = [
    "Black",
    "Lime",
    "Amber",
    "Coral",
    "Blue",
    "Violet",
    "Teal",
    "Silver",
  ];
  const ordered = names.map((n) =>
    e.entries.find((t) => t.name === `KHLIM ${n}`)!,
  );
  await db.event.update({
    where: { id: eventId },
    data: {
      formatVersion: "LEGACY_V1",
      standingsVersion: "LEGACY_V1",
      restMinutes: 0,
    },
  });
  for (const [i, t] of ordered.entries())
    await db.teamEntry.update({
      where: { id: t.id },
      data: {
        poolId: e.pools[i < 4 ? 0 : 1].id,
        seed: i + 1,
        seedingVersion: "LEGACY_MANUAL_V1",
        confirmedAt: new Date(),
        checkedInAt: new Date(),
      },
    });
  const pairs = [
    [0, 3],
    [1, 2],
    [0, 2],
    [3, 1],
    [0, 1],
    [2, 3],
  ];
  for (const [index, p] of e.pools.entries())
    for (const [i, [home, away]] of pairs.entries()) {
      const at = new Date(e.startsAt.getTime() + i * 15 * 60000);
      await db.fixture.create({
        data: {
          eventId,
          poolId: p.id,
          code: `${p.name}-${i + 1}`,
          stage: "POOL",
          court: `Court ${index + 1}`,
          startsAt: at,
          projectedStartsAt: at,
          homeId: ordered[home + index * 4].id,
          awayId: ordered[away + index * 4].id,
          homeSource: "Pool entry",
          awaySource: "Pool entry",
        },
      });
    }
  const refs = new Map<string, string>();
  for (const [i, code] of ["SF-1", "SF-2", "THIRD", "FINAL"].entries()) {
    const at = new Date(e.startsAt.getTime() + (120 + i * 20) * 60000);
    const f = await db.fixture.create({
      data: {
        eventId,
        code,
        stage: i < 2 ? "SEMIFINAL" : code === "THIRD" ? "THIRD" : "FINAL",
        round: i < 2 ? 2 : 1,
        court: "Court 1",
        startsAt: at,
        projectedStartsAt: at,
        homeSource: i < 2 ? "Pool rank" : "Winner SF-1",
        awaySource: i < 2 ? "Pool rank" : "Winner SF-2",
      },
    });
    refs.set(code, f.id);
  }
  for (const [i, code] of ["SF-1", "SF-2"].entries())
    for (const [side, pi, rank] of [
      ["HOME", i, 1],
      ["AWAY", 1 - i, 2],
    ] as const)
      await db.fixtureSource.create({
        data: {
          eventId,
          fixtureId: refs.get(code)!,
          side,
          kind: "POOL_RANK",
          poolId: e.pools[pi].id,
          poolRank: rank,
        },
      });
  for (const code of ["THIRD", "FINAL"])
    for (const [i, side] of ["HOME", "AWAY"].entries())
      await db.fixtureSource.create({
        data: {
          eventId,
          fixtureId: refs.get(code)!,
          side,
          kind: code === "FINAL" ? "WINNER" : "LOSER",
          sourceFixtureId: refs.get(`SF-${i + 1}`)!,
        },
      });
}
export const flexibleCsv = (count: number, layout = "long") =>
  layout === "wide"
    ? "squad,player 1,player 1 points,player 2,player 3,extra\n" +
      Array.from(
        { length: count },
        (_, i) =>
          `Synthetic Team ${i + 1},Lab ${i + 1} One,${(count - i) * 100},Lab ${i + 1} Two,Lab ${i + 1} Three,ignored`,
      ).join("\n")
    : "ATHLETE,ranking_points,Team Name,unneeded\n" +
      Array.from({ length: count }, (_, i) =>
        [1, 2, 3, 4]
          .map(
            (slot) =>
              `Lab ${i + 1} Player ${slot},${(count - i) * 100 + slot},Synthetic Team ${i + 1},ignored`,
          )
          .join("\n"),
      ).join("\n");
export async function flexibleReady(
  staffId: string,
  eventId: string,
  count: number,
  layout = "long",
) {
  const p = await command(staffId, eventId, {
    action: "previewImport",
    filename: `${layout}.csv`,
    csv: flexibleCsv(count, layout),
  });
  if (!("batchId" in p)) throw new Error(JSON.stringify(p));
  await command(staffId, eventId, {
    action: "commitImport",
    batchId: p.batchId,
    confirmed: true,
    synthetic: true,
  });
  const e = (await getEvent(eventId))!;
  for (const t of e.entries) {
    await command(staffId, eventId, { action: "confirmEntry", entryId: t.id });
    await command(staffId, eventId, {
      action: "checkIn",
      entryId: t.id,
      checked: true,
    });
    for (const player of t.roster)
      await command(staffId, eventId, {
        action: "checkIn",
        entryId: t.id,
        playerId: player.id,
        checked: true,
      });
  }
  await command(staffId, eventId, {
    action: "runDraw",
    confirmed: true,
    expectedDrawVersion: null,
  });
  await command(staffId, eventId, { action: "generateFixtures" });
}
export async function finish(staffId: string, eventId: string) {
  const e = (await getEvent(eventId))!;
  for (const f of e.fixtures.filter((f) => f.stage === "POOL" && !current(f)))
    await score(staffId, eventId, f.code, 21, 10);
  for (const f of e.fixtures
    .filter((f) => f.stage !== "POOL")
    .sort((a, b) => b.round - a.round || a.code.localeCompare(b.code)))
    if (
      !current((await getEvent(eventId))!.fixtures.find((g) => g.id === f.id)!)
    )
      await score(staffId, eventId, f.code, 21, 12);
}
