# KHLIM Event Operations Lab

Astra Experiment #002: an isolated Event OS experiment for operating one synthetic one-day 3×3 basketball tournament, from registration to published final placements. It produces tested domain logic, reusable scenarios and an explicit handoff for later human-reviewed adaptation into KHLIM Digital.

**The application shell and lab scaffolding are disposable. Validated domain decisions, logic, test cases and integration lessons are the durable outputs. This does not establish production readiness or authorize production code reuse.** See [ASTRA_EXPERIMENT.md](ASTRA_EXPERIMENT.md) for the protocol.

The parent project and future review destination is **KHLIM Digital Ecosystem, Event OS**, after Organization #001 / tenancy foundations are ready. No direct integration happens here; this lab must never become a second production source of truth. [INTEGRATION_HANDOFF.md](INTEGRATION_HANDOFF.md) maps candidates and required rework without accessing the Digital repository.

## Boundaries

Synthetic events, teams, participants and staff only. No KHLIM production data, credentials, databases, APIs or infrastructure. No integration with KHLIM Digital Ecosystem. No payments, memberships, real registration, AI, video, scouting, rankings or production deployment. No paid service is required. Lab participant IDs must **never** be migrated as canonical athlete identities.

## Run locally

Requirements: Node.js **24**, pnpm **10.15.0**, Docker with Compose (or an isolated PostgreSQL 17 database), and Git. Use the Node version in `.nvmrc`; newer Node majors are outside the validated baseline.

