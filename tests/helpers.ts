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
