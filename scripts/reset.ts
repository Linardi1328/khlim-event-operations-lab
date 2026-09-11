import { db } from "../src/lib/db";
import { seed } from "../prisma/seed";
// The exact local database name and explicit flag guard this destructive, lab-only reset.
const url = new URL(process.env.DATABASE_URL!);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/khlim_lab" ||
  !process.argv.includes("--yes-lab-only")
)
  throw new Error(
    "Reset is only allowed for localhost/khlim_lab with --yes-lab-only.",
  );
await db.event.deleteMany();
await db.session.deleteMany();
await seed();
await db.$disconnect();