```bash
nvm use                       # or activate Node 24 with your version manager
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
# Start Docker Desktop first if necessary.
docker compose up -d --wait db
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open **[http://127.0.0.1:3000](http://127.0.0.1:3000)**. Use this hostname consistently: the lab checks request Origin against `APP_ORIGIN`. The application and Docker database bind to loopback. PostgreSQL is on **54329**, using its own `lab_postgres` volume.

Disposable synthetic staff credentials:

- Username: **`event.staff`**
- Password: **`LabOnly!3x3`**

This is deliberately lab-only authentication: a seeded account with a salted scrypt password hash, database-backed eight-hour sessions, and an HttpOnly SameSite=Strict cookie. Credentials are intentionally public. Never deploy this authentication or reuse its credentials in KHLIM Digital.

For the production-mode **local** server:

```bash
pnpm build
pnpm start
```

`APP_ORIGIN` must match the URL used by your browser. Changing it requires restarting the app. Nothing in this repository deploys the application.

## What is seeded

`pnpm db:seed` is repeatable and does not overwrite an existing event. It creates:

- KHLIM One-Day 3×3, 10 October 2026, Kuala Lumpur, 09:00 MYT;
- eight teams: Black, Lime, Amber, Coral, Blue, Violet, Teal, Silver;
- two pools of four and 32 fictional roster entries (three core + one substitute each);
- the disposable EVENT_STAFF account and a public welcome announcement;
- court/time policy ready to generate 12 pool fixtures and four knockout slots.

The seeded event starts before entry confirmation and check-in, so a reviewer can operate it themselves. Optional completed review data:

```bash
pnpm db:demo
```

This adds a **new** fully operated “KHLIM Matchday Review” event, using the same commands as the UI. It includes the Black/Lime correction, all games, placements and public results. It prints its public and staff URLs. The original seed event remains untouched. Each demo invocation creates another event.

To reset **all event data in this disposable local database** (including tests/demo events and sessions):

```bash
pnpm db:reset --yes-lab-only
```

The reset refuses non-loopback hosts, a database name other than `khlim_lab`, or a missing confirmation flag. It reseeds the initial event, keeping the staff account. Do not point this application at a shared database. `docker compose stop` preserves the volume; a container or app restart does not reset tournament state.

## Operate a tournament

1. Sign in at `/login`; select the seeded event, or create a fresh event from **Your events**.
2. Use **Teams & check-in** to add/edit rosters, or **CSV import** to register a fresh event using [benchmark-teams.csv](public/samples/benchmark-teams.csv). The existing seed already contains these entries, so importing the full sample there correctly reports duplicates.
3. In **Teams & check-in → Manage pools**, review both four-team lists. Reassign teams together (for example Black to B and Blue to A), then **Save pool assignments**. Both pools must contain four teams; changes are atomic and stale forms are rejected. Pool-only changes preserve roster confirmation and attendance. Review seed priority, then **Confirm entry** for each team. Check in the team and each of its three core players. Substitute check-in is optional.
4. **Generate fixtures** from Overview or Schedule & scores. Entries, pools, seeds and check-in now lock. The two court schedules use 15-minute pool slots, semifinals at 11:00, third place at 11:30 and final at 12:00 MYT.
5. In **Public event**, publish the overview, schedule and scores/standings. These are separate controls. Unpublishing the schedule also unpublishes scores. Add/hide announcements here.
6. In **Schedule & scores**, enter and confirm all 12 results. Blank means no result; `0–1` is a valid score. Tied, fractional, negative and over-50 scores are rejected. Use [pool-results.csv](public/samples/pool-results.csv) as a manual exercise sheet (score import is outside scope).
7. View **Pool standings**. Top two qualify after **both** pools finish. SF-1 = A1/B2; SF-2 = B1/A2. The fixtures populate automatically from confirmed results.
8. Complete semifinals, then final and third-place games. Winners and losers propagate automatically.
9. **Confirm final placements**. Public results include all eight places once scores are published and staff have signed off.
10. Use **Activity & corrections** to inspect original, superseded and voided results and recent staff actions.

Public pages require no sign-in. The V1 navigation is **Overview · Pools · Schedule · Scores · Playoffs**:

- **Overview:** event name/date/venue, publication-aware status, actual team count, next scheduled games, champion after sign-off, and event-desk updates.
- **Pools:** authoritative Pool A/B team lists, with optional expandable standings underneath. No public player rosters.
- **Schedule:** published fixtures with time, court, opponents, stage and status; a simple court filter.
- **Scores:** only published completed results, grouped by pool, semifinals and medal games. A legitimate `0` is shown; an unplayed game is absent here and has an em dash in Schedule.
- **Playoffs:** A1/B2 and B1/A2 semifinals, winners/losers advancing to final/third-place game, and staff-confirmed final placements.

Old public standings/knockout/placements/announcements links redirect to the corresponding V1 view. Announcements and placements remain durable capabilities without separate navigation tabs. Refresh fetches current PostgreSQL state; the prototype does not push live updates.

Staff own all team/player setup. Open **Edit [team]** to change core players, enter an optional substitute, or clear the substitute field to remove that player. Three core players are mandatory; removing one requires a replacement. Roster saves reset confirmation/check-in and are blocked after fixtures exist. Pool assignments also lock once fixtures exist; use a fresh event for a different pool structure, preserving the original games/history.

The first production-oriented Event OS slice should prioritize **ADMIN: team/player setup → pool assignment → schedule → scores → playoffs**, and **PUBLIC: pools → schedule → scores → playoffs**. Public rosters, player profiles/statistics, player authentication and broader FIBA-style functionality are deferred. Selective adaptation into KHLIM Digital remains conditional on Organization #001 / tenancy foundations and human review.

## Correct a result

Click **Correct result**, replace the scores and give a reason. The original score, staff actor and time remain in history. Open correction forms carry the original result ID; stale writes are rejected.

Required example: A-5 initially has **Black 18–16 Lime**. Change it to **Black 16–18 Lime**. With the sample pool scores, Lime replaces Black as A2. Unplayed downstream fixtures update automatically.

If affected knockout games already have results, the first attempt returns a conflict listing the affected games and **changes nothing**. Staff must check the explicit replay authorization and resubmit. Only affected results are marked VOIDED (never deleted); unplayed participants reconcile, unaffected games remain valid, and placement sign-off is withdrawn. Replay those games, reconfirm placements, then review the public event. This lab has no adjudication/appeal engine.

## Validate

```bash
pnpm exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
# Or all six checks in sequence:
pnpm validate
```

Integration/browser tests create their own synthetic events in `khlim_lab` and remove them afterwards; the seeded event is preserved. Run one validation suite at a time. Playwright starts the production server if none is running; stop `pnpm dev` first when validating the production build. Tests use Chromium; optionally set `PLAYWRIGHT_CHROME_PATH` to an installed Chrome executable. Tests and migrations need a running PostgreSQL database.

GitHub Actions runs migrations and seed from a clean PostgreSQL service, all checks, and production-server Playwright. Reports/traces/screenshots are uploaded as artifacts. See [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) for coverage and recorded results.

## Architecture and learning outputs

- [INTEGRATION_HANDOFF.md](INTEGRATION_HANDOFF.md): reuse candidates, destination concepts and adoption gates.
- [ARCHITECTURE.md](ARCHITECTURE.md): runtime, trust boundaries, transactions and workflow policy.
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md): authoritative records, projections, tiebreaks, lifecycle and corrections.
- [MIGRATION_LESSONS.md](MIGRATION_LESSONS.md): what should survive the lab, what must not, and what remains unproven.
- [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md): executable coverage, browser QA and validation evidence.

Known boundaries: one fixed format; no forfeits, no-shows, cancellations, delays or rescheduling; entries/check-in lock when fixtures are created; names are only a lab conflict heuristic; no original-file evidence storage; no realtime/offline queue; no actual device or on-court trial. Places 5–8 are a documented comparison policy, not additional classification games. Staff share event-wide privileges. Never treat these shortcuts as production design approval.
