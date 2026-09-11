import { parse } from "csv-parse/sync";
import { key, validateRoster } from "./domain";
export type ImportRowData = {
  line: number;
  team: string;
  player: string;
  pool: string;
  seed: number;
  slot: number;
};
export const defaultMapping = {
  team: "team",
  player: "player",
  pool: "pool",
  seed: "seed",
  slot: "slot",
};
export type Mapping = typeof defaultMapping;
export function parseCsv(
  csv: string,
  mapping: Mapping = defaultMapping,
): { rows: ImportRowData[]; errors: string[]; headers: string[] } {
  try {
    if (Buffer.byteLength(csv) > 100_000)
      return { rows: [], errors: ["CSV exceeds 100 KB."], headers: [] };
    const records: string[][] = parse(csv, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
    });
    const headers = records.shift() ?? [];
    if (headers.length !== new Set(headers).size)
      return { rows: [], errors: ["Duplicate column headers."], headers };
    const missing = Object.values(mapping).filter((h) => !headers.includes(h));
    if (missing.length)
      return {
        rows: [],
        errors: [`Map the required columns: ${missing.join(", ")}.`],
        headers,
      };
    const rows = records.map((r, i) => {
      const get = (field: keyof Mapping) => r[headers.indexOf(mapping[field])];
      return {
        line: i + 2,
        team: get("team"),
        player: get("player"),
        pool: get("pool").toUpperCase(),
        seed: Number(get("seed")),
        slot: Number(get("slot")),
      };
    });
    return { rows, errors: validateImport(rows), headers };
  } catch {
    return {
      rows: [],
      errors: ["Malformed CSV: check quotes and consistent column counts."],
      headers: [],
    };
  }
}
export function validateImport(
  rows: ImportRowData[],
  existing: { name: string; seed: number; players: string[] }[] = [],
) {
  const errors: string[] = [];
  if (!rows.length) errors.push("CSV has no player rows.");
  if (rows.length > 32)
    errors.push("This benchmark supports at most 32 player rows.");
  const groups = new Map<string, ImportRowData[]>();
  for (const r of rows) {
    if (!r.team.trim() || r.team.length > 80)
      errors.push(
        `Row ${r.line}: missing team or team name exceeds 80 characters.`,
      );
    if (!r.player.trim() || r.player.length > 80)
      errors.push(
        `Row ${r.line}: missing player name or name exceeds 80 characters.`,
      );
    if (!["A", "B"].includes(r.pool))
      errors.push(`Row ${r.line}: pool must be A or B.`);
    if (!Number.isInteger(r.seed) || r.seed < 1 || r.seed > 8)
      errors.push(`Row ${r.line}: seed must be 1–8.`);
    groups.set(key(r.team), [...(groups.get(key(r.team)) ?? []), r]);
  }
  const usedPlayers = new Map<string, string>();
  for (const entry of existing)
    for (const name of entry.players)
      usedPlayers.set(key(name), key(entry.name));
  const usedSeeds = new Set(existing.map((e) => e.seed));
  for (const [name, team] of groups) {
    if (existing.some((e) => key(e.name) === name))
      errors.push(`${team[0].team}: duplicate team entry already exists.`);
    if (
      team.some(
        (r) =>
          r.pool !== team[0].pool ||
          r.seed !== team[0].seed ||
          r.team !== team[0].team,
      )
    )
      errors.push(
        `${team[0].team}: conflicting team rows (name, pool or seed).`,
      );
    if (usedSeeds.has(team[0].seed))
      errors.push(`${team[0].team}: seed is already assigned to another team.`);
    usedSeeds.add(team[0].seed);
    errors.push(
      ...validateRoster(
        team.map((r) => ({ name: r.player, slot: r.slot })),
      ).map((e) => `${team[0].team}: ${e}`),
    );
    for (const r of team) {
      const previous = usedPlayers.get(key(r.player));
      if (previous && previous !== name)
        errors.push(`Row ${r.line}: player conflicts with another team.`);
      usedPlayers.set(key(r.player), name);
    }
  }
  if (groups.size + existing.length > 8)
    errors.push("Event capacity is eight teams.");
  for (const p of ["A", "B"])
    if ([...groups.values()].filter((g) => g[0].pool === p).length > 4)
      errors.push(`Pool ${p} exceeds four teams.`);
  return [...new Set(errors)];
}
