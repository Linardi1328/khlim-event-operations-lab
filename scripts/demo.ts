import { readFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { seed } from "../prisma/seed";
import { command, createEvent } from "../src/lib/service";
import { getEvent, current } from "../src/lib/query";
const url = new URL(process.env.DATABASE_URL!);
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  url.pathname !== "/khlim_lab"
)
  throw new Error(
    "Demo is restricted to the isolated local khlim_lab database.",
  );
await seed();
const staff = (
  await db.staff.findUniqueOrThrow({ where: { username: "event.staff" } })
).id;
const e = await createEvent(staff, {
  name: "KHLIM Matchday Review",
  date: "2026-10-10",
  venue: "KHLIM Lab Courts · Kuala Lumpur",
  overview:
    "Eight synthetic teams, two courts and one complete day of 3×3 basketball. Explore the results, then inspect the staff correction history.",
});
const act = (data: Record<string, unknown>) => command(staff, e.id, data);
const preview = await act({
  action: "previewImport",
  filename: "benchmark-teams.csv",
  csv: readFileSync("public/samples/benchmark-teams.csv", "utf8"),
});
await act({
  action: "commitImport",
  batchId: "batchId" in preview ? preview.batchId : "",
  confirmed: true,
  synthetic: true,
});
let state = (await getEvent(e.id))!;
for (const t of state.entries) {
  await act({ action: "confirmEntry", entryId: t.id });
  await act({ action: "checkIn", entryId: t.id, checked: true });
  for (const p of t.roster)
    await act({
      action: "checkIn",
      entryId: t.id,
      playerId: p.id,
      checked: true,
    });
}
await act({ action: "generateFixtures" });
state = (await getEvent(e.id))!;
const scores: Record<string, [number, number]> = {
  "A-2": [10, 21],
  "A-3": [10, 21],
  "A-4": [10, 21],
  "A-5": [18, 16],
};
for (const f of state.fixtures.filter((f) => f.stage === "POOL")) {
  const [homeScore, awayScore] = scores[f.code] ?? [21, 10];
  await act({
    action: "recordResult",
    fixtureId: f.id,
    homeScore,
    awayScore,
    expectedResultId: null,
  });
}
state = (await getEvent(e.id))!;
const blackLime = state.fixtures.find((f) => f.code === "A-5")!;
await act({
  action: "recordResult",
  fixtureId: blackLime.id,
  homeScore: 16,
  awayScore: 18,
  expectedResultId: current(blackLime)!.id,
  reason: "Synthetic review: the verified sheet reads Black 16, Lime 18.",
});
for (const code of ["SF-1", "SF-2", "THIRD", "FINAL"]) {
  state = (await getEvent(e.id))!;
  const f = state.fixtures.find((f) => f.code === code)!;
  await act({
    action: "recordResult",
    fixtureId: f.id,
    homeScore: 21,
    awayScore: 15,
    expectedResultId: null,
  });
}
await act({ action: "confirmPlacements" });
for (const field of ["public", "schedulePublished", "resultsPublished"])
  await act({ action: "publish", field, value: true });
await act({
  action: "announce",
  text: "The final whistle! All results have been confirmed. Thank you for following this synthetic KHLIM lab tournament.",
});
console.log(
  `Completed review event: /events/${e.slug}\nStaff desk: /ops/${e.id}\nThe original seed event remains ready for registration and check-in.`,
);
await db.$disconnect();
