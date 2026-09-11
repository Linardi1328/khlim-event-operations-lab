# Event OS integration handoff

## Status and destination

This is a map for later human-reviewed adoption into **KHLIM Digital Event OS after Organization #001 / tenancy foundations**. No Digital repository, credentials, schema or infrastructure were accessed or modified. Nothing here is copied into production automatically. The isolated application shell may disappear; validated behavior, scenarios and lessons should inform future implementation.

The new baseline supports variable pool sizes/counts, seeded draws, imported ranking-point snapshots, dynamic qualification/brackets and deterministic schedule recovery. The fixed eight-team benchmark remains a compatibility/test case, not the engine boundary.

## Candidate modules and adoption work

| Candidate | Lab location / validated responsibility | Required adaptation |
|---|---|---|
| CompetitionFormat | `src/lib/competition/format.ts`: format constraints, balanced count preview, zoned start | Organization-owned immutable policy revisions, event/division ownership, feasibility/window policy |
| SeedingPolicy | `competition/draw.ts`: top-three imported player points, random tie ordinal | Canonical roster/athlete references, authoritative ranking snapshot provenance, approved official policy |
| PoolDraw | `competition/draw.ts`, Draw/Entry/Player: pots, reproducibility, atomic version history | Witness/approval roles, stronger lottery requirements, Evidence and public draw disclosure |
| RoundRobinGenerator | `domain.ts`: arbitrary/odd pools with unique pairs | Approved competition constraints, real schedule/resource policy |
| StandingsPolicy | `domain.ts`: wins, head-to-head mini-tables, capped average, event seed | Rule-owner review, current FIBA interpretation/version, special disqualification cases |
| WalkoverPolicy | `service.ts` + GameResult.kind + statistics: explicit 21–0 vs played | Organization-approved forfeit/no-show policy and proof; do not assume KHLIM display convention is universal |
| QualificationPolicy | `competition/bracket.ts`: automatic + derived best remaining using win ratio | Approved selection/ranking policy, audited decision inputs; no manual wildcard copying |
| BracketGraph | `competition/bracket.ts`, FixtureSource, service reconciliation | Event-scoped graph revisions, Evidence-backed correction cases, adjudication beyond replay |
| ScheduleProjection / EventTwinState | `competition/schedule.ts`, Timing/Recovery records | Organization resources, disruption facts, approval roles, provenance, venue clocks/closing windows and offline handling |
| ImportNormalizer | `csv.ts`, ImportBatch/Row/Mapping | Immutable source artifacts, mapping schema/version, canonical identity resolution, retained review decisions |
| Result integrity | `service.ts`: revision ID, event transaction, targeted void/replay | Production Auth/Audit/Evidence, approval permissions, publication version retention |
| Public projection / UX | `query.ts`, public views | Organization/event visibility and privacy contract; mobile validation in real usage |

These are candidates for selective adaptation, not guarantees of direct source compatibility. Keep pure rule tests while fitting Digital's eventual domain boundaries and APIs. Do not transplant this Prisma schema wholesale.

## First production-oriented slice

**Admin:** team/player setup → official pool draw → schedule → scores → playoffs.

**Public:** pools → schedule → scores → playoffs, with a simple event overview. Public roster/profile/statistics, player login/registration, payments, scouting and broad FIBA functionality remain deferred. Internal announcements, final placement sign-off and correction history remain valuable without extra primary tabs.

## Facts, projections and integration contracts

Authoritative facts should include the owned event/policy version; confirmed entry/roster snapshots; source point provenance; official draw input/output/version and actor; planned fixture graph; result revisions and type; actual timing observations; recovery proposals/approvals; import review/commit lineage; and publication/sign-off decisions.

Standing totals, qualification, bracket participants, schedule estimates and dashboards are projections or materializations from those facts. Do not permit separately editable standings or copied playoff winners. Approvals must identify exactly which input version was reviewed. Preserve all historical approved publications in production; this lab withdraws/replaces the current placement snapshot.

Every migrated event must retain the rules it used. The lab migration keeps V1 results under LEGACY_V1 and backfills typed source edges without changing participants. Policy changes on existing real events need explicit organization authorization and reconciliation, not a software upgrade that silently changes rankings.

## Tests worth adapting

- Arbitrary/odd round robin uniqueness and rest/court constraints.
- Top-three seeding, tied input totals, reproducible pot draws, balanced unequal pools and redraw audit/staleness.
- Two-/multi-team head-to-head, capped average, walkover numerator/denominator, displayed PD and unequal inter-pool win ratios.
- Top-N/wildcard selection; 4/8/12/16/20/24/32 bracket graphs, byes, first-round rematch avoidance and deeper progression.
- Original Black 18–16 Lime → 16–18 correction, plus pool/opening-round reversals through played deep brackets: atomic conflict, targeted replay, unaffected history and withdrawn placements.
- Concurrent result writers, stale open correction forms, invalid result/roster rejection, DB-scoped participants and rollback.
- Planned/projected/actual separation, delayed start/end impact, reviewed recovery and stale proposal rejection.
- Aliases, long/wide CSV, unknown/ambiguous mappings, ignored columns, preview confirmation, stale commits and all-or-nothing imports.
- Unauthorized API/service mutations, Origin/JSON protection, unpublished data, public DTO allowlists and private ranking/roster regression tests.
- Complete browser tournament operation, 390×844/360×800 navigation, unequal matrices/deep playoffs, zero scores, walkovers, mapping races and inset dropdowns.

See [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) for the executable matrix and exact validation record. These tests use synthetic local identities and must be adapted to production fixtures rather than migrated as real participant data.

## Adoption sequence and gates

1. Establish Organization #001/tenancy ownership and scoped authorization. Decide event/division/resource ownership and allowed staff responsibilities.
2. Review competition policies with the organization and qualified officials. Approve the current rule version, draw governance, forfeits, byes, wildcard comparison and placement semantics.
3. Map canonical Athlete identity to event roster snapshots. Resolve ambiguity with authorized evidence; discard lab IDs and point values.
4. Integrate production Audit/Evidence and immutable import/score/draw/timing/publication artifacts. Bind approvals to reviewed inputs and retain prior publications.
5. Adapt pure modules behind owned domain APIs, then transactional service behavior. Replace lab authentication and all synthetic scaffolding.
6. Re-run adapted tests, tenancy/privacy/security checks and real event shadow trials. Define offline/recovery, backup/restore, retention and operational incident policy.

Unresolved: real names/identity ambiguity, independent draw fairness, unplayable late corrections, court outages and venue deadlines, late arrivals/rosters, connectivity and real-device ergonomics. No production-readiness claim is made.

## Review artifacts

PR #1 remains the implementation handoff on `astra/initial-event-operations-build`; do not merge without founder review. `pnpm db:demo:flex` creates a convenient eighteen-team, unequal-pool review event without modifying existing events. [README](README.md) documents setup, disposable staff access and workflows; [DOMAIN_MODEL](DOMAIN_MODEL.md) defines exact prototype semantics; [MIGRATION_LESSONS](MIGRATION_LESSONS.md) records findings and boundaries.
