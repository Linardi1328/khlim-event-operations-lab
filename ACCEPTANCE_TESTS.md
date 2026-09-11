# Acceptance and validation

## Reproduce

Use the isolated PostgreSQL setup in [README.md](README.md), Node 24 and pnpm 10.15.0. Apply migrations, seed, install Chromium and run `pnpm validate`. This runs lint → typecheck → unit → PostgreSQL integration → production build → Playwright. Stop an existing development server first so browser checks use the production build. CI uses a fresh PostgreSQL 17 service and its own production server.

Tests create uniquely named synthetic events and remove only their own data. Run suites sequentially against the lab database. Reports/traces are in ignored `playwright-report` and `test-results`; visual evidence is in `docs/qa`. GitHub Actions uploads all three directories. No production or Digital database is used.

## Format-flexibility validation, 11 September 2026

Environment: Node 24.20.0, pnpm 10.15.0, Next.js 16.3.4, Prisma 7.10.0, PostgreSQL 17, Playwright 1.63.0, installed Google Chrome on macOS. CI installs Playwright Chromium.

| Check | Result |
| --- | --- |
| Clean PostgreSQL migration | PASS: all five migrations applied to a separate empty database |
| Seed and repeat seed | PASS: 1 event, 8 teams, 32 synthetic players, 2 pools, 1 staff; zero premature pool assignments on the fresh seed |
| Lint | PASS: zero errors/warnings |
| Strict typecheck | PASS |
| Unit | PASS: **75/75**, two files |
| PostgreSQL integration | PASS: **19/19**, three files |
| Production build | PASS: 11 routes |
| Playwright | PASS: **9/9**, production build |
| Formatting and Git whitespace | PASS |
| Privacy and authorization | PASS: explicit public allowlists, every anonymous command rejected, foreign Origin rejected |
| Axe assertions | PASS: tested staff overview and all five public views, including partial/completed states |

The separate clean-migration database was dropped after verification. Existing local review events were retained. The original seed remains a setup starting point. `pnpm db:demo:flex` adds an 18-team, four-pool review event with a 12-team playoff field, a walkover and approved delay estimates; `--complete` finishes it. The manually operated review event also retains a semifinal correction and two medal-game replays.

Non-failing diagnostics remain visible: Prisma's PostgreSQL 8.x adapter emits a concurrent-client-query deprecation warning during relation reads; the pinned driver passes the concurrency tests. Re-evaluate before upgrading to pg 9. Node/Playwright also reports conflicting color-environment settings. Neither is hidden or treated as a test failure.

### Real PostgreSQL format cases

Every row runs the draw, schedule, complete pool and playoff results, and unique final placements, then verifies persisted state. Third place is enabled in this table.

| Teams | Pools / sizes | Automatic per pool + wildcards | Playoff field | Pool games | Total games |
| --- | --- | --- | --- | --- | --- |
| 8 | 2 / 4,4 | 2 + 0 | 4 | 12 | 16 |
| 12 | 3 / 4,4,4 | 2 + 2 | 8 | 18 | 26 |
| 16 | 4 / 4,4,4,4 | 3 + 0 | 12 | 24 | 36 |
| 18 | 4 / 5,5,4,4 | 2 + 0 | 8 | 32 | 40 |
| 20 | 4 / 5,5,5,5 | 3 + 0 | 12 | 40 | 52 |
| 24 | 6 / 4,4,4,4,4,4 | 2 + 4 | 16 | 36 | 52 |
| 32 | 8 / eight pools of four | 4 + 0 | 32 | 48 | 80 |

The additional browser/manual 18-team case uses top three per pool, a 12-team field, four byes and **44** total games. Pure bracket tests cover fields 4, 8, 12, 16, 20, 24 and 32; round robins cover sizes 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24 and 32. Large pool tests are algorithm checks, not a claim that a 32-team single pool fits a practical one-day event.

## Executable coverage

| Boundary | Evidence |
| --- | --- |
| Format preview, unequal pools, capacity, qualification equation, timezone/DST | `tests/unit/flexible.test.ts`; creation in Playwright; actual registration validated again at draw |
| General round robin | Exact n(n−1)/2 count, unique unordered matchups, no self games, odd-size rotation |
| Top-three points and official draw | Seed score includes substitute when in top three; equal-score random order; repeat RNG seed reproduces input order, pots and assignments; balanced unequal pools |
| Draw authorization/audit | Server rejects manual pool/seed and client-selected RNG seed; explicit confirmation, stale version rejection, redraw reason/version snapshots; roster/import invalidates old draw; fixtures lock redraw |
| FIBA-inspired ordering | Wins, two-way head-to-head, multi-team mini-table/subgroup, capped average, seed; PD deliberately excluded; duplicate final seed ambiguity rejected |
| Walkover | Explicit command/type, exact 21–0 display PF/PA/PD, winner excluded from average numerator and denominator; played 21–0 remains a different result; correction preserves kind/history |
| Qualification and byes | Complete-results gate, automatic and deterministic best remaining, unequal-game win ratio, no inter-pool head-to-head, higher qualification positions receive byes, deterministic first-round rematch avoidance |
| General bracket reconciliation | Typed winner/loser sources; 12-team deep tree; played opening-round and pool corrections roll back atomically before consent; only affected descendants void; replay and sign-off recover |
| Original Black/Lime correction | Migrated `LEGACY_V1` fixture: Black 18–16 Lime → Black 16–18 Lime; unplayed recomputation and played-descendant conflict/replay remain regression cases |
| Result integrity | Invalid/self/tied/fractional/negative/over-50 rejection; missing result distinct from zero; immutable revisions; stale forms and concurrent writes rejected; same-winner correction withdraws placements |
| Scheduling / Event Twin | Planned start/courts/slot/rest policy; actual observations; draft projection has no public effect; approval required; stale proposal rejected; plans unchanged; late court/team/round propagation; newly qualified fixtures retain DELAYED status |
| CSV normalization | Long and wide layouts; aliases/case/whitespace/order; irrelevant columns; optional zero points; missing/malformed/conflicting rows; source line/columns; ambiguous mappings require review |
| CSV atomic boundary | No entries before confirmation; invalid preview blocks commit; concurrent/double commit protection; inspection-in-flight disables mapping to prevent late suggestions overwriting human choices |
| Roster management | Three required core players and optional substitute; duplicate/size/slot checks; point input/provenance; edit/remove substitute invalidates confirmation/draw; editor comes into view and receives focus |
| Privacy/publication | Public DTOs exclude rosters, individual ranking points, seed-score inputs, draw RNG/audit, staff/session/import data; public/event/schedule/results/sign-off gates; unauthenticated read-only access |
| Persistence | Fresh client reads placements and audit; transaction rollback assertions; clean migrations/seed; application production restarts retain review event state |

