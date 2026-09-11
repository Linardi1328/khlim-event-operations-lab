"use client";
import { useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import type { ImportRowData, Mapping } from "@/lib/csv";
import type { EventDTO } from "./operations";
import { Badge, Button, Feedback, useRequest, useHydrated } from "./ui";
type Preview = {
  batchId?: string;
  errors: string[];
  rows: ImportRowData[];
  headers: string[];
};
export function ImportTeams({ event: e }: { event: EventDTO }) {
  const r = useRequest();
  const hydrated = useHydrated();
  const [csv, setCsv] = useState(""),
    [filename, setFilename] = useState(""),
    [headers, setHeaders] = useState<string[]>([]),
    [preview, setPreview] = useState<Preview | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [mapping, setMapping] = useState<Mapping>({
      team: "team",
      player: "player",
      pool: "pool",
      seed: "seed",
      slot: "slot",
    });
  const locked = e.fixtures.length > 0;
  async function load(file: File) {
    r.clear();
    setPreview(null);
    setConfirmed(false);
    setFilename(file.name);
    if (file.size > 100_000) {
      setCsv("");
      setPreview({ errors: ["CSV exceeds 100 KB."], rows: [], headers: [] });
      return;
    }
    const text = await file.text();
    setCsv(text);
    const h = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)[0]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""));
    setHeaders(h);
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
              <span>UTF-8 · up to 100 KB · 32 player rows</span>
              <input
                aria-label="Upload roster CSV"
                type="file"
                disabled={!hydrated}
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
                <div className="mapping-grid">
                  {(Object.keys(mapping) as (keyof Mapping)[]).map((field) => (
                    <label key={field}>
                      {field === "slot"
                        ? "Roster slot"
                        : field === "seed"
                          ? "Seed priority"
                          : field[0].toUpperCase() + field.slice(1)}
                      <select
                        aria-label={
                          field === "slot"
                            ? "Roster slot"
                            : field === "seed"
                              ? "Seed priority"
                              : field[0].toUpperCase() + field.slice(1)
                        }
                        value={mapping[field]}
                        onChange={(ev) => {
                          setMapping({ ...mapping, [field]: ev.target.value });
                          setPreview(null);
                          setConfirmed(false);
                        }}
                      >
                        {!headers.includes(mapping[field]) && (
                          <option value={mapping[field]}>Choose column</option>
                        )}
                        {headers.map((h, i) => (
                          <option key={i} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="muted">
                  Pool: A or B · Seed: unique team priority 1–8 · Slot: core
                  1–3, optional substitute 4.
                </p>
                <Button
                  busy={r.busy}
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
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Pool</th>
                  <th>Seed</th>
                  <th>Slot</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line}>
                    <td>{row.line}</td>
                    <td>{row.team}</td>
                    <td>{row.player}</td>
                    <td>{row.pool}</td>
                    <td>{row.seed}</td>
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
