# Migration lessons — Astra Experiment #002

## What this experiment establishes

The synthetic benchmark can be operated using durable event commands rather than a spreadsheet as the running source of truth. Tests exercise one complete format, explicit import commitment, correction before/after downstream play, public privacy, concurrency and restart persistence. That is evidence about this prototype and these scenarios, not production readiness or evidence that a real event will follow the same assumptions.

The implementation is disposable. No production KHLIM repository, athlete database, credential, API or infrastructure was accessed. These are recommendations for later design work, not migration instructions.

## Concepts worth retaining

**An event-specific entry is distinct from a reusable team or athlete.** Registration needs its own lifecycle, pool assignment, roster snapshot, seed/tiebreak priority and confirmation. A future canonical team can be linked to an entry; historical event rosters must not change just because club membership changes later.

**Roster membership and attendance are different facts.** Being eligible does not mean arriving on court. Team arrival and individual presence need separate controls. A substitute can be rostered but absent. This lab persists timestamps plus staff action history; a real product should replace the human-readable audit subject with a typed CheckInRecord referencing entry/person/role, event, actor and check-in station. Confirm whether core/substitute roles can change on event day.

**A fixture is a scheduled obligation with provenance.** It needs an event, stage, court, time, participants and sources of qualification. An empty knockout slot is still a useful scheduled fixture. Scheduling and competition results should not be conflated. The lab's text source labels and fixed code map should become explicit, versioned advancement edges if future formats require them.

**A result is an attributable revision, not two mutable number fields.** Keep the score, the participating entry snapshots, actor, time and lifecycle. Correction/void records explain what replaced what and why. The current result is a projection over this history. Database uniqueness and command preconditions reinforce each other.

**Publication and sign-off are independent operations.** An event may be visible before scores exist. Staff can publish provisional standings while pool play runs. Final placements require a separate explicit review. Correcting a result must withdraw a previously approved placement snapshot rather than leave a misleading public podium.

## Authoritative facts versus projections

Persist event policy/version, entries, roster membership snapshots, attendance events, fixture scheduling, result revisions, corrections/voids, publication decisions, announcements, import provenance and final sign-off. Actors and timestamps belong with each decision.

Derive played counts, wins/losses, points totals, point difference, standings, qualification, current bracket participants, dashboard completion and event phase. Qualification assignments may be materialized for operational querying, but must reconcile from the same confirmed facts inside the result transaction. Never let an editable standings total or manually retyped semifinal team become a competing source of truth.

Placements deserve a distinction: the proposed order is derived, while the reviewed/published snapshot is a staff decision. Its approval must identify the input result revisions or event version. This lab withdraws sign-off on any score revision; production should retain the old placement publication snapshot as historical evidence rather than delete it as this prototype does.

## What CSV migration taught us

- **Row validation is insufficient.** A file can have individually valid rows that disagree on the same team's pool or priority. Validate file structure, each row, grouped rosters and conflicts against persisted event entries.
- **Preview is an operational state.** Staff need to see what will be created before commitment. Store normalized preview rows; keep an explicit commit decision and revalidate under an event lock because another operator may change the event after preview.
- **All-or-nothing is easier to explain for eight teams.** One bad row blocks this batch. The error panel states that nothing was imported. If partial imports are ever introduced, rejected/accepted subsets must be separately named and reviewed; never silently skip rows.
- **Names are not identities.** Whitespace/case normalization catches obvious duplicates, but two real people may share a name and one person may use several spellings. This lab rejects cross-team duplicate names. Production must route ambiguous matches to identity resolution using permitted evidence; it must not mint or merge global athletes based on name strings.
- **Column mapping does not resolve semantics.** A source field called “seed” may mean registration order, competitive ranking or a drawn tiebreak. The import contract must define it. Here it is a declared administrative tiebreak priority, not a player/team ranking product.
- **Evidence is missing by design.** The prototype keeps filename, source row number, normalized values and staff/time. It does not retain the original bytes, checksum, mapping choices or eligibility documents. Production needs an immutable original import artifact, content hash, schema/mapping version, per-row provenance, review decisions and linked source evidence. Pending previews also need an expiry/recovery policy; this UI regenerates previews after refresh.
- **Browser timing matters.** Browser QA found that a file selection made before hydration could be lost. The control now remains disabled until its event handler is ready. Server validation alone cannot make the import workflow reliable.

## What result correction taught us

The Black/Lime example is a dependency change, not just an arithmetic update. At 18–16, Black qualifies A2; after correction to 16–18, Lime qualifies. Recalculating a table alone leaves a wrong semifinal. Replacing a semifinal participant after play rewrites the meaning of its score.

The validated lab policy is transactional: reconcile unplayed games; detect the complete affected played subtree; reject the first attempt with a list; accept explicit staff authorization to void and replay the affected games; keep old result participants/scores/actors/reasons; preserve unaffected games; withdraw placements. Tests cover reversal in pool qualification and reversal of a semifinal winner after medal games.