Tests in `tests/unit/domain.test.ts`, `tests/integration/workflow.test.ts` and `tests/integration/v1.test.ts` preserve still-valid earlier coverage. Fixed pool assignment tests are intentionally superseded by official-draw assertions. The old standings rule exists only for migration compatibility, not new events.

## Nine browser scenarios

1. Create 12-team / three-pool / wildcard format through UI; inspect preview; wide CSV mapping/preview/confirmation; confirm entries and check in; official draw; publish; enter 26 results; inspect automatic/wildcard order; correct and publish placements.
2. Original dangerous correction: conflict leaves tournament unchanged; explicit replay consent, affected games and history remain understandable.
3. Anonymous mutations, CSRF, malformed requests, roster/import validation, privacy, empty states, keyboard focus and tablet long names.
4. An open correction retains its original revision across refresh; newer staff writes cause rejection; public publication toggles take effect.
5. Unknown/custom long-format headers require mapping; in-flight inspection locks controls; manual mappings survive; long names fit mobile views.
6. Edit core/substitute/ranking points, verify editor focus, confirm top-three seed effect; witnessed draw/redraw with preserved history; no manual pools; post-fixture lock.
7. All five public tabs at 390×844 and 360×800; pools, time/court filter, empty scores versus legitimate zero, semifinal-to-medal progression; contained navigation and accessible touch targets.
8. Eighteen teams / four unequal pools / twelve playoff teams; staff walkover and actual timing; propose/review/approve delay; complete deep bracket; inspect mobile pool matrices and playoffs.
9. Ambiguous CSV stays at mapping review; shared select padding/chevron at 1440, 820, 390 and 360px.

## Manual browser QA

In addition to Playwright, the running production app was operated using a separate browser session. Screenshots were opened and visually inspected.

- **Desktop:** Overview; semifinal/final/third score entry; valid zero score; placement confirmation; reverse a semifinal winner after medal games; inspect conflict naming FINAL/THIRD, authorize targeted replay, finish replays and reconfirm. Public champion changed to the corrected winner. Staff history preserves old and replacement results.
- **Tablet 820×1180:** team/check-in cards, roster editor and 3+1 constraints, ranking-point inputs, official draw controls and locks, shared select rendering. The editor initially opened above the scrolled card; this was fixed by scrolling/focusing the editor and covered by Playwright.
- **Mobile 390×844 and 360×800:** Overview, Pools, Schedule, Scores and Playoffs; five tabs fit; long names wrap; no document horizontal overflow. Matchup/stat tables deliberately scroll within focusable containers; their text is not compressed to fit. Scores align; W/O labels and real zero remain distinct. Twelve-team play-ins, byes, later rounds and final outcome remain stacked and readable. Planned/estimated delay labels and court filtering were inspected.

Selected evidence: [creation](docs/qa/flex-creation-desktop.png), [staff roster](docs/qa/flex-staff-roster-edit.png), [draw tablet](docs/qa/flex-staff-draw-tablet.png), [recovery](docs/qa/flex-live-recovery-desktop.png), [manual correction consent](docs/qa/flex-manual-correction.png), [mobile pools](docs/qa/flex-unequal-360-pools.png), [mobile deep playoffs](docs/qa/flex-unequal-390-playoffs.png), [mobile completed Overview](docs/qa/flex-manual-360-overview.png), [shared dropdown](docs/qa/flex-select-360.png).

Verification also caught and fixed CSV inspection overwriting a just-selected mapping, delayed fixtures reverting to SCHEDULED during qualification, and PostgreSQL event-cascade ordering across new draw/bracket references. Clean migrations and integration cleanup now verify the deferred constraints. Earlier privacy projection and stale correction protections remain intact.

## Limits of this evidence

This is ready for founder product review, not production certification. There was no real tournament, physical mobile/tablet device test, screen-reader study, hostile RNG fairness audit, broad browser matrix or network-outage field exercise. Axe checks are scoped automated checks, not accessibility certification. Bounds (128 teams, 16 pools/courts, 32 qualifiers, 1,024 pool games) limit a local process; the largest limits have not been load-tested. FIBA-inspired policy differences and future Organization/Auth/Athlete/Evidence adoption gates are documented in [DOMAIN_MODEL.md](DOMAIN_MODEL.md) and [INTEGRATION_HANDOFF.md](INTEGRATION_HANDOFF.md).

Original Experiment #002 and public V1 evidence remains in Git history and earlier `docs/qa` artifacts, including [validation.txt](docs/qa/validation.txt). Those historical counts and manual-pool workflows are not the current acceptance contract.
