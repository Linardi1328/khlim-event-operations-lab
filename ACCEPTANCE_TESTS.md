# Acceptance and validation

## Reproduce the checks

Follow README setup using Node 24, pnpm 10.15.0 and an isolated PostgreSQL database. Then:

```bash
pnpm exec playwright install chromium
pnpm validate
```

This runs lint → typecheck → unit → real PostgreSQL integration → production build → Playwright. Stop any existing dev server first to make Playwright start the production server. CI always uses its own production server and a fresh PostgreSQL service.

Test events have unique IDs and are deleted by their test suite. Tests do not reset the reviewer's seeded event. Browser screenshots are written to `docs/qa`; Playwright reports/traces go to ignored `playwright-report`/`test-results` directories. GitHub Actions uploads those outputs for each run. Run suites sequentially against the lab database.

## Executable coverage

| Requirement                                                                     | Evidence                                                                                                                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Two four-team round robins; exactly six unique games per pool; three games/team | `tests/unit/domain.test.ts` and integration generated-fixture count                                                                          |
| Deterministic standings: wins, difference, points scored, seed                  | Unit table assertions, visible seed-priority qualification in browser                                                                        |
| Qualifiers gated until pools complete; cross-pool semifinals                    | Unit qualifier/pair tests and integration SF participant assertions                                                                          |
| Semifinal winners/losers feed final/third                                       | Unit outcomes, integration participant checks, browser semifinal/medal operations                                                            |
| Invalid/tied/fractional/negative/over-50 results and self matches rejected      | Parameterized unit tests, integration service rejection and PostgreSQL CHECK failure                                                         |
| No score versus numeric zero                                                    | Unit absent/zero assertions, integration and browser 0–1 third-place game                                                                    |
| Black 18–16 Lime corrected to Black 16–18 Lime                                  | Integration and full browser workflow; Lime replaces Black as A2                                                                             |
| Safe downstream recomputation                                                   | Integration checks changed unplayed semifinal, public data and retained unaffected games                                                     |
| Dangerous corrections after downstream play                                     | Integration checks atomic rollback; browser explicit conflict → replay checkbox → void/reconcile                                             |
| Correction provenance                                                           | Previous score, replacement/void, actor, timestamp and reason inspected in integration/history UI                                            |
| Winner-changing semifinal correction                                            | Integration invalidates affected played medal games                                                                                          |
| Same-winner correction still withdraws sign-off                                 | Integration corrects final score, keeps all 16 game results, clears/reconfirms placements                                                    |
| Concurrent/stale writes                                                         | Integration concurrent first result/CSV commit; browser correction form retains original revision after Refresh                              |
| Roster 3+1, slots, duplicate participants                                       | Unit checks, integration gates, browser manual edit rejected without corrupting entry                                                        |
| Import structure/group/existing-entry conflicts                                 | Unit missing team/player, malformed columns/quotes, too many players, repeated/conflicting rows; integration existing duplicates             |
| Preview and explicit atomic commit                                              | Browser inspects eight-team preview, disabled submit before confirmation and zero DB entries; integration stale/double submit tests          |
| Custom column mapping                                                           | Browser imports Club/Athlete/Group/Priority/Position into typed normalized rows                                                              |
| Staff authentication and session persistence                                    | Browser sign-in; integration issued/revoked sessions; unauthorized service test                                                              |
| Server-side mutation authorization                                              | Browser HTTP tests submit every event action unauthenticated (401), plus event creation; foreign Origin rejected (403), malformed JSON (400) |
| Public read-only/privacy/publication                                            | Unauthenticated browser context, public projection serialization assertions, draft 404, schedule/results/event unpublishing                  |
| Complete placements 1–8                                                         | Integration unique complete order; browser sign-off and unauthenticated public results                                                       |
| PostgreSQL persistence                                                          | New client reads the completed sign-off, page reload retains check-in/placements; separate dev-to-production restart comparison              |
| Responsive and keyboard behavior                                                | Desktop 1440×1000, tablet 820×1180, mobile 390×844 and 360×800; document overflow checks, keyboard focus and screenshots                     |
| Accessibility                                                                   | Axe WCAG 2 A/AA + 2.1 AA checks on the operator overview and all five V1 public views, including partial and completed tournament states     |

Seven Playwright scenarios group the complete nine requested browser journeys and add adversarial checks:

