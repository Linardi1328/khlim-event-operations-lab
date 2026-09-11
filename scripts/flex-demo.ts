import { db } from "../src/lib/db";
import { seed } from "../prisma/seed";
import { createEvent, command } from "../src/lib/service";
import { getEvent, current } from "../src/lib/query";
const database = new URL(process.env.DATABASE_URL!);
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname !== "/khlim_lab"
)
  throw new Error(
    "Demo is restricted to the isolated localhost khlim_lab database.",
  );
await seed();
const staffId = (
  await db.staff.findUniqueOrThrow({ where: { username: "event.staff" } })
).id;
const e = await createEvent(staffId, {
  name: "KHLIM Flexible 3×3 Review",
  date: "2026-10-10",
  venue: "Synthetic Community Courts · Kuala Lumpur",
  expectedTeams: 18,
  poolCount: 4,
  automaticQualifiers: 3,
  knockoutSize: 12,
  courtCount: 3,
  plannedStart: "10:00",
  overview:
    "Eighteen synthetic teams. Four pools. Follow the seeded draw, walkovers, live estimates and the twelve-team playoff field.",
});
const act = (data: Record<string, unknown>) => command(staffId, e.id, data);
const colors = [
  "Black",
  "Lime",
  "Amber",
  "Coral",
  "Blue",
  "Violet",
  "Teal",
  "Silver",
  "Indigo",
  "Copper",
  "Jade",
  "Scarlet",
  "Cobalt",
  "Orchid",
  "Gold",
  "Sage",
  "Pearl",
  "Community Basketball With A Deliberately Long Team Name",
];
for (const [i, color] of colors.entries())
  await act({
    action: "saveEntry",
    name: `KHLIM ${color}`,
    synthetic: true,
    players: [1, 2, 3, 4].map((slot) => ({
      name: `Lab ${i + 1} Player ${slot}`,
      slot,
      fibaPoints: (18 - i) * 100 + slot * 10,
      pointsProvenance: "Invented review data; never official FIBA points",
    })),
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
await act({ action: "runDraw", confirmed: true, expectedDrawVersion: null });
await act({ action: "generateFixtures" });
state = (await getEvent(e.id))!;
const opening = state.fixtures[0];
await act({
  action: "observeTiming",
  fixtureId: opening.id,
  expectedRevision: state.scheduleRevision,
  startedAt: new Date(opening.startsAt.getTime() + 12 * 60000).toISOString(),
  endedAt: new Date(opening.startsAt.getTime() + 27 * 60000).toISOString(),
  reason: "Synthetic observed twelve-minute late opening game.",
});
state = (await getEvent(e.id))!;
await act({
  action: "proposeRecovery",
  expectedRevision: state.scheduleRevision,
  reason:
    "Propagate the late opening game with court turnaround and team rest.",
});
state = (await getEvent(e.id))!;
await act({
  action: "approveRecovery",
  proposalId: state.recoveryProposals[0].id,
  confirmed: true,
});
for (const [i, f] of state.fixtures.filter((f) => f.stage === "POOL").entries())
  await act(
    i === 1
      ? {
          action: "recordWalkover",
          fixtureId: f.id,
          winner: "HOME",
          expectedResultId: null,
          reason: "Synthetic opponent absent after the agreed waiting period.",
        }
      : {
          action: "recordResult",
          fixtureId: f.id,
          homeScore: 21,
          awayScore: 10 + (i % 8),
          expectedResultId: null,
        },
  );
state = (await getEvent(e.id))!;
for (const f of state.fixtures
  .filter((f) => f.stage !== "POOL")
  .sort((a, b) => b.round - a.round || a.code.localeCompare(b.code))) {
  if (!process.argv.includes("--complete") && f.round <= 2) continue;
  await act({
    action: "recordResult",
    fixtureId: f.id,
    homeScore: 21,
    awayScore: 15,
    expectedResultId: null,
  });
}
if (process.argv.includes("--complete"))
  await act({ action: "confirmPlacements" });
for (const field of ["public", "schedulePublished", "resultsPublished"])
  await act({ action: "publish", field, value: true });
await act({
  action: "announce",
  text: "Court 1 began twelve minutes late. Approved estimated times are shown beside the original schedule. This review event uses synthetic teams and players only.",
});
state = (await getEvent(e.id))!;
console.log(
  `Flexible review: /events/${e.slug}\nStaff: /ops/${e.id}\n${state.fixtures.filter(current).length}/${state.fixtures.length} games complete. Original seed and existing events preserved.`,
);
await db.$disconnect();
