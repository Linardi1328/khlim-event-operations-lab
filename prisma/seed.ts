import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { key } from "../src/lib/domain";
export const teamNames = [
  "KHLIM Black",
  "KHLIM Lime",
  "KHLIM Amber",
  "KHLIM Coral",
  "KHLIM Blue",
  "KHLIM Violet",
  "KHLIM Teal",
  "KHLIM Silver",
];
export async function seed() {
  await db.staff.upsert({
    where: { username: "event.staff" },
    update: {},
    create: {
      username: "event.staff",
      passwordHash: hashPassword("LabOnly!3x3"),
    },
  });
  if (await db.event.findUnique({ where: { slug: "khlim-one-day-lab" } }))
    return;
  const e = await db.event.create({
    data: {
      slug: "khlim-one-day-lab",
      name: "KHLIM One-Day 3×3",
      startsAt: new Date("2026-10-10T09:00:00+08:00"),
      venue: "KHLIM Lab Courts · Kuala Lumpur",
      overview:
        "Eight teams. Two courts. One day of basketball. A fully synthetic event for testing the KHLIM tournament experience.",
      public: true,
      pools: { create: [{ name: "A" }, { name: "B" }] },
      announcements: {
        create: {
          text: "Welcome to the lab. Team check-in opens at 08:00. Pool play starts at 09:00. All teams and players are synthetic.",
        },
      },
    },
    include: { pools: true },
  });
  for (const [i, name] of teamNames.entries())
    await db.teamEntry.create({
      data: {
        eventId: e.id,
        poolId: e.pools.find((p) => p.name === (i < 4 ? "A" : "B"))!.id,
        name,
        nameKey: key(name),
        seed: i + 1,
        roster: {
          create: [1, 2, 3, 4].map((slot) => ({
            name: `Synthetic ${name.replace("KHLIM ", "")} ${slot}`,
            nameKey: key(`Synthetic ${name.replace("KHLIM ", "")} ${slot}`),
            slot,
          })),
        },
      },
    });
  console.log(
    "Seeded KHLIM One-Day 3×3: 8 teams, 32 synthetic players, 2 pools. Staff: event.staff / LabOnly!3x3",
  );
}
if (process.argv[1]?.endsWith("seed.ts"))
  seed().finally(() => db.$disconnect());
