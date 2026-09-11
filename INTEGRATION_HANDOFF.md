# Event OS integration handoff

## Status and authority

This is a review map for future KHLIM Digital work, not an integration implementation. The experiment stays in its own repository and database. No Digital code, schema, credentials or services were accessed. The future destination below comes from the upstream experiment protocol, not inspection of Digital internals. Validate every mapping against the actual parent architecture after Organization #001 / tenancy foundations are ready.

The standalone shell and all implementation choices remain replaceable. Reuse is selective and conditional on human review, competition-rule approval, architecture compatibility and production testing. Never run this lab migration against Digital or import synthetic participant records into it.

## Reuse candidates

| Candidate and location                                   | What can be adapted                                                                                  | Preconditions / required changes                                                                                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/domain.ts` — `roundRobin`                       | Six non-overlapping unique pairings for a four-team pool                                             | Approve benchmark format and actual court/rest scheduling policy. Pairings alone are not a scheduling engine.                                                                                            |
| `standings`, `qualifiers`                                | Pure aggregation, complete-pool gate, deterministic ordered qualifiers                               | Version the competition rules. Confirm wins/difference/points/seed policy with organizers; replace it if official rules differ.                                                                          |
| `outcome`, `semifinalPairs`, `medalPairs`                | Explicit participant derivation from confirmed upstream results                                      | Fit the parent's fixture/advancement model; carry source revision IDs and organization scope.                                                                                                            |
| `validateScore`, `validateRoster`                        | Structural checks and null-versus-zero semantics                                                     | Add approved overtime, forfeits, eligibility and roster-role policies. The 0–50 cap and mandatory core attendance are lab rules.                                                                         |
| `src/lib/csv.ts`                                         | Strict parsing, explicit mapping, grouped validation, full-batch errors                              | Add source artifacts/checksums, saved mappings, schema versions, real identity resolution and row-level evidence. Do not use names as identity keys.                                                     |
| `src/lib/service.ts` — result command and reconciliation | Transactional correction traversal, conflict detection, safe replay, retained history                | Adapt the algorithm, not its authorization/database plumbing. Add typed graph edges, event revision, approval scope, official evidence, appeal/adjudication and retained placement publication versions. |
| Import commands                                          | Preview/commit distinction, revalidation under lock, exactly-once batch transition                   | Integrate tenant scope, permissions, provenance and production ingest infrastructure.                                                                                                                    |
| `src/lib/query.ts` public projection                     | Explicit allowlist and separation of public/private DTOs                                             | Use parent visibility policy and API contracts. Retain serialization privacy regression tests.                                                                                                           |
| Public/operator components                               | Proven workflow sequence, compact tables, stacked mobile knockout stages, visible correction consent | Rebuild within parent design system, accessibility standards and auth/navigation. These are UX evidence, not mandatory component copies.                                                                 |

Pure functions receive event entry IDs supplied by their caller. They do not require or define a global athlete identity. Their tests use synthetic values and can be recreated without exporting the seeded IDs.

## Concept mapping to review

| Lab fact                         | Future destination concept to confirm                   | Required integration boundary                                                                       |
| -------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Event / Pool                     | Organization-owned event and competition division/pool  | Tenant ownership, lifecycle permissions, versioned rule policy                                      |
| TeamEntry                        | Event registration / event-specific team snapshot       | Link stable team identity if appropriate; retain historical event state                             |
| RosterEntry                      | Event roster membership linked to canonical Athlete     | Canonical resolution, eligibility evidence, snapshot/version semantics; discard lab participant IDs |
| Check-in timestamps + action log | Typed attendance/check-in ledger                        | Subject FK, station, actor, provenance and undo history                                             |
| Fixture                          | Organization-owned scheduled game / court allocation    | Rescheduling, disruptions, immutable participant/result snapshots, upstream source IDs              |
| GameResult / ResultCorrection    | Versioned result and correction/adjudication case       | Audit actor, approved authority, evidence, concurrent revision checks, conflict resolution          |
| EventPlacement                   | Reviewed outcome publication version                    | Preserve withdrawn versions and approvals tied to input revisions                                   |
| Announcement                     | Event communication record                              | Publication permission, audience, ownership and history                                             |
| ImportBatch / ImportRow          | Provenance-backed import job and reviewed row decisions | Original artifact, checksum, mapping schema, identity reconciliation and safe retry                 |
| Staff / Session                  | Existing production Auth and event-scoped authorization | Discard lab auth/accounts/tokens completely                                                         |
| OperatorAction                   | Existing production Audit system                        | Typed subjects, decision payloads, tenant scope, immutable policy and retention                     |

## Migration-ready tests

Adapt these executable scenarios independently of the lab ORM/UI:

- `tests/unit/domain.test.ts`: pair completeness, deterministic ties, complete-pool gate, winner/loser propagation, invalid/self results, null versus zero, roster bounds and CSV conflict matrix.
- `tests/integration/workflow.test.ts`: Black/Lime qualification reversal; transactional rollback when played descendants conflict; explicit targeted void/replay; unaffected results preserved; same-winner correction withdraws sign-off; concurrent writes, stale/repeated imports and public DTO privacy.
- `tests/e2e/tournament.spec.ts`: full staff-to-public journey, authorization negative matrix, CSRF, reviewed mapping, stale correction after refresh, publication toggles, long names and keyboard/mobile checks.

Recreate the fixtures in a parent-owned test environment. Replace staff/session setup, database helpers, route paths and publication policy assertions with parent interfaces. Keep the expected domain outcomes and adversarial cases. Never copy seed database dumps or lab auth state.

## Adoption gates and unresolved risks

1. Human competition-policy review: tiebreaks, lower placements, forfeits, overtime, no-shows, late roster changes and scheduling delays.
2. Organization ownership and event-scoped privileges integrated with existing Auth. Decide whether scorer and correction approver must differ.
3. Canonical athlete resolution and eligibility/evidence integration. No name-only merges or automatic new permanent identities.
4. Audit/provenance integration for imports, attendance, scores, correction approvals and publication versions.
5. Production transaction/versioning design, backup/restore, retention, load testing, actual-device accessibility and intermittent-connectivity testing.
6. A supervised on-court trial including corrections that cannot reasonably trigger a replay. This lab has only the replay resolution path.

See MIGRATION_LESSONS.md for findings and uncertainties. Passing the synthetic benchmark justifies reviewing these candidates; it does not justify adopting the entire application or declaring Event OS ready for production.