A conflict is not merely an error to bypass. The real organization must own the decision whether to replay, adjudicate, freeze results, disqualify an entry or republish a corrected outcome. A future correction case likely needs proposed change, evidence links, approver role, resolution, affected fixture IDs, notice/publication history and appeal state. The lab's one staff checkbox is a deliberate shortcut.

Concurrent operators add another requirement: the correction form must identify the revision that was reviewed. Reusing the latest result ID after a page refresh would incorrectly authorize stale form values. The form now holds its original ID and the server rejects a stale submission.

## Public-event learning

Public views should be explicit projections with their own privacy contract. Testing caught a spread of a full TeamEntry object into a standings row, carrying synthetic roster names into serialized public data despite hiding them visually. Explicit field selection and serialization tests fixed it. A hidden button or omitted visible text is not a privacy boundary.

Players, parents and spectators primarily need their pool, next game, scores and playoff position. V1 therefore uses Overview / Pools / Schedule / Scores / Playoffs. Plain team lists answer pool membership faster than a standings table; standings remain expandable. Completed scores deserve a dedicated view. Stacked semifinal and medal-game cards communicate progression on a phone. Announcements and final placement records remain useful without occupying their own navigation tabs. Blank and zero results must remain distinct. Publication decisions should explain empty states (“not published yet”) rather than imply there are no games.

## Shortcuts that must never migrate

- Synthetic participant IDs/names as canonical KHLIM athlete identities.
- Public lab staff credentials, shared global staff role, local throttle or this authentication design.
- Hard-coded court times, format, seed tiebreaks and five-through-eight placement policy without approved competition rules.
- Name-based identity matching or silent merging.
- Text-only action details as the sole operational audit/provenance contract.
- Mutable materialized fixture assignments without retained result participants and correction rules.
- Deleting withdrawn placement snapshots instead of retaining publication versions.
- Assuming a single local database/app equals organization ownership, permission isolation, backups or recovery.
- In-memory form state as a queue for offline event operations.
- The assumption that all three designated core players must check in before fixtures can even be generated; real scheduling often starts earlier.

## Organization ownership needed later

Define who owns an event, its division rules, rosters, eligibility decisions, court plan and result publication. Separate registrar, check-in staff, scorer, head official and authorized correction approver where appropriate. Scope staff access to an organization and event. Define delegation, removal, retention, appeal deadlines and publication accountability. This lab intentionally has none of the multi-organization infrastructure required to enforce that policy.

## Evidence and identity integration needed later

Link eligibility to authoritative evidence/provenance from the future KHLIM platform, with lawful access and retention. Result entry/correction should reference signed score sheets or official attestations rather than free text alone. Attendance evidence and import source artifacts need typed links. Never copy sensitive artifacts into a public projection.

Resolve global athlete identity through the future canonical system; keep event-local roster snapshots and mappings to that identity with provenance. Real minors, guardian relationships and production membership are entirely outside this experiment. Synthetic IDs have no mapping to real athletes and must be discarded.

## Next real-world tests

1. Shadow one real event with authorized synthetic/redacted observations: who actually enters, checks, verifies and corrects each fact, and when?
2. Test delayed games, no-shows, walkovers, protests, abandoned games, overtime and late substitutes. These are absent here; do not infer policy from this schema.
3. Measure check-in and score-entry speed with multiple tablet operators and intermittent connectivity. This lab tested browser viewports, not actual hardware or unreliable venue Wi-Fi.
4. Review the tiebreak/qualification and places 5–8 rules with tournament organizers before choosing production semantics.
5. Test an evidence-backed correction that cannot reasonably trigger replay. The organization must define an authorized alternative; this prototype deliberately offers none.
6. Evaluate import samples from actual operational sources only after explicit authorization and privacy planning. How often do teams/players have ambiguous identity, inconsistent spelling, incomplete rosters or conflicting eligibility?
7. Establish backup/restore, published-result versioning, audit retention and incident handling requirements before any production implementation.

No unresolved production questions are answered merely because this synthetic suite is green.

## V1 scope and pool-editing lesson

Prioritize **ADMIN: team/player setup → pool assignment → schedule → scores → playoffs** and **PUBLIC: pools → schedule → scores → playoffs** for the first production-oriented KHLIM Event OS slice. Staff own roster entry. Public player rosters, detailed profiles, statistics, participant login and broader FIBA-style features are deferred. This prioritization is a product hypothesis supported by synthetic workflow/browser checks, not a measured courtside usability study.

Two full pools reveal why changing a single team at a time is insufficient: moving the first team temporarily creates five entries in the destination. A reviewed, atomic whole-composition update lets staff swap teams without invalid intermediate persisted state. Original-pool comparisons reject stale edits; capacity and entry ownership are validated again under the event lock. Changing only the pool should not erase attendance or create new roster identities. The prototype safely blocks all reassignment once fixtures exist. Later policy needs organization-owned draw approval, publication/version history and deliberate rescheduling/reconciliation; do not carry over a silent reset.

The public data contract needed no expansion for this refinement. Removing public navigation items did not justify deleting announcements, standings, placement sign-off or correction history. Keep authoritative facts stable while adapting participant-facing projections. Production adaptation still waits for Organization #001 / tenancy, canonical identity resolution and evidence/provenance integration described above.