1. Create event in UI → upload/review/confirm CSV → confirm/check in all eight teams and core players → generate/publish → enter all pool scores → correct Black/Lime → verify qualifiers → play knockouts → confirm placements → traverse all mobile public views.
2. Complete knockouts, attempt dangerous pool correction, verify nothing changed, explicitly authorize replay, inspect retained history.
3. Reject all anonymous commands; manually enter/edit a long-name team; review roster and CSV errors; reject CSRF and malformed JSON; inspect public empty states and keyboard focus.
4. Keep an open correction form stale across another operator's revision and a page refresh; verify server rejection and publication/unpublication projections.
5. Map custom CSV columns; import/operate teams; verify a deliberately long team name fits public Pools, standings, Schedule, Scores and Playoffs.
6. Edit core players, remove/add the optional substitute, swap full pools, reject an unbalanced draft, reject a stale pool form after refresh, and inspect the post-fixture lock.
7. Verify no scores before results; a published `0–1` with unplayed games excluded; schedule time/court filtering; semifinal sources and medal participant propagation; navigate all five public views at both 390×844 and 360×800, checking tab dimensions and document/navigation overflow.

## Browser QA observations

Screenshots were visually inspected, not merely generated. Desktop uses an event navigation rail and two-column score/team cards; tablet switches to a horizontal navigation row; mobile public tables fit the viewport and knockout stages stack vertically. The five public tabs fit at both 390px and 360px without navigation or document overflow; staff navigation may scroll within its container. Long team names wrap. Score inputs have numeric keyboards, 48px height and clear home/away labels. Touch check-in and refresh controls are at least 44px high. Native forms, visible focus, skip navigation and inline live feedback are present.

Empty/unpublished schedule and placement states, validation errors, busy/disabled controls, correction conflict consent, team editing, court filters and public navigation were exercised. Manual browser checks used agent-browser in addition to Playwright. No real mobile/tablet hardware, screen reader study or network outage field test was performed; automated axe results are not a full accessibility certification.

Key fixes discovered during verification:

- Removed full TeamEntry object spreading from standings, which leaked roster data through the public JSON projection.
- Retained the loaded correction revision ID across refresh to prevent stale form values from overwriting newer scores.
- Disabled file selection until client hydration so a file-change event cannot be lost before handlers attach.
- Added explicit names to CSV mapping selects.
- Increased touch-control sizes and darkened muted labels/placement numbers flagged by contrast checks.
- Corrected tests to fulfill the form's synthetic-data confirmation and scope errors separately from Next's route announcer.

## Original Experiment #002 validation record

Final command outcomes and restart evidence are recorded below after the complete production validation run. The PR and GitHub Actions attach the corresponding source revision and hosted check result.

Recorded locally on **11 September 2026**, Node **24.20.0**, pnpm **10.15.0**, Next.js **16.3.4**, Prisma **7.10.0**, PostgreSQL **17**, Playwright **1.63.0** using installed Chrome on macOS:

