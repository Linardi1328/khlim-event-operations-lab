import { z } from "zod";
import { db } from "./db";
import { authorizeStaff } from "./auth";
import {
  DomainError,
  key,
  validateRoster,
  validateScore,
  roundRobin,
  qualifiers,
  semifinalPairs,
  medalPairs,
  outcome,
} from "./domain";
import { parseCsv, validateImport, defaultMapping } from "./csv";
import {
  current,
  eventInclude,
  game,
  poolTables,
  type EventData,
} from "./query";
import type { Prisma } from "../generated/prisma/client";
type Tx = Prisma.TransactionClient;
const name = z.string().trim().min(1).max(80);
const id = z.string().min(1);
const rosterSchema = z.array(
  z.object({ name, slot: z.number().int().min(1).max(4) }),
);
const entrySchema = z.object({
  entryId: id.optional(),
  name,
  pool: z.enum(["A", "B"]),
  seed: z.number().int().min(1).max(8),
  players: rosterSchema,
  synthetic: z.literal(true),
});
async function audit(
  tx: Tx,
  eventId: string,
  staffId: string,
  kind: string,
  detail: string,
) {
  await tx.operatorAction.create({ data: { eventId, staffId, kind, detail } });
}
async function fresh(tx: Tx, eventId: string) {
  const e = await tx.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });
  if (!e) throw new DomainError("Event not found.", 404);
  return e;
}
function unlocked(e: EventData) {
  if (e.fixtures.length)
    throw new DomainError(
      "Entries and check-in are locked once fixtures exist. Use a fresh event to change registration.",
    );
}
function entryErrors(
  e: EventData,
  entries: {
    name: string;
    seed: number;
    pool: string;
    players: { name: string; slot: number }[];
  }[],
  exclude?: string,
) {
  const existing = e.entries.filter((t) => t.id !== exclude);
  const rows = entries.flatMap((t) =>
    t.players.map((p, i) => ({
      line: i + 1,
      team: t.name,
      seed: t.seed,
      pool: t.pool,
      player: p.name,
      slot: p.slot,
    })),
  );
  const errors = validateImport(
    rows,
    existing.map((t) => ({
      name: t.name,
      seed: t.seed,
      players: t.roster.map((p) => p.name),
    })),
  );
  for (const p of e.pools)
    if (
      existing.filter((t) => t.poolId === p.id).length +
        entries.filter((t) => t.pool === p.name).length >
      4
    )
      errors.push(`Pool ${p.name} exceeds four teams.`);
  return errors;
}
export async function createEvent(staffId: string, input: unknown) {
  await authorizeStaff(staffId);
  const data = z
    .object({
      name,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      venue: name,
      overview: z
        .string()
        .trim()
        .max(1000)
        .default(
          "A synthetic KHLIM 3x3 tournament. All teams and participants are fictional.",
        ),
    })
    .parse(input);
  const startsAt = new Date(`${data.date}T09:00:00+08:00`);
  if (
    Number.isNaN(startsAt.getTime()) ||
    startsAt.toISOString().slice(0, 10) !== data.date
  )
    throw new DomainError("Enter a valid event date.");
  return db.event.create({
    data: {
      name: data.name,
      venue: data.venue,
      overview: data.overview,
      startsAt,
      slug: `${key(data.name)
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 45)}-${crypto.randomUUID().slice(0, 8)}`,
      pools: { create: [{ name: "A" }, { name: "B" }] },
      actions: {
        create: {
          staffId,
          kind: "EVENT_CREATED",
          detail: "Synthetic benchmark event created.",
        },
      },
    },
  });
}
async function reconcile(
  tx: Tx,
  e: EventData,
  staffId: string,
  allowVoid: boolean,
  reason: string,
) {
  let changed = false;
  const tables = poolTables(e);
  const ready =
    tables.length === 2 &&
    tables.every(
      (p) => p.rows.length === 4 && p.rows.every((t) => t.played === 3),
    );
  const pairs = ready
    ? semifinalPairs(qualifiers(tables[0].rows), qualifiers(tables[1].rows))
    : [
        [null, null],
        [null, null],
      ];
  const conflicts: string[] = [];
  const update = async (code: string, pair: (string | null)[]) => {
    const f = e.fixtures.find((f) => f.code === code);
    if (!f) return;
    if (f.homeId === pair[0] && f.awayId === pair[1]) return;
    const r = current(f);
    if (r) {
      conflicts.push(code);
      if (allowVoid) {
        await tx.gameResult.update({
          where: { id: r.id },
          data: { status: "VOIDED" },
        });
        await tx.resultCorrection.create({
          data: {
            previousId: r.id,
            reason: `Downstream replay authorized: ${reason}`,
            staffId,
          },
        });
      }
      r.status = "VOIDED"; // In-memory simulation computes all affected descendants before refusing the transaction.
    }
    f.homeId = pair[0];
    f.awayId = pair[1];
    changed = true;
    await tx.fixture.update({
      where: { id: f.id },
      data: { homeId: pair[0], awayId: pair[1] },
    });
  };
  await update("SF-1", pairs[0]);
  await update("SF-2", pairs[1]);
  const one = e.fixtures.find((f) => f.code === "SF-1"),
    two = e.fixtures.find((f) => f.code === "SF-2");
  if (one && two) {
    const medals = medalPairs(game(one), game(two));
    await update("FINAL", medals.final);
    await update("THIRD", medals.third);
  }
  if (conflicts.length && !allowVoid)
    throw new DomainError(
      `This correction changes participants in played games: ${conflicts.join(", ")}. Review and explicitly authorize voiding these results and replaying the affected games. Nothing has been changed.`,
      409,
      conflicts,
    );
  return changed;
}
export async function command(
  staffId: string,
  eventId: string,
  input: unknown,
) {
  await authorizeStaff(staffId);
  const { action } = z.object({ action: z.string() }).parse(input);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      let e = await fresh(tx, eventId);
      switch (action) {
        case "saveEntry": {
          unlocked(e);
          const d = entrySchema.parse(input);
          if (d.entryId && !e.entries.some((t) => t.id === d.entryId))
            throw new DomainError("Team not in this event.");
          const errors = entryErrors(e, [d], d.entryId);
          if (errors.length) throw new DomainError(errors.join(" "));
          const data = {
            name: d.name,
            nameKey: key(d.name),
            seed: d.seed,
            poolId: e.pools.find((p) => p.name === d.pool)!.id,
          };
          if (d.entryId) {
            await tx.rosterEntry.deleteMany({ where: { entryId: d.entryId } });
            await tx.teamEntry.update({
              where: { id: d.entryId },
              data: {
                ...data,
                confirmedAt: null,
                checkedInAt: null,
                roster: {
                  create: d.players.map((p) => ({
                    ...p,
                    nameKey: key(p.name),
                  })),
                },
              },
            });
          } else
            await tx.teamEntry.create({
              data: {
                ...data,
                eventId,
                roster: {
                  create: d.players.map((p) => ({
                    ...p,
                    nameKey: key(p.name),
                  })),
                },
              },
            });
          await audit(
            tx,
            eventId,
            staffId,
            "ENTRY_SAVED",
            `${d.name}: roster saved; confirmation and check-in reset.`,
          );
          break;
        }
        case "previewImport": {
          unlocked(e);
          const d = z
            .object({
              csv: z.string().max(100_000),
              filename: name,
              mapping: z
                .object({
                  team: name,
                  player: name,
                  pool: name,
                  seed: name,
                  slot: name,
                })
                .default(defaultMapping),
            })
            .parse(input);
          const parsed = parseCsv(d.csv, d.mapping);
          const errors = [
            ...parsed.errors,
            ...validateImport(
              parsed.rows,
              e.entries.map((t) => ({
                name: t.name,
                seed: t.seed,
                players: t.roster.map((p) => p.name),
              })),
            ),
          ];
          const groups = [...new Set(parsed.rows.map((r) => key(r.team)))].map(
            (k) => {
              const rs = parsed.rows.filter((r) => key(r.team) === k);
              return {
                name: rs[0].team,
                seed: rs[0].seed,
                pool: rs[0].pool,
                players: rs.map((r) => ({ name: r.player, slot: r.slot })),
              };
            },
          );
          if (parsed.rows.length) errors.push(...entryErrors(e, groups));
          if (errors.length)
            return {
              errors: [...new Set(errors)],
              rows: parsed.rows,
              headers: parsed.headers,
            };
          const batch = await tx.importBatch.create({
            data: {
              eventId,
              staffId,
              filename: d.filename,
              rows: { create: parsed.rows },
            },
          });
          return {
            batchId: batch.id,
            errors: [],
            rows: parsed.rows,
            headers: parsed.headers,
          };
        }
        case "commitImport": {
          unlocked(e);
          const d = z
            .object({
              batchId: id,
              confirmed: z.literal(true),
              synthetic: z.literal(true),
            })
            .parse(input);
          const batch = await tx.importBatch.findFirst({
            where: { id: d.batchId, eventId, staffId },
            include: { rows: { orderBy: { line: "asc" } } },
          });
          if (!batch || batch.status !== "PREVIEW")
            throw new DomainError(
              "This import preview is unavailable or already committed.",
            );
          const groups = [...new Set(batch.rows.map((r) => key(r.team)))].map(
            (k) => {
              const rs = batch.rows.filter((r) => key(r.team) === k);
              return {
                name: rs[0].team,
                pool: rs[0].pool,
                seed: rs[0].seed,
                players: rs.map((r) => ({ name: r.player, slot: r.slot })),
              };
            },
          );
          const errors = entryErrors(e, groups);
          if (errors.length)
            throw new DomainError(`Preview is stale. ${errors.join(" ")}`);
          for (const g of groups)
            await tx.teamEntry.create({
              data: {
                eventId,
                name: g.name,
                nameKey: key(g.name),
                seed: g.seed,
                poolId: e.pools.find((p) => p.name === g.pool)!.id,
                roster: {
                  create: g.players.map((p) => ({
                    ...p,
                    nameKey: key(p.name),
                  })),
                },
              },
            });
          await tx.importBatch.update({
            where: { id: batch.id },
            data: { status: "COMMITTED", committedAt: new Date() },
          });
          await audit(
            tx,
            eventId,
            staffId,
            "IMPORT_COMMITTED",
            `${batch.filename}: ${groups.length} teams, ${batch.rows.length} synthetic players. Preview ${batch.id}.`,
          );
          break;
        }
        case "confirmEntry": {
          unlocked(e);
          const d = z.object({ entryId: id }).parse(input);
          const t = e.entries.find((t) => t.id === d.entryId);
          if (!t) throw new DomainError("Team not found.");
          const errors = validateRoster(t.roster);
          if (errors.length) throw new DomainError(errors.join(" "));
          await tx.teamEntry.update({
            where: { id: t.id },
            data: { confirmedAt: new Date() },
          });
          await audit(tx, eventId, staffId, "ENTRY_CONFIRMED", t.name);
          break;
        }
        case "checkIn": {
          unlocked(e);
          const d = z
            .object({
              entryId: id,
              playerId: id.optional(),
              checked: z.boolean(),
            })
            .parse(input);
          const t = e.entries.find((t) => t.id === d.entryId);
          if (!t || !t.confirmedAt)
            throw new DomainError("Confirm the team entry before check-in.");
          const at = d.checked ? new Date() : null;
          if (d.playerId) {
            if (!t.roster.some((p) => p.id === d.playerId))
              throw new DomainError("Player not in this team.");
            await tx.rosterEntry.update({
              where: { id: d.playerId },
              data: { checkedInAt: at },
            });
          } else
            await tx.teamEntry.update({
              where: { id: t.id },
              data: { checkedInAt: at },
            });
          await audit(
            tx,
            eventId,
            staffId,
            "CHECK_IN",
            `${t.name} / ${d.playerId ? t.roster.find((p) => p.id === d.playerId)!.name : "team"}: ${d.checked ? "present" : "undone"}.`,
          );
          break;
        }
        case "generateFixtures": {
          unlocked(e);
          if (
            e.entries.length !== 8 ||
            e.pools.some(
              (p) => e.entries.filter((t) => t.poolId === p.id).length !== 4,
            )
          )
            throw new DomainError(
              "Exactly eight teams, four in each pool, are required.",
            );
          if (
            e.entries.some(
              (t) =>
                !t.confirmedAt ||
                !t.checkedInAt ||
                t.roster.filter((p) => p.slot <= 3).some((p) => !p.checkedInAt),
            )
          )
            throw new DomainError(
              "Confirm every entry and check in every team and all three core players first.",
            );
          for (const [i, p] of e.pools.entries()) {
            const pairs = roundRobin(
              e.entries.filter((t) => t.poolId === p.id).map((t) => t.id),
            );
            for (const [n, pair] of pairs.entries())
              await tx.fixture.create({
                data: {
                  eventId,
                  poolId: p.id,
                  code: `${p.name}-${n + 1}`,
                  stage: "POOL",
                  court: `Court ${i + 1}`,
                  startsAt: new Date(e.startsAt.getTime() + n * 15 * 60_000),
                  ...pair,
                  homeSource: "Pool entry",
                  awaySource: "Pool entry",
                },
              });
          }
          const knockout = [
            {
              code: "SF-1",
              stage: "SEMIFINAL" as const,
              court: "Court 1",
              offset: 120,
              homeSource: "Pool A · 1st",
              awaySource: "Pool B · 2nd",
            },
            {
              code: "SF-2",
              stage: "SEMIFINAL" as const,
              court: "Court 2",
              offset: 120,
              homeSource: "Pool B · 1st",
              awaySource: "Pool A · 2nd",
            },
            {
              code: "THIRD",
              stage: "THIRD" as const,
              court: "Court 1",
              offset: 150,
              homeSource: "Loser SF-1",
              awaySource: "Loser SF-2",
            },
            {
              code: "FINAL",
              stage: "FINAL" as const,
              court: "Court 1",
              offset: 180,
              homeSource: "Winner SF-1",
              awaySource: "Winner SF-2",
            },
          ];
          for (const { offset, ...f } of knockout)
            await tx.fixture.create({
              data: {
                ...f,
                eventId,
                startsAt: new Date(e.startsAt.getTime() + offset * 60_000),
              },
            });
          await audit(
            tx,
            eventId,
            staffId,
            "FIXTURES_GENERATED",
            "12 pool games and 4 knockout slots generated; entries locked.",
          );
          break;
        }
        case "recordResult": {
          const d = z
            .object({
              fixtureId: id,
              homeScore: z.number(),
              awayScore: z.number(),
              expectedResultId: id.nullable(),
              reason: z.string().trim().max(500).optional(),
              authorizeReplay: z.boolean().default(false),
            })
            .parse(input);
          const f = e.fixtures.find((f) => f.id === d.fixtureId);
          if (!f) throw new DomainError("Fixture not found.");
          validateScore(f.homeId, f.awayId, d.homeScore, d.awayScore);
          const old = current(f);
          if ((old?.id ?? null) !== d.expectedResultId)
            throw new DomainError(
              "This game changed since you opened it. Refresh and review the latest result.",
              409,
            );
          if (old && (!d.reason || d.reason.length < 8))
            throw new DomainError(
              "Corrections require a meaningful reason (at least 8 characters).",
            );
          if (
            old &&
            old.homeScore === d.homeScore &&
            old.awayScore === d.awayScore
          )
            throw new DomainError("The replacement score is unchanged.");
          if (old)
            await tx.gameResult.update({
              where: { id: old.id },
              data: { status: "SUPERSEDED" },
            });
          const result = await tx.gameResult.create({
            data: {
              fixtureId: f.id,
              homeId: f.homeId!,
              awayId: f.awayId!,
              homeScore: d.homeScore,
              awayScore: d.awayScore,
              staffId,
            },
          });
          if (old)
            await tx.resultCorrection.create({
              data: {
                previousId: old.id,
                replacementId: result.id,
                reason: d.reason!,
                staffId,
              },
            });
          e = await fresh(tx, eventId);
          await reconcile(
            tx,
            e,
            staffId,
            Boolean(old && d.authorizeReplay),
            d.reason ?? "",
          );
          // Any result revision invalidates the placement sign-off, even if participants stay the same.
          await tx.eventPlacement.deleteMany({ where: { eventId } });
          await tx.event.update({
            where: { id: eventId },
            data: { placementsConfirmedAt: null },
          });
          await audit(
            tx,
            eventId,
            staffId,
            old ? "RESULT_CORRECTED" : "RESULT_CONFIRMED",
            `${f.code}: ${d.homeScore}–${d.awayScore}${old ? `; replaced ${old.homeScore}–${old.awayScore}; ${d.reason}` : ""}`,
          );
          break;
        }
        case "confirmPlacements": {
          if (e.fixtures.length !== 16 || e.fixtures.some((f) => !current(f)))
            throw new DomainError(
              "Confirm every pool and knockout result before final placements.",
            );
          const final = outcome(
              game(e.fixtures.find((f) => f.code === "FINAL")!),
            )!,
            third = outcome(game(e.fixtures.find((f) => f.code === "THIRD")!))!;
          const lower = poolTables(e)
            .flatMap((p) => p.rows.slice(2))
            .sort(
              (a, b) =>
                a.rank - b.rank ||
                b.won - a.won ||
                b.diff - a.diff ||
                b.for - a.for ||
                a.seed - b.seed,
            )
            .map((t) => t.id);
          const ordered = [
            final.winner,
            final.loser,
            third.winner,
            third.loser,
            ...lower,
          ];
          if (new Set(ordered).size !== 8)
            throw new DomainError("Placement integrity conflict.", 409);
          await tx.eventPlacement.deleteMany({ where: { eventId } });
          await tx.eventPlacement.createMany({
            data: ordered.map((entryId, i) => ({
              eventId,
              entryId,
              place: i + 1,
            })),
          });
          await tx.event.update({
            where: { id: eventId },
            data: { placementsConfirmedAt: new Date() },
          });
          await audit(
            tx,
            eventId,
            staffId,
            "PLACEMENTS_CONFIRMED",
            "All eight final placements reviewed and confirmed.",
          );
          break;
        }
        case "publish": {
          const d = z
            .object({
              field: z.enum([
                "public",
                "schedulePublished",
                "resultsPublished",
              ]),
              value: z.boolean(),
            })
            .parse(input);
          if (d.field !== "public" && d.value && !e.fixtures.length)
            throw new DomainError(
              "Generate fixtures before publishing the schedule or results.",
            );
          if (d.field === "resultsPublished" && d.value && !e.schedulePublished)
            throw new DomainError("Publish the schedule before results.");
          const data = {
            [d.field]: d.value,
            ...(d.field === "schedulePublished" && !d.value
              ? { resultsPublished: false }
              : {}),
          };
          await tx.event.update({ where: { id: eventId }, data });
          await audit(
            tx,
            eventId,
            staffId,
            "PUBLICATION",
            `${d.field}: ${d.value ? "published" : "unpublished"}.`,
          );
          break;
        }
        case "announce": {
          const d = z
            .object({ text: z.string().trim().min(1).max(500) })
            .parse(input);
          await tx.eventAnnouncement.create({
            data: { eventId, text: d.text },
          });
          await audit(tx, eventId, staffId, "ANNOUNCEMENT", d.text);
          break;
        }
        case "toggleAnnouncement": {
          const d = z
            .object({ announcementId: id, published: z.boolean() })
            .parse(input);
          if (!e.announcements.some((a) => a.id === d.announcementId))
            throw new DomainError("Announcement not found.");
          await tx.eventAnnouncement.update({
            where: { id: d.announcementId },
            data: { published: d.published },
          });
          await audit(
            tx,
            eventId,
            staffId,
            "ANNOUNCEMENT_VISIBILITY",
            `${d.announcementId}: ${d.published}`,
          );
          break;
        }
        default:
          throw new DomainError("Unknown operator action.");
      }
      return { ok: true };
    },
    { timeout: 20_000 },
  );
}
