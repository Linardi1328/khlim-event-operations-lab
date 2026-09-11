import { z } from "zod";
export const FORMAT_VERSION = "KHLIM_3X3_V2";
export const STANDINGS_VERSION = "FIBA_INSPIRED_V2";
export const formatSchema = z.object({
  timezone: z
    .string()
    .default("Asia/Kuala_Lumpur")
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Use a valid IANA timezone."),
  plannedStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("09:00"),
  courtCount: z.number().int().min(1).max(16).default(2),
  poolCount: z.number().int().min(1).max(16).default(2),
  expectedTeams: z.number().int().min(4).max(128).default(8),
  maxTeams: z.number().int().min(4).max(128).default(128),
  automaticQualifiers: z.number().int().min(1).max(16).default(2),
  wildcardCount: z.number().int().min(0).max(31).default(0),
  knockoutSize: z.number().int().min(2).max(32).default(4),
  thirdPlace: z.boolean().default(true),
  slotMinutes: z.number().int().min(5).max(60).default(15),
  turnaroundMinutes: z.number().int().min(0).max(30).default(0),
  restMinutes: z.number().int().min(0).max(120).default(10),
});
export type CompetitionFormat = z.infer<typeof formatSchema>;
export const defaultFormat = formatSchema.parse({});
export function formatIssues(f: CompetitionFormat, teams = f.expectedTeams) {
  const errors: string[] = [];
  if (teams > f.maxTeams)
    errors.push("Team count exceeds this event's capacity.");
  if (teams < f.poolCount * 2)
    errors.push("Each pool needs at least two teams.");
  if (Math.floor(teams / f.poolCount) < f.automaticQualifiers)
    errors.push("Automatic qualifiers exceed the smallest pool size.");
  if (f.automaticQualifiers * f.poolCount + f.wildcardCount !== f.knockoutSize)
    errors.push(
      "Automatic qualifiers × pools + wildcards must equal the knockout field.",
    );
  if (f.knockoutSize > teams)
    errors.push("The knockout field cannot exceed registered teams.");
  if (f.thirdPlace && f.knockoutSize < 4)
    errors.push("A third-place game requires at least four qualifiers.");
  const poolGames = poolSizes(teams, f.poolCount).reduce(
    (sum, n) => sum + (n * (n - 1)) / 2,
    0,
  );
  if (poolGames > 1024)
    errors.push(
      "This local lab supports at most 1,024 pool fixtures. Increase the pool count.",
    );
  return errors;
}
export function poolSizes(teams: number, pools: number) {
  return Array.from(
    { length: pools },
    (_, i) => Math.floor(teams / pools) + (i < teams % pools ? 1 : 0),
  );
}
export function formatPreview(f: CompetitionFormat, teams = f.expectedTeams) {
  const sizes = poolSizes(teams, f.poolCount),
    capacity = 2 ** Math.ceil(Math.log2(f.knockoutSize));
  return {
    sizes,
    poolGames: sizes.reduce((s, n) => s + (n * (n - 1)) / 2, 0),
    knockoutGames: f.knockoutSize - 1 + Number(f.thirdPlace),
    byes: capacity - f.knockoutSize,
    capacity,
    errors: formatIssues(f, teams),
  };
}
// Resolve wall time with Intl; reject nonexistent or ambiguous DST times rather than guessing.
export function zonedStart(date: string, time: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Enter a valid event date.");
  const target = `${date}T${time}`;
  const nominal = Date.parse(`${target}:00Z`);
  if (
    !Number.isFinite(nominal) ||
    new Date(nominal).toISOString().slice(0, 10) !== date
  )
    throw new Error("Enter a valid event date.");
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const wall = (n: number) => {
    const p = Object.fromEntries(
      format.formatToParts(new Date(n)).map((v) => [v.type, v.value]),
    );
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const n = nominal + offset * 60_000;
    if (wall(n) === target) matches.push(n);
  }
  if (matches.length !== 1)
    throw new Error(
      "Start time is invalid or ambiguous in this timezone (DST). Choose another time.",
    );
  return new Date(matches[0]);
}