| Check                   | Final result                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm lint`             | PASS; zero errors/warnings                                                                                               |
| `pnpm typecheck`        | PASS; route generation + strict TypeScript                                                                               |
| `pnpm test`             | PASS; **24/24** tests                                                                                                    |
| `pnpm test:integration` | PASS; **5/5** scenarios, including correction/replay, concurrent writes, import atomicity, authorization and persistence |
| `pnpm build`            | PASS; optimized production build, 11 routes                                                                              |
| `pnpm test:e2e`         | PASS; **5/5**, **29.6 seconds**, production server; no browser page errors in the full workflow                          |
| Axe assertions          | PASS; zero WCAG-tagged violations on the tested overview and five mobile views                                           |
| Clean migration         | PASS; initial migration applied to a separate newly created database                                                     |
| Repeat seed             | PASS; second seed retained 1 event / 8 teams / 32 players / 2 pools / 1 staff                                            |
| Process restart         | PASS; completed public-event JSON identical before dev shutdown and after a fresh production server started              |
| Responsive QA           | PASS at 1440×1000, 820×1180, 390×844, 360×800, including long names and visible keyboard focus                           |

The full local command log is [docs/qa/validation.txt](docs/qa/validation.txt). PostgreSQL driver 8.x emits an upstream concurrent-client-query deprecation warning during Prisma relation reads; this did not fail checks or violate the event-lock concurrency tests. The Node/Playwright color-environment warning is also non-failing. These are not silently suppressed.

Selected visual evidence:

- [Operator desktop](docs/qa/operator-desktop.png)
- [Operator tablet and long entry name](docs/qa/operator-tablet.png)
- [Public desktop](docs/qa/public-desktop.png)
- [Public mobile overview](docs/qa/public-mobile-overview.png)
- [Mobile standings](docs/qa/mobile-standings.png)
- [Mobile bracket](docs/qa/mobile-knockout.png)
- [Mobile final placements](docs/qa/mobile-final-results.png)
- [360px long-name standings](docs/qa/mobile-long-names.png)
- [Explicit correction conflict](docs/qa/correction-conflict.png)

Upstream documentation changed during the run (`a0447ba`, `a15dc0e`) to emphasize future reuse and integration handoff. These protocol updates are recorded in ASTRA_EXPERIMENT.md and incorporated without Digital access or implementation/debugging assistance. Routine sandbox approvals, dependency downloads and local database startup stayed within authorized lab work. No real data/credentials, production project, paid infrastructure or deployment was used.

The documented `pnpm db:reset --yes-lab-only` and `pnpm db:demo` commands also passed after the suite. The handoff environment contains a fresh registration seed plus a separately completed review event.

## V1 refinement acceptance additions

The original unit and correction/reconciliation suites remain intact. `tests/integration/v1.test.ts` adds four PostgreSQL scenarios:

- Eight distinct event entries, exactly four per pool; full-pool swap retains roster IDs, confirmation and check-in. Duplicate, foreign, unbalanced and stale assignments are rejected. A stale mismatch late in the update loop rolls back earlier updates too.
- Fixture generation independently rejects malformed 3/5 pool composition; pool edits are blocked after fixtures/results without changing played history.
- Staff removes/adds a substitute and edits a core player; undersized, oversized and duplicate rosters do not replace valid persisted entries.
- Public pools contain four teams each; exact entry/fixture/standing field allowlists exclude roster, staff and audit data. Unpublished and missing results are null; a published zero is numeric zero.

The first production-oriented slice is ADMIN team/player setup → pool assignment → schedule → scores → playoffs; PUBLIC pools → schedule → scores → playoffs. Public rosters, profiles, statistics and broader FIBA-style functionality are deferred.

## V1 validation record — 11 September 2026

The final `pnpm validate` run passed on the implementation in `dc0f6b0` with Node 24.20.0, pnpm 10.15.0, PostgreSQL 17, and Chrome via Playwright. Documentation/evidence commits follow without changing executable code. Original experiment evidence remains available; V1 evidence uses `docs/qa/v1-`.

| Check                        | Result                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Lint / strict typecheck      | PASS / PASS                                                                                                       |
| Unit tests                   | **24/24 PASS**, original domain suite unchanged                                                                   |
| PostgreSQL integration       | **9/9 PASS**, including all original correction/reconciliation scenarios                                          |
| Production build             | PASS, 11 routes                                                                                                   |
| Playwright                   | **7/7 PASS in 41.9 seconds**, fresh production server                                                             |
| Axe                          | Zero tested WCAG A/AA violations; operator overview, five public views, partial/completed states                  |
| Formatting / diff whitespace | PASS / PASS                                                                                                       |
| Clean PostgreSQL migration   | PASS in a separately created temporary lab database; existing migration sufficient                                |
| Repeat seed                  | PASS: exactly 1 event / 8 teams / 32 players / 2 pools / 1 staff after two runs                                   |
| Responsive browser QA        | PASS: 1440×1000 desktop, 820×1180 tablet, 390×844 and 360×800 mobile; no document overflow or public-tab overflow |

Exact full-suite output: [v1-validation.txt](docs/qa/v1-validation.txt). Existing upstream pg concurrent-query and color-environment warnings remain non-failing and visible.

Independent agent-browser review covered staff sign-in, team/roster form, pool assignment draft capacity and balancing, score/correction fields and history, plus public navigation and court filtering. Visually reviewed Overview desktop/mobile, Pools, Schedule, Scores and Playoffs at the required mobile sizes, long team names, pending and completed medal fixtures, final outcome, and staff tablet/error states. Original seed and completed demo remain available; manual drafts were canceled. Automated tests exercised actual roster saves, pool commits, scores, corrections and replay through the browser.

Defects discovered and fixed during this refinement: the court filter needed an explicit accessible name; inherited form CSS stacked pool selectors awkwardly, corrected to aligned rows. The initial Playwright failure was the court-label lookup; the full rerun passed after the accessibility fix. No backend correction/privacy regression was found.

Selected V1 visual evidence:

- [Desktop overview](docs/qa/v1-public-desktop.png)
- [390px completed overview](docs/qa/v1-public-mobile-overview.png)
- [360px pools](docs/qa/v1-360-pools.png)
- [360px schedule](docs/qa/v1-360-schedule.png)
- [360px scores with zero](docs/qa/v1-360-scores.png)
- [360px advancing playoffs](docs/qa/v1-360-playoffs.png)
- [Completed playoffs and placements](docs/qa/v1-mobile-playoffs.png)
- [Staff pool swap](docs/qa/v1-staff-pool-swap.png)
- [Staff roster editing](docs/qa/v1-staff-roster-edit.png)
- [Dangerous correction conflict](docs/qa/v1-correction-conflict.png)

The FIBA product-reference URL returned a request error in the browser; no claim is made about inspecting its content or reproducing its design. The supplied product-purpose requirements guided the refinement. No production data, Digital access, paid infrastructure, deployment or additional human implementation intervention was used. Readiness is for founder review of the isolated V1, not production operation.
