"use client";
import { useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import type { ImportRowData, Mapping } from "@/lib/csv";
import type { EventDTO } from "./operations";
import { Badge, Button, Feedback, useRequest, useHydrated } from "./ui";
const columnLabel = (field: string) =>
  field === "team"
    ? "Team column"
    : field === "player"
      ? "Player column"
      : field === "points"
        ? "Ranking points (optional)"
        : field === "slot"
          ? "Roster slot (optional)"
          : `${field.replace(/(\d)/, " $1")} column`;
type Preview = {
  batchId?: string;
  errors: string[];
  rows: ImportRowData[];
  headers: string[];
  ignored?: string[];
};
export function ImportTeams({ event: e }: { event: EventDTO }) {
  const r = useRequest();
  const hydrated = useHydrated();
  const [csv, setCsv] = useState(""),
    [filename, setFilename] = useState(""),
    [headers, setHeaders] = useState<string[]>([]),
    [preview, setPreview] = useState<Preview | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [mapping, setMapping] = useState<Mapping>({}),
    [mappingIssues, setMappingIssues] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const locked = e.fixtures.length > 0;
  async function load(file: File) {
    r.clear();
    setInspecting(true);
    setCsv("");
    setHeaders([]);
    setMapping({});
    setPreview(null);
    setConfirmed(false);
    setFilename(file.name);
    if (file.size > 1_000_000) {
      setCsv("");
      setPreview({ errors: ["CSV exceeds 1 MB."], rows: [], headers: [] });
      setInspecting(false);
      return;
    }
    try {
      const text = await file.text();
      setCsv(text);
      const inspected = await r.run<{
        headers: string[];
        suggestions: Mapping;
        ambiguities: string[];
        errors: string[];
      }>(`/api/events/${e.id}/command`, { action: "inspectImport", csv: text });
      if (inspected) {
        setHeaders(inspected.headers);
        setMapping(inspected.suggestions);
        setMappingIssues([...inspected.ambiguities, ...inspected.errors]);
      }
    } catch {
      r.setError("Could not read this file. Choose a UTF-8 CSV and try again.");
    } finally {
      setInspecting(false);
    }
  }
  return (
    <div className="stack">
      <section className="panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">IMPORT WORKSPACE</span>
            <h2>From a team sheet to a ready roster.</h2>
            <p>Upload → map columns → review every row → confirm → commit.</p>
          </div>
          <a
            className="button secondary"
            href="/samples/benchmark-teams.csv"
            download
          >
            ↓ Sample CSV
          </a>
        </div>
        <div className="notice">
          Imports create new entries only. Duplicate teams or conflicting
          players block the entire batch. Use a new event for the full benchmark
          sample if these teams already exist.
        </div>
        {locked ? (
          <p className="notice error">
            Imports are locked once fixtures exist.
          </p>
        ) : (
          <>
            <label className="upload-zone">
              <Upload size={28} />
              <strong>Choose your roster CSV</strong>
              <span>
                UTF-8 · up to 1 MB · long or wide format · 512 player rows
              </span>
              <input
                aria-label="Upload roster CSV"
                type="file"
                disabled={!hydrated || inspecting || r.busy}
                accept=".csv,text/csv"
                onChange={(ev) => {
                  if (ev.target.files?.[0]) void load(ev.target.files[0]);
                }}
              />
            </label>
            {filename && (
              <p className="file-label">
                <FileSpreadsheet size={18} />
                {filename}
              </p>
            )}
            {csv && (
              <>
                <h3>Match your columns</h3>
                <p className="muted">
                  Suggestions use header aliases only. Review every mapping.
                  Unknown or ambiguous fields need your decision; unused columns
                  are ignored.
                </p>
                {mappingIssues.length > 0 && (
                  <div className="notice" role="status">
                    {mappingIssues.join(" · ")}
                  </div>
                )}
                <label>
                  CSV layout
                  <select
                    disabled={inspecting || r.busy}
                    value={mapping.layout ?? ""}
                    onChange={(ev) => {
                      setMapping({ ...mapping, layout: ev.target.value });
                      setPreview(null);
                      setConfirmed(false);
                    }}
                  >
                    <option value="">Choose layout</option>
                    <option value="long">Long — one player per row</option>
                    <option value="wide">Wide — one team per row</option>
                  </select>
                </label>
                <div className="mapping-grid">
                  {(mapping.layout === "wide"
                    ? [
                        "team",
                        "player1",
                        "points1",
                        "player2",
                        "points2",
                        "player3",
                        "points3",
                        "player4",
                        "points4",
                      ]
                    : ["team", "player", "points", "slot"]
                  ).map((field) => (
                    <label key={field}>
                      {columnLabel(field)}
                      <select
                        disabled={inspecting || r.busy}
                        aria-label={columnLabel(field)}
                        value={mapping[field] ?? ""}
                        onChange={(ev) => {
                          setMapping({ ...mapping, [field]: ev.target.value });
                          setPreview(null);
                          setConfirmed(false);
                        }}
                      >
                        <option value="">Unmapped / default</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="muted">
                  Missing points default to 0. In long format, missing slot
                  columns use team row order: core 1–3, optional substitute 4.
                  Pools and seeds come from the official draw.
                </p>
                <Button
                  busy={r.busy || inspecting}
                  onClick={async () => {
                    setConfirmed(false);
                    const p = await r.run<Preview>(
                      `/api/events/${e.id}/command`,
                      { action: "previewImport", csv, filename, mapping },
                      "Validation complete. Review the preview below.",
                    );
                    if (p) setPreview(p);
                  }}
                >
                  Validate & preview
                </Button>
              </>
            )}
          </>
        )}
        <Feedback request={r} />
      </section>
      {preview && (
        <section className="panel">
          <div className="section-title">
            <h2>Import preview</h2>
            <Badge tone={preview.errors.length ? "amber" : "lime"}>
              {preview.errors.length
                ? `${preview.errors.length} ISSUES`
                : `${new Set(preview.rows.map((r) => r.team)).size} TEAMS · ${preview.rows.length} PLAYERS`}
            </Badge>
          </div>
          {preview.errors.length > 0 ? (
            <div className="notice error" role="alert">
              <strong>
                Nothing will be imported until every issue is resolved.
              </strong>
              <ul>
                {preview.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>
              These teams and synthetic roster entries will be created. Entry
              confirmation and check-in happen after import.
            </p>
          )}
          {preview.ignored?.length ? (
            <p className="muted">
              Ignored columns: {preview.ignored.join(", ")}
            </p>
          ) : null}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Source column</th>
                  <th>Ranking points</th>
                  <th>Slot</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={`${row.line}-${row.slot}`}>
                    <td>{row.line}</td>
                    <td>{row.team}</td>
                    <td>{row.player}</td>
                    <td>{row.playerColumn}</td>
                    <td>{row.fibaPoints}</td>
                    <td>{row.slot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.batchId && !preview.errors.length && (
            <div className="import-confirm">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(ev) => setConfirmed(ev.target.checked)}
                />
                I reviewed this preview and confirm these are synthetic teams
                and players.
              </label>
              <Button
                disabled={!confirmed}
                busy={r.busy}
                onClick={async () => {
                  if (
                    await r.run(
                      `/api/events/${e.id}/command`,
                      {
                        action: "commitImport",
                        batchId: preview.batchId,
                        confirmed,
                        synthetic: true,
                      },
                      "Import committed. All teams are ready for entry confirmation and check-in.",
                    )
                  ) {
                    setPreview(null);
                    setCsv("");
                    setFilename("");
                    setConfirmed(false);
                  }
                }}
              >
                Confirm & import {new Set(preview.rows.map((r) => r.team)).size}{" "}
                teams
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
