import type { Standing } from "@/lib/domain";
export function StandingsTable({ rows }: { rows: Standing[] }) {
  return (
    <>
      <div className="table-scroll">
        <table className="standings-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col">
                <abbr title="Played">P</abbr>
              </th>
              <th scope="col">
                <abbr title="Wins">W</abbr>
              </th>
              <th scope="col">
                <abbr title="Losses">L</abbr>
              </th>
              <th scope="col">
                <abbr title="Point difference">+/−</abbr>
              </th>
              <th scope="col">
                <abbr title="Points scored">PF</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className={t.rank <= 2 ? "qualifying" : ""}>
                <td>{t.rank}</td>
                <th scope="row">
                  {t.name}
                  <small>
                    Seed {t.seed}
                    {t.seedTiebreak && t.played ? " · seed tiebreak" : ""}
                  </small>
                </th>
                <td>{t.played}</td>
                <td>
                  <strong>{t.won}</strong>
                </td>
                <td>{t.lost}</td>
                <td>
                  {t.diff > 0 ? "+" : ""}
                  {t.diff}
                </td>
                <td>{t.for}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="muted">No entries in this pool yet.</p>}
      <p className="table-note">
        <span className="legend-dot" /> Top 2 ·{" "}
        {rows.length === 4 && rows.every((t) => t.played === 3)
          ? "Qualification confirmed"
          : "Provisional until pool play is complete"}
      </p>
    </>
  );
}
