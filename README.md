# KHLIM Event Operations Lab

Astra Experiment #002, refined into a flexible **3×3 Event OS prototype**. Operate synthetic tournaments from registration and a witnessed seeded draw through schedules, scores, live recovery, playoffs and final placements. The standalone shell is disposable; validated domain decisions, modules, tests and integration lessons are the durable outputs.

**Isolated lab only.** No KHLIM Digital code, credentials, databases or infrastructure are used or modified. No production deployment, paid services, AI, payments, membership, real athletes, public rosters or player accounts. Lab participant IDs must never become canonical Athlete identities. Selective future adaptation waits for **Organization #001 / tenancy foundations**, human review, production Auth, Audit and Evidence integration. See [experiment boundaries](ASTRA_EXPERIMENT.md) and [integration handoff](INTEGRATION_HANDOFF.md).

## Local setup

Node **24**, pnpm **10.15.0**, Docker Compose / isolated PostgreSQL **17**:

```bash
nvm use
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait db
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Use that hostname consistently: Origin must match `APP_ORIGIN`. App and DB bind to loopback; the dedicated PostgreSQL volume uses port **54329**. No external service is required.

Disposable staff sign-in: **`event.staff` / `LabOnly!3x3`**. Passwords are hashed with scrypt; eight-hour PostgreSQL sessions use hashed random tokens and HttpOnly/SameSite=Strict cookies. Credentials are intentionally public lab fixtures. Never deploy or migrate this authentication.

For local production-mode validation: `pnpm build && pnpm start`. Stop an existing server before rebuilding or starting another.

## Review data and reset

- `pnpm db:seed`: repeatable, preserves existing events. Creates an eight-team event with four synthetic players per team, invented ranking-point values, two empty pools, and staff. Confirm entries and run the draw yourself.
- `pnpm db:demo`: adds a completed eight-team review event, including a score correction.
- `pnpm db:demo:flex`: adds **18 teams / 4 unequal pools / 12 playoff qualifiers / 3 courts**, with draw provenance, a walkover, approved twelve-minute delay propagation and completed pool/play-in/quarterfinal games. Finish the semifinals and medal games yourself.
- `pnpm db:demo:flex --complete`: adds the same format with all results and placements confirmed.
- `pnpm db:reset --yes-lab-only`: deletes **all events and sessions** in the exact localhost `khlim_lab` DB and reseeds. Demo/reset scripts reject other DB targets. Creating a fresh event preserves prior history and is usually preferable.

Existing V1 events retain their original participants, results, planned times and `LEGACY_V1` standings. New events use the policies below. An unscheduled legacy event can enter the new policy only through an explicit official draw; played history is never silently reinterpreted.

## Operate an event

1. **Create event:** name, date, venue, IANA timezone, planned start, expected/max entries, pools, courts, automatic qualifiers, wildcards, playoff field and timing policy. The preview calculates balanced pool sizes, pool games, playoff games and byes. Actual confirmed entries govern the draw; expected count is a plan.
2. **Teams & check-in:** staff enter/edit three core players and an optional substitute. Record imported/staff-entered lab FIBA ranking points, or zero for unranked players. Names detect synthetic conflicts, not real identity. Saving an entry resets its confirmation/presence and invalidates an existing draw.
3. **CSV import:** upload → inspect layout/header suggestions → review/correct mappings → validate/preview → confirm → atomic commit. [Long example](public/samples/benchmark-teams.csv) and [wide example](public/samples/wide-teams.csv) are examples, not required organizer schemas. Extra columns, including obsolete pool/seed fields, are ignored and listed. Unknown/ambiguous columns require human mapping. No partial commits.
4. Confirm eligible entries, then **Run official draw**. Seeds use the sum of each team's three highest player point values; equal totals get a random audited order. Seeded pots distribute randomly across pools, with sizes differing by at most one. There is no manual pool or seed input. Redraw requires confirmation and a reason, retaining previous versions; any fixture blocks redraw.
5. Check in each team and its three core players. **Generate fixtures** creates arbitrary-size pool round robins and the linked playoff graph across configured courts. Registration/check-in now lock.
6. In **Public event**, publish overview, schedule and results separately. Unpublishing schedule also hides results. Announcements remain available without a primary navigation tab.
7. **Schedule & scores:** confirm played scores or explicitly record a **Walkover** with winner/reason. Walkovers display **21–0** and remain distinguishable from played scores. Blank is no result; zero is a valid score. Tied/fractional/negative/over-50 scores are rejected.
8. **Live timing & schedule recovery:** observe actual start/end, or select a court delay → calculate impact → review old/new estimates → explicitly approve. Planned times remain fixed; approved projections respect court turnaround, team rest and round dependencies. Stale proposals must be recalculated. Public pages update on refresh.
9. Confirm all pool results. Automatic and best-remaining qualifiers derive from standings. Brackets support 4/8/16/32 and intermediate fields via byes/play-ins. Higher qualification positions receive byes; the first round avoids same-pool opponents where the deterministic allocation permits.
10. Complete playoff rounds, optional third-place game and final. **Confirm final placements** only after every result. Review corrections, draw inputs, timing observations and operator history in the staff surfaces.

### Policies and corrections

`FIBA_INSPIRED_V2`: wins → head-to-head **wins only** within tied pool groups → average points → event seed. Multi-team head-to-head uses a win-only mini-table and reapplies to a smaller tied subgroup. Each game's average contribution is capped at 21; a walkover winner's game is excluded from both numerator and denominator. Displayed PF/PA/PD still include the recorded 21–0. Cross-pool comparisons use **win ratio → average → seed**, never head-to-head or point difference. See [DOMAIN_MODEL.md](DOMAIN_MODEL.md) for exact qualification, bye and placement policy.

**Correct result** retains the old result ID, requires a reason and appends a revision. Reconciliation traverses the entire advancement graph. If a changed participant affects a played or started descendant, the first attempt lists conflicts and rolls back everything. Staff may explicitly authorize targeted void/replay; only affected descendants lose current results, old values remain in history, and placement sign-off is withdrawn. Replay and reconfirm. The original Black 18–16 Lime → Black 16–18 Lime case remains a migrated-event regression test; new official draws do not guarantee those teams share a pool or fixture code.

This is **FIBA-inspired**, not certified Event Maker behavior. Top-three seeding uses invented/imported snapshots, not verified live rankings. Random pots differ from documented Event Maker snake examples; walkover 21–0 is a KHLIM display policy. No official ranking points are awarded, and no FIBA API is called. Official-rule interpretation and actual venue operations still need human review.

## Public V1

**Overview · Pools · Schedule · Scores · Playoffs**, no sign-in:

- Overview: event facts/status, team count, next games, champion after sign-off, updates.
- Pools: authoritative team lists, matchup matrices and GP/W/L/PF/PA/PD/AVG/SEED tables with qualification markers. Tables scroll within the page on phones; player rosters and individual ranking points stay private.
- Schedule: planned/estimated/actual times, court, teams, stage/status and one court filter.
- Scores: only published completed results, grouped by each pool and playoff stage. Unplayed games never appear as 0–0.
- Playoffs: dynamic round cards, source games, advancing winners, medal games and final placements.

The production-oriented slice remains **ADMIN: team/player setup → official pool draw → schedule → scores → playoffs**, **PUBLIC: pools → schedule → scores → playoffs**. Public player profiles, statistics, rankings, registration and broader FIBA-style features remain deferred.

## Validation

```bash
pnpm exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
# all checks:
pnpm validate
```

Tests create/remove their own synthetic events; run suites sequentially. Playwright starts `pnpm start` if needed; use a freshly built production server, not an old/dev server. Optional `PLAYWRIGHT_CHROME_PATH` selects installed Chrome. CI uses a fresh PostgreSQL service, migrations/seed and Chromium. [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) records exact results and browser evidence.

Technical bounds: up to 128 entries, 16 pools/courts, 32 playoff qualifiers, 1,024 pool fixtures, 512 imported player rows / 1 MB / 100 columns, 5–60 minute slots, 0–120 minute rest and 0–30 minute court turnaround. These bound a local prototype's work; they are not basketball rules. Schedule feasibility/end-of-day deadlines are not optimized automatically; organizers must review the generated schedule.

Known limits: format fixed after creation; entries/check-in lock on generation; no partial roster drafts/withdrawals, live push/offline queue, court-unavailability/team-lateness solver, cancellations, double forfeits, protest/adjudication engine or real-device/on-court trial. Recovery only moves unstarted estimates later; it does not optimize court swaps. Placement sign-off snapshots are replaced after corrections, not retained as publication versions. Lab staff share event-wide privileges. Green synthetic tests do not prove production readiness.

Further outputs: [architecture](ARCHITECTURE.md), [domain model](DOMAIN_MODEL.md), [migration lessons](MIGRATION_LESSONS.md), [integration handoff](INTEGRATION_HANDOFF.md).
