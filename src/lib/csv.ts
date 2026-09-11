import { parse } from "csv-parse/sync";
import { key, validateRoster } from "./domain";
export type ImportRowData = {
  line: number;
  team: string;
  player: string;
  slot: number;
  fibaPoints: number;
  playerColumn: string;
  pointsColumn: string;
  pool: string;
  seed: number;
};
export type Mapping = Record<string, string>;
export const defaultMapping: Mapping = {
  layout: "long",
  team: "team",
  player: "player",
  points: "",
  slot: "slot",
};
const normalized = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, "");
const aliases: Record<string, string[]> = {
  team: ["team", "teamname", "squad", "club"],
  player: ["player", "playername", "athlete", "person"],
  points: ["fibapoints", "rankingpoints", "fibarankingpoints", "points"],
  slot: ["slot", "rosterslot", "position"],
};
for (let n = 1; n <= 4; n++) {
  aliases[`player${n}`] = [
    `player${n}`,
    `player${n}name`,
    `athlete${n}`,
    ...(n === 4 ? ["substitute", "sub", "substitutename"] : []),
  ];
  aliases[`points${n}`] = [
    `player${n}points`,
    `player${n}fibapoints`,
    `points${n}`,
    ...(n === 4 ? ["substitutepoints", "subpoints"] : []),
  ];
}
function records(csv: string): { record: string[]; info: { lines: number } }[] {
  if (Buffer.byteLength(csv) > 1_000_000) throw new Error("CSV exceeds 1 MB.");
  const rows = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    trim: true,
    info: true,
  }) as unknown as { record: string[]; info: { lines: number } }[];
  if (rows.length > 513) throw new Error("CSV exceeds 512 source rows.");
  if (rows[0]?.record.length > 100) throw new Error("CSV exceeds 100 columns.");
  return rows;
}
export function inspectCsv(csv: string) {
  try {
    const rows = records(csv),
      headers = rows[0]?.record ?? [];
    if (
      !headers.length ||
      new Set(headers.map(normalized)).size !== headers.length
    )
      throw new Error("Missing or duplicate column headers.");
    const suggestions: Mapping = {},
      ambiguities: string[] = [];
    for (const [field, names] of Object.entries(aliases)) {
      const matches = headers.filter((h) => names.includes(normalized(h)));
      suggestions[field] = matches.length === 1 ? matches[0] : "";
      if (matches.length > 1)
        ambiguities.push(`${field}: choose between ${matches.join(", ")}`);
    }
    suggestions.layout =
      suggestions.player && !suggestions.player1
        ? "long"
        : suggestions.player1 && !suggestions.player
          ? "wide"
          : "";
    return {
      headers,
      suggestions,
      ambiguities,
      sourceRows: rows.length - 1,
      errors: [] as string[],
    };
  } catch (err) {
    return {
      headers: [] as string[],
      suggestions: {} as Mapping,
      ambiguities: [],
      sourceRows: 0,
      errors: [
        err instanceof Error && !err.message.includes("Invalid")
          ? err.message
          : "Malformed CSV: check quotes and consistent column counts.",
      ],
    };
  }
}
export function parseCsv(
  csv: string,
  mapping?: Mapping,
): {
  rows: ImportRowData[];
  errors: string[];
  headers: string[];
  mapping: Mapping;
  ignored: string[];
} {
  const inspected = inspectCsv(csv),
    m = mapping ?? inspected.suggestions;
  const fail = (errors: string[]) => ({
    rows: [],
    errors,
    headers: inspected.headers,
    mapping: m,
    ignored: [],
  });
  if (inspected.errors.length) return fail(inspected.errors);
  if (!mapping && inspected.ambiguities.length)
    return fail(
      inspected.ambiguities.map(
        (e) => `Ambiguous mapping: ${e}. Review columns first.`,
      ),
    );
  const layout = m.layout ?? (m.player ? "long" : "");
  if (!["long", "wide"].includes(layout))
    return fail(["Choose long or wide layout and review the column mappings."]);
  const fields =
    layout === "long"
      ? ["team", "player", "points", "slot"]
      : [
          "team",
          "player1",
          "points1",
          "player2",
          "points2",
          "player3",
          "points3",
          "player4",
          "points4",
        ];
  const required =
    layout === "long"
      ? ["team", "player"]
      : ["team", "player1", "player2", "player3"];
  if (
    required.some((f) => !m[f]) ||
    fields.some((f) => m[f] && !inspected.headers.includes(m[f]))
  )
    return fail(["Map every required field to an existing source column."]);
  const used = fields.map((f) => m[f]).filter(Boolean);
  if (used.length !== new Set(used).size)
    return fail(["A source column cannot map to multiple fields."]);
  try {
    const source = records(csv).slice(1),
      rows: ImportRowData[] = [],
      slots = new Map<string, number>();
    for (const r of source) {
      const get = (f: string) =>
        m[f] ? (r.record[inspected.headers.indexOf(m[f])]?.trim() ?? "") : "";
      const team = get("team");
      const push = (playerField: string, pointsField: string, slot: number) =>
        rows.push({
          line: r.info.lines,
          team,
          player: get(playerField),
          slot,
          fibaPoints: get(pointsField) ? Number(get(pointsField)) : 0,
          playerColumn: m[playerField],
          pointsColumn: m[pointsField] ?? "",
          pool: "",
          seed: 0,
        });
      if (layout === "long") {
        const slot = m.slot
          ? Number(get("slot"))
          : (slots.get(key(team)) ?? 0) + 1;
        slots.set(key(team), slot);
        push("player", "points", slot);
      } else
        for (let n = 1; n <= 4; n++)
          if (n <= 3 || get(`player${n}`) || get(`points${n}`))
            push(`player${n}`, `points${n}`, n);
    }
    return {
      rows,
      errors: validateImport(rows),
      headers: inspected.headers,
      mapping: { ...m, layout },
      ignored: inspected.headers.filter((h) => !used.includes(h)),
    };
  } catch {
    return fail(["Malformed CSV: check quotes and consistent column counts."]);
  }
}
export function validateImport(
  rows: ImportRowData[],
  existing: { name: string; players: string[]; seed?: number | null }[] = [],
  capacity = 128,
) {
  const errors: string[] = [];
  if (!rows.length) errors.push("CSV has no player rows.");
  if (rows.length > 512)
    errors.push("This local lab supports at most 512 normalized player rows.");
  const groups = new Map<string, ImportRowData[]>();
  for (const r of rows) {
    if (!r.team.trim() || r.team.length > 80)
      errors.push(`Row ${r.line}: missing team or name exceeds 80 characters.`);
    if (!r.player.trim() || r.player.length > 80)
      errors.push(
        `Row ${r.line}, column ${r.playerColumn}: missing player name or name exceeds 80 characters.`,
      );
    if (
      !Number.isInteger(r.fibaPoints) ||
      r.fibaPoints < 0 ||
      r.fibaPoints > 100_000_000
    )
      errors.push(
        `Row ${r.line}, column ${r.pointsColumn}: invalid ranking points (whole values 0–100000000).`,
      );
    groups.set(key(r.team), [...(groups.get(key(r.team)) ?? []), r]);
  }
  const usedPlayers = new Map<string, string>();
  for (const e of existing)
    for (const name of e.players) usedPlayers.set(key(name), key(e.name));
  for (const [name, team] of groups) {
    if (existing.some((e) => key(e.name) === name))
      errors.push(`${team[0].team}: duplicate team entry already exists.`);
    errors.push(
      ...validateRoster(
        team.map((r) => ({ name: r.player, slot: r.slot })),
      ).map((e) => `${team[0].team}: ${e}`),
    );
    for (const r of team) {
      const previous = usedPlayers.get(key(r.player));
      if (previous && previous !== name)
        errors.push(
          `Row ${r.line}, column ${r.playerColumn}: player conflicts with another team.`,
        );
      usedPlayers.set(key(r.player), name);
    }
  }
  if (groups.size + existing.length > capacity)
    errors.push(`Event capacity is ${capacity} teams.`);
  return [...new Set(errors)];
}
