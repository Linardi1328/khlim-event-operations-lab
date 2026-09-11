import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import {
  formatSchema,
  formatIssues,
  zonedStart,
  FORMAT_VERSION,
  STANDINGS_VERSION,
} from "./competition/format";
import { runDraw, DRAW_VERSION, SEEDING_VERSION } from "./competition/draw";
import {
  bracketGraph,
  bracketEntrants,
  type Source,
} from "./competition/bracket";
import { planGames, projectSchedule } from "./competition/schedule";
import { db } from "./db";
import { authorizeStaff } from "./auth";
import {
  DomainError,
  key,
  validateRoster,
  validateScore,
  roundRobin,
  interPoolCompare,
  outcome,
} from "./domain";
import { parseCsv, validateImport, inspectCsv } from "./csv";
import {
  current,
  eventInclude,
  game,
  poolTables,
  qualification,
  type EventData,
} from "./query";
import type { Prisma } from "../generated/prisma/client";
type Tx = Prisma.TransactionClient;
const name = z.string().trim().min(1).max(80);
const id = z.string().min(1);
const rosterSchema = z.array(
  z.object({
    name,
    slot: z.number().int().min(1).max(4),
    fibaPoints: z.number().int().min(0).max(100_000_000).default(0),
    pointsProvenance: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .default("Staff entered; synthetic lab points"),
  }),
);
const entrySchema = z
  .object({
    action: z.literal("saveEntry"),
    entryId: id.optional(),
    name,
    players: rosterSchema,
    synthetic: z.literal(true),
  })
  .strict();
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
    players: { name: string; slot: number; fibaPoints: number }[];
  }[],
  exclude?: string,
) {
  return validateImport(
    entries.flatMap((t) =>
      t.players.map((p, i) => ({
        line: i + 1,
        team: t.name,
        player: p.name,
        slot: p.slot,
        fibaPoints: p.fibaPoints,
        playerColumn: "player",
        pointsColumn: "ranking points",
        pool: "",
        seed: 0,
      })),
    ),
    e.entries
      .filter((t) => t.id !== exclude)
      .map((t) => ({ name: t.name, players: t.roster.map((p) => p.name) })),
    e.maxTeams,
  );
}
async function invalidateDraw(tx: Tx, e: EventData) {
  await tx.draw.updateMany({
    where: { eventId: e.id, status: "ACTIVE" },
    data: { status: "INVALIDATED" },
  });
  await tx.teamEntry.updateMany({
    where: { eventId: e.id },
    data: { poolId: null, seed: null, seedScore: null, seedingVersion: null },
  });
}
export async function createEvent(staffId: string, input: unknown) {
  await authorizeStaff(staffId);
  const data = formatSchema
    .extend({
      name,
      date: z.string(),
      venue: name,
      overview: z
        .string()
        .trim()
        .max(1000)
        .default(
          "A synthetic KHLIM 3x3 tournament. All teams and participants are fictional.",
        ),
    })
    .strict()
    .parse(input);
  const issues = formatIssues(data);
  if (issues.length) throw new DomainError(issues.join(" "));
  let startsAt: Date;
  try {
    startsAt = zonedStart(data.date, data.plannedStart, data.timezone);
  } catch (err) {
    throw new DomainError((err as Error).message);
  }
  const fields = { ...data };
  Reflect.deleteProperty(fields, "date");
  return db.event.create({
    data: {
      ...fields,
      startsAt,
      slug: `${key(data.name)
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 45)}-${crypto.randomUUID().slice(0, 8)}`,
      pools: {
        create: Array.from({ length: data.poolCount }, (_, i) => ({
          name: String.fromCharCode(65 + i),
        })),
      },
      actions: {
        create: {
          staffId,
          kind: "EVENT_CREATED",
          detail: `${FORMAT_VERSION}: ${data.expectedTeams} expected teams; ${data.poolCount} pools; ${data.knockoutSize} qualifiers.`,
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
  const qualified = qualification(e);
  const nodes = bracketGraph(e.knockoutSize, e.thirdPlace);
  const entrants = qualified.length
    ? bracketEntrants(qualified, nodes)
    : new Map<number, string>();
  const tables = poolTables(e);
  const conflicts: string[] = [];
  const resolve = (s: EventData["fixtures"][number]["sources"][number]) => {
    if (s.kind === "QUALIFIER") return entrants.get(s.qualifierRank!) ?? null;
    if (s.kind === "POOL_RANK")
      return qualified.length
        ? (tables.find((p) => p.id === s.poolId)?.rows[s.poolRank! - 1]?.id ??
            null)
        : null;
    const parent = e.fixtures.find((f) => f.id === s.sourceFixtureId);
    return parent
      ? (outcome(game(parent))?.[s.kind === "WINNER" ? "winner" : "loser"] ??
          null)
      : null;
  };
  // Round numbers are topological: opening rounds first, final/third last.
  for (const f of e.fixtures
    .filter((f) => f.stage !== "POOL")
    .sort((a, b) => b.round - a.round || a.code.localeCompare(b.code))) {
    const home = f.sources.find((s) => s.side === "HOME"),
      away = f.sources.find((s) => s.side === "AWAY");
    if (!home || !away)
      throw new DomainError("Bracket source integrity conflict.", 409);
    const pair = [resolve(home), resolve(away)];
    if (pair[0] === f.homeId && pair[1] === f.awayId) continue;
    const r = current(f);
    if (r || f.actualStart) {
      conflicts.push(f.code);
      if (allowVoid && r) {
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
      if (r) r.status = "VOIDED";
    }
    f.homeId = pair[0];
    f.awayId = pair[1];
    changed = true;
    await tx.fixture.update({
      where: { id: f.id },
      data: {
        homeId: pair[0],
        awayId: pair[1],
        status:
          r || f.actualStart
            ? "REPLAY_REQUIRED"
            : f.projectedStartsAt > f.startsAt
              ? "DELAYED"
              : "SCHEDULED",
        actualStart: null,
        actualEnd: null,
      },
    });
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
        case "assignPools":
          throw new DomainError(
            "Manual pool selection is disabled. Use Run official draw.",
          );
        case "runDraw": {
          unlocked(e);
          const d = z
            .object({
              action: z.literal("runDraw"),
              confirmed: z.literal(true),
              expectedDrawVersion: z.number().int().nullable(),
              reason: z.string().trim().max(500).optional(),
            })
            .strict()
            .parse(input);
          if ((e.draws[0]?.version ?? null) !== d.expectedDrawVersion)
            throw new DomainError(
              "The draw changed since you opened this form. Refresh and review.",
              409,
            );
          if (e.draws.length && (!d.reason || d.reason.length < 8))
            throw new DomainError(
              "A redraw requires an explicit reason of at least eight characters.",
            );
          if (e.entries.some((t) => !t.confirmedAt))
            throw new DomainError(
              "Confirm all eligible team entries before the draw.",
            );
          const issues = formatIssues(e, e.entries.length);
          if (issues.length) throw new DomainError(issues.join(" "));
          const inputs = [...e.entries].sort((a, b) =>
            a.id.localeCompare(b.id),
          );
          const rngSeed = randomBytes(16).toString("hex");
          const drawn = runDraw(
            inputs.map((t) => ({
              id: t.id,
              points: t.roster.map((p) => p.fibaPoints),
            })),
            e.poolCount,
            rngSeed,
          );
          await tx.draw.updateMany({
            where: { eventId, status: "ACTIVE" },
            data: { status: "SUPERSEDED" },
          });
          await tx.teamEntry.updateMany({
            where: { eventId },
            data: { seed: null, poolId: null },
          });
          const draw = await tx.draw.create({
            data: {
              eventId,
              staffId,
              version: (e.draws[0]?.version ?? 0) + 1,
              algorithmVersion: DRAW_VERSION,
              seedingVersion: SEEDING_VERSION,
              rngSeed,
              reason: d.reason ?? "Initial official draw",
            },
          });
          for (const t of drawn) {
            const input = inputs.find((i) => i.id === t.id)!,
              poolId = e.pools[t.poolIndex].id;
            await tx.teamEntry.update({
              where: { id: t.id },
              data: {
                poolId,
                seed: t.eventSeed,
                seedScore: t.seedScore,
                seedingVersion: SEEDING_VERSION,
              },
            });
            await tx.drawEntry.create({
              data: {
                drawId: draw.id,
                entryId: t.id,
                teamName: input.name,
                inputOrder: inputs.indexOf(input),
                seedScore: t.seedScore,
                eventSeed: t.eventSeed,
                tieBreak: t.tieBreak,
                pot: t.pot,
                poolId,
                players: {
                  create: input.roster.map((p) => ({
                    name: p.name,
                    slot: p.slot,
                    points: p.fibaPoints,
                    provenance: p.pointsProvenance,
                  })),
                },
              },
            });
          }
          await tx.event.update({
            where: { id: eventId },
            data: {
              formatVersion: FORMAT_VERSION,
              standingsVersion: STANDINGS_VERSION,
            },
          });
          await audit(
            tx,
            eventId,
            staffId,
            "OFFICIAL_DRAW",
            `Draw ${draw.version}; ${DRAW_VERSION}; ${inputs.length} entries; ${d.reason ?? "initial draw"}`,
          );
          break;
        }
        case "saveEntry": {
          unlocked(e);
          const d = entrySchema.parse(input);
          if (d.entryId && !e.entries.some((t) => t.id === d.entryId))
            throw new DomainError("Team not in this event.");
          const errors = entryErrors(e, [d], d.entryId);
          if (errors.length) throw new DomainError(errors.join(" "));
          await invalidateDraw(tx, e);
          const data = {
            name: d.name,
            nameKey: key(d.name),
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
        case "inspectImport": {
          unlocked(e);
          const d = z.object({ csv: z.string().max(1_000_000) }).parse(input);
          return inspectCsv(d.csv);
        }
        case "previewImport": {
          unlocked(e);
          const d = z
            .object({
              csv: z.string().max(1_000_000),
              filename: name,
              mapping: z.record(z.string(), z.string()).optional(),
            })
            .parse(input);
          const parsed = parseCsv(d.csv, d.mapping);
          const errors = [
            ...parsed.errors,
            ...validateImport(
              parsed.rows,
              e.entries.map((t) => ({
                name: t.name,
                players: t.roster.map((p) => p.name),
              })),
              e.maxTeams,
            ),
          ];
          if (errors.length) return { ...parsed, errors: [...new Set(errors)] };
          const batch = await tx.importBatch.create({
            data: {
              eventId,
              staffId,
              filename: d.filename,
              layout: parsed.mapping.layout,
              sourceHash: createHash("sha256").update(d.csv).digest("hex"),
              mappings: {
                create: Object.entries(parsed.mapping).map(
                  ([field, column]) => ({ field, column }),
                ),
              },
              rows: { create: parsed.rows },
            },
          });
          return { ...parsed, batchId: batch.id, errors: [] };
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

                players: rs.map((r) => ({
                  name: r.player,
                  slot: r.slot,
                  fibaPoints: r.fibaPoints,
                  pointsProvenance:
                    `CSV ${batch.filename}; line ${r.line}; column ${r.pointsColumn || "unranked default"}; SHA256 ${batch.sourceHash}`.slice(
                      0,
                      200,
                    ),
                })),
              };
            },
          );
          const errors = entryErrors(e, groups);
          if (errors.length)
            throw new DomainError(`Preview is stale. ${errors.join(" ")}`);
          await invalidateDraw(tx, e);
          for (const g of groups)
            await tx.teamEntry.create({
              data: {
                eventId,
                name: g.name,
                nameKey: key(g.name),

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
          if (!e.draws.some((d) => d.status === "ACTIVE"))
            throw new DomainError(
              "Run the official draw before generating fixtures.",
            );
          const issues = formatIssues(e, e.entries.length);
          const sizes = e.pools.map(
            (p) => e.entries.filter((t) => t.poolId === p.id).length,
          );
          if (
            issues.length ||
            sizes.some((n) => n < 2) ||
            Math.max(...sizes) - Math.min(...sizes) > 1 ||
            e.entries.some((t) => !t.poolId || !t.seed)
          )
            throw new DomainError(
              `Invalid pool composition. ${issues.join(" ")}`,
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
          const poolGames = e.pools
            .flatMap((p) =>
              roundRobin(
                e.entries.filter((t) => t.poolId === p.id).map((t) => t.id),
              ).map((g, i) => ({
                id: `${p.name}-${i + 1}`,
                code: `${p.name}-${i + 1}`,
                poolId: p.id,
                stage: "POOL" as const,
                round: g.round,
                homeId: g.homeId,
                awayId: g.awayId,
                homeSource: "Pool entry",
                awaySource: "Pool entry",
              })),
            )
            .sort((a, b) => a.round - b.round || a.code.localeCompare(b.code));
          const graph = bracketGraph(e.knockoutSize, e.thirdPlace);
          const label = (s: Source) =>
            s.kind === "QUALIFIER"
              ? `Playoff slot ${s.qualifierRank}`
              : `${s.kind === "WINNER" ? "Winner" : "Loser"} ${s.sourceCode}`;
          const knockout = graph.map((n) => ({
            id: n.code,
            code: n.code,
            poolId: null,
            stage: n.stage,
            round: n.round,
            homeId: null,
            awayId: null,
            homeSource: label(n.home),
            awaySource: label(n.away),
          }));
          const planned = planGames([...poolGames, ...knockout], e.startsAt, e);
          const ids = new Map<string, string>();
          for (const item of planned) {
            const { id: code, ...data } = item;
            const f = await tx.fixture.create({ data: { ...data, eventId } });
            ids.set(code, f.id);
          }
          for (const n of graph)
            for (const [side, source] of [
              ["HOME", n.home],
              ["AWAY", n.away],
            ] as const)
              await tx.fixtureSource.create({
                data: {
                  eventId,
                  fixtureId: ids.get(n.code)!,
                  side,
                  kind: source.kind,
                  ...(source.kind === "QUALIFIER"
                    ? { qualifierRank: source.qualifierRank }
                    : { sourceFixtureId: ids.get(source.sourceCode)! }),
                },
              });
          await audit(
            tx,
            eventId,
            staffId,
            "FIXTURES_GENERATED",
            `${poolGames.length} pool games and ${graph.length} bracket games; planned times fixed.`,
          );
          break;
        }
        case "recordWalkover":
        case "recordResult": {
          const raw = z
            .object({ winner: z.enum(["HOME", "AWAY"]).optional() })
            .parse(input);
          if (action === "recordWalkover" && !raw.winner)
            throw new DomainError("Choose the walkover winner.");
          const normalizedInput =
            action === "recordWalkover"
              ? {
                  ...(input as object),
                  homeScore: raw.winner === "HOME" ? 21 : 0,
                  awayScore: raw.winner === "AWAY" ? 21 : 0,
                }
              : input;
          const kind = action === "recordWalkover" ? "WALKOVER" : "PLAYED";
          const d = z
            .object({
              fixtureId: id,
              homeScore: z.number(),
              awayScore: z.number(),
              expectedResultId: id.nullable(),
              reason: z.string().trim().max(500).optional(),
              authorizeReplay: z.boolean().default(false),
            })
            .parse(normalizedInput);
          const f = e.fixtures.find((f) => f.id === d.fixtureId);
          if (!f) throw new DomainError("Fixture not found.");
          validateScore(f.homeId, f.awayId, d.homeScore, d.awayScore);
          const old = current(f);
          if ((old?.id ?? null) !== d.expectedResultId)
            throw new DomainError(
              "This game changed since you opened it. Refresh and review the latest result.",
              409,
            );
          if (
            (old || kind === "WALKOVER") &&
            (!d.reason || d.reason.length < 8)
          )
            throw new DomainError(
              "Corrections and walkovers require a meaningful reason (at least 8 characters).",
            );
          if (
            old &&
            old.homeScore === d.homeScore &&
            old.awayScore === d.awayScore &&
            old.kind === kind
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
              kind,
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
          await tx.fixture.update({
            where: { id: f.id },
            data: {
              status: kind === "WALKOVER" ? "WALKOVER" : "COMPLETED",
              ...(kind === "WALKOVER"
                ? { actualStart: null, actualEnd: null }
                : {}),
            },
          });
          await tx.event.update({
            where: { id: eventId },
            data: { scheduleRevision: { increment: 1 } },
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
            `${f.code}: ${kind} ${d.homeScore}–${d.awayScore}${old ? `; replaced ${old.homeScore}–${old.awayScore}` : ""}; ${d.reason ?? "agreed played score"}`,
          );
          break;
        }
        case "observeTiming": {
          const d = z
            .object({
              fixtureId: id,
              expectedRevision: z.number().int(),
              startedAt: z.iso.datetime(),
              endedAt: z.iso.datetime().nullable(),
              reason: z.string().trim().min(8).max(500),
            })
            .parse(input);
          if (d.expectedRevision !== e.scheduleRevision)
            throw new DomainError(
              "Event timing changed. Refresh and review before saving.",
              409,
            );
          const f = e.fixtures.find((f) => f.id === d.fixtureId);
          if (!f || !f.homeId || !f.awayId)
            throw new DomainError(
              "Timing needs a fixture with both participants confirmed.",
            );
          if (current(f)?.kind === "WALKOVER")
            throw new DomainError("A walkover has no played start/end time.");
          const startedAt = new Date(d.startedAt),
            endedAt = d.endedAt ? new Date(d.endedAt) : null;
          if (endedAt && endedAt <= startedAt)
            throw new DomainError("Actual end must be after actual start.");
          if (
            Math.abs(startedAt.getTime() - e.startsAt.getTime()) >
              7 * 86400_000 ||
            (endedAt && endedAt.getTime() - startedAt.getTime() > 12 * 3600_000)
          )
            throw new DomainError(
              "Timing must be within seven days of the event and under twelve hours per game.",
            );
          // Retain every observation, even when staff later correct a timestamp.
          await tx.fixtureTiming.create({
            data: {
              fixtureId: f.id,
              startedAt,
              endedAt,
              reason: d.reason,
              staffId,
            },
          });
          await tx.fixture.update({
            where: { id: f.id },
            data: {
              actualStart: startedAt,
              actualEnd: endedAt,
              status: current(f)
                ? "COMPLETED"
                : endedAt
                  ? "AWAITING_RESULT"
                  : "IN_PROGRESS",
            },
          });
          await tx.event.update({
            where: { id: eventId },
            data: { scheduleRevision: { increment: 1 } },
          });
          await audit(
            tx,
            eventId,
            staffId,
            "TIMING_OBSERVED",
            `${f.code}: ${d.startedAt} → ${d.endedAt ?? "in progress"}; ${d.reason}. Calculate recovery to update estimates.`,
          );
          break;
        }
        case "proposeRecovery": {
          const d = z
            .object({
              expectedRevision: z.number().int(),
              court: z.string().optional(),
              delayMinutes: z.number().int().min(0).max(720).default(0),
              reason: z.string().trim().min(8).max(500),
            })
            .parse(input);
          if (d.expectedRevision !== e.scheduleRevision)
            throw new DomainError(
              "Event timing changed. Refresh before calculating recovery.",
              409,
            );
          if (!e.fixtures.length)
            throw new DomainError("Generate a schedule first.");
          if (d.delayMinutes && !d.court)
            throw new DomainError("Choose the delayed court.");
          const projection = projectSchedule(
            e.fixtures.map((f) => ({ ...f, completed: !!current(f) })),
            e,
            d.court ? { court: d.court, minutes: d.delayMinutes } : undefined,
          );
          const items = projection.filter(
            (p) => p.previous.getTime() !== p.proposed.getTime(),
          );
          if (!items.length)
            throw new DomainError(
              "No unstarted games need a later estimate. Current projections already absorb this disruption.",
            );
          const proposal = await tx.recoveryProposal.create({
            data: {
              eventId,
              staffId,
              baseRevision: e.scheduleRevision,
              algorithmVersion: "COURT_REST_BARRIERS_V1",
              reason: d.reason,
              court: d.court,
              delayMinutes: d.delayMinutes,
              items: { create: items },
            },
          });
          await audit(
            tx,
            eventId,
            staffId,
            "RECOVERY_PROPOSED",
            `${proposal.id}: ${items.length} estimated starts affected; public estimates unchanged pending approval.`,
          );
          return { ok: true, proposalId: proposal.id };
        }
        case "approveRecovery": {
          const d = z
            .object({ proposalId: id, confirmed: z.literal(true) })
            .parse(input);
          const proposal = await tx.recoveryProposal.findFirst({
            where: { id: d.proposalId, eventId },
            include: { items: true },
          });
          if (!proposal || proposal.status !== "PROPOSED")
            throw new DomainError(
              "Recovery proposal is unavailable or already applied.",
            );
          if (proposal.baseRevision !== e.scheduleRevision)
            throw new DomainError(
              "This recovery proposal is stale. Calculate a fresh impact from current event state.",
              409,
            );
          for (const item of proposal.items) {
            const f = e.fixtures.find((f) => f.id === item.fixtureId)!;
            if (
              f.actualStart ||
              current(f) ||
              f.projectedStartsAt.getTime() !== item.previous.getTime()
            )
              throw new DomainError(
                "Fixture state changed. Recalculate recovery.",
                409,
              );
            await tx.fixture.update({
              where: { id: f.id },
              data: {
                projectedStartsAt: item.proposed,
                status:
                  f.status === "REPLAY_REQUIRED"
                    ? "REPLAY_REQUIRED"
                    : item.proposed > f.startsAt
                      ? "DELAYED"
                      : "SCHEDULED",
              },
            });
          }
          await tx.recoveryProposal.update({
            where: { id: proposal.id },
            data: { status: "APPLIED", appliedAt: new Date() },
          });
          await tx.event.update({
            where: { id: eventId },
            data: { scheduleRevision: { increment: 1 } },
          });
          await audit(
            tx,
            eventId,
            staffId,
            "RECOVERY_APPROVED",
            `${proposal.id}: ${proposal.items.length} estimates updated; planned schedule preserved; ${proposal.reason}`,
          );
          break;
        }
        case "confirmPlacements": {
          if (!e.fixtures.length || e.fixtures.some((f) => !current(f)))
            throw new DomainError(
              "Confirm every pool and knockout result before final placements.",
            );
          const final = outcome(
            game(e.fixtures.find((f) => f.stage === "FINAL")!),
          )!;
          const thirdFixture = e.fixtures.find((f) => f.stage === "THIRD");
          const third = thirdFixture ? outcome(game(thirdFixture)) : null;
          const rows = poolTables(e).flatMap((p) => p.rows);
          const eliminated = new Map<string, number>();
          for (const f of e.fixtures.filter(
            (f) => f.stage !== "POOL" && f.stage !== "THIRD",
          )) {
            const result = outcome(game(f));
            if (result) eliminated.set(result.loser, f.round);
          }
          const podium = [
            final.winner,
            final.loser,
            ...(third ? [third.winner, third.loser] : []),
          ];
          const lower = rows
            .filter((r) => !podium.includes(r.id))
            .sort(
              (a, b) =>
                (eliminated.get(a.id) ?? 99) - (eliminated.get(b.id) ?? 99) ||
                a.rank - b.rank ||
                (e.standingsVersion === "LEGACY_V1"
                  ? b.won - a.won ||
                    b.diff - a.diff ||
                    b.for - a.for ||
                    a.seed! - b.seed!
                  : interPoolCompare(a, b)),
            )
            .map((t) => t.id);
          const ordered = [...podium, ...lower];
          if (new Set(ordered).size !== e.entries.length)
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
            `${e.entries.length} final placements reviewed and confirmed.`,
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
    { timeout: 60_000 },
  );
}
