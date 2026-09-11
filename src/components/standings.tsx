import type { Standing } from "@/lib/domain";
export function StandingsTable({
  rows,
  automatic = 2,
  qualifiedIds = [],
}: {
  rows: Standing[];
  automatic?: number;
  qualifiedIds?: string[];
}) {
  return (
    <>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Pool statistics"
      >
        <table className="standings-table">
          <thead>
            <tr>
              {[
                ["#", "Rank"],
                ["Team", "Team"],
                ["GP", "Games played"],
                ["W", "Wins"],
                ["L", "Losses"],
                ["PF", "Points for"],
                ["PA", "Points against"],
                ["PD", "Displayed point difference; not a tiebreak"],
                [
                  "AVG PTS",
                  "Tiebreak average: capped at 21; excludes walkover winning games",
                ],
                ["SEED", "Event seed"],
              ].map(([s, title]) => (
                <th scope="col" key={s}>
                  <abbr title={title}>{s}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className={
                  qualifiedIds.includes(t.id) || t.rank <= automatic
                    ? "qualifying"
                    : ""
                }
              >
                <td>{t.rank}</td>
                <th scope="row">
                  {t.name}
                  {qualifiedIds.includes(t.id) && <small>Qualified</small>}
                </th>
                <td>{t.played}</td>
                <td>
                  <strong>{t.won}</strong>
                </td>
                <td>{t.lost}</td>
                <td>{t.for}</td>
                <td>{t.against}</td>
                <td>
                  {t.diff > 0 ? "+" : ""}
                  {t.diff}
                </td>
                <td>{t.average.toFixed(2)}</td>
                <td>{t.seed ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="muted">No entries in this pool yet.</p>}
      <p className="table-note">
        <span className="legend-dot" /> Top {automatic} automatic ·{" "}
        {qualifiedIds.length
          ? "Qualification confirmed"
          : "Provisional until all pool play is complete"}
      </p>
    </>
  );
}
