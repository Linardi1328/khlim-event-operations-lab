# Migration lessons — flexible Event OS refinement

The durable output is validated behavior and an adoption map, not a second production KHLIM system. This work stayed in the isolated lab. Production adaptation must wait for Organization #001 / tenancy, canonical Athlete identity, production Auth, Audit and Evidence. A green synthetic suite does not establish production readiness.

## Concepts likely to survive

CompetitionFormat, event entries and roster snapshots, SeedingPolicy, a witnessed PoolDraw, RoundRobinGenerator, versioned StandingsPolicy/WalkoverPolicy, QualificationPolicy, BracketGraph, ScheduleProjection/EventTwinState and ImportNormalizer are useful boundaries. Their exact types and policies still need organization-owned review.

A pool is a persisted event grouping; a team's membership is an official draw output. A roster is an event eligibility snapshot, not an Athlete identity. A result is an attributed revision, not a mutable number on a game card. A draw/recovery/placement approval is a decision with inputs, actor and time. Planned, projected and actual time represent three different kinds of truth.

## Facts versus projections

Keep authoritative event format/version, entries/rosters, point provenance, eligibility/presence decisions, draw inputs/seed/assignments, planned fixtures and graph edges, result revisions, actual observations, recovery approvals, import mappings/source hashes, publication decisions and final sign-off. Reproduce the calculation that led to each decision.

Derive standings, display statistics, capped tiebreak averages, qualification, bracket participants, next games and dashboards from those facts. Materialize fixture participants and active seed/pool assignments transactionally, with one derivation path. Never let editable totals, a manually chosen wildcard or a hand-copied winner become competing truth.

Placement sign-off is a reviewed snapshot of derived order. The lab deletes the withdrawn snapshot on a correction; production should preserve every publication/version with its input result revisions and evidence. Timing observations survive replay, but future audit should explicitly bind each observation to the participant/fixture revision it described.

## Seeding and fairness

Adding ranking points exposes the need for **input provenance and rule version**, not a manual priority field. Top-three inputs can include the substitute. Freeze what was known at the draw, even if staff later edit names or points. Do not update historical seeding when a live external ranking changes.

A reproducible RNG seed plus ordered inputs and recorded algorithm is necessary for audit. It is not sufficient proof of a fair public lottery. This lab's 32-bit effective PRNG and staff-initiated redraws need an organization-owned witness/approval policy, stronger randomness commitments if required, and evidence links. Redraw reasons/history make organizer choices visible; no drag/drop or manual pool placement remains.

Version existing events instead of silently replacing their tiebreak interpretation. Legacy data may have valid placements under its original rules. New-policy tests must coexist with migration compatibility tests rather than rewrite history to make the suite pass.

## What flexible CSV ingestion revealed

- Layout and semantics must be reviewed before row validation. Aliases, case/whitespace and arbitrary column order can be normalized deterministically. Both long and wide layouts reduce reformatting work for staff.
- Ambiguous aliases cannot be guessed. The UI stops for mapping; irrelevant columns are explicitly listed as ignored. An obsolete “pool” or “seed” column must not regain placement authority.
- A valid row is not a valid roster. Validate grouped 3–4-player rosters, slots, point values, duplicate players, conflicting teams and conflicts against persisted entries.
- Preview is durable operational state. Store normalized rows, mapping choices, physical source lines/columns, filename/hash, reviewer/time and commit status. Revalidate under the event lock, then commit the whole batch only after explicit confirmation.
- The original bytes are not retained here. A checksum is a linkage aid, not source evidence by itself. Production needs immutable source artifacts, source/mapping schema versions, retention/access policy and review decisions linked to Evidence.
- Names remain a deliberately strict synthetic conflict heuristic. Real duplicate names, transliterations and changed names require canonical identity resolution, never silent merges or automatic global Athlete creation.
- Browser testing revealed two timing boundaries: file controls must wait for hydration, and mappings must wait for header inspection. Otherwise asynchronous suggestions can overwrite an operator's choice. Server validation protects truth; it cannot replace a reliable review interaction.

## What correction and walkovers revealed

The retained Black/Lime reversal demonstrates that a pool correction can change qualification. The new deep-bracket test also reverses an opening result and a pool result after later rounds are played. Updating a standings table alone is insufficient.

The chosen lab policy is atomic: simulate downstream recomputation, identify every affected started/played descendant, reject with a conflict list, then accept explicit authorized replay. Void only affected results, retain participant/score/kind/revision history, preserve unaffected games and withdraw placement sign-off. Every form must identify the revision reviewed; a refresh must not silently authorize stale edits.

Walkover is a distinct result kind and attributed decision. Its KHLIM 21–0 display convention affects PF/PA/PD, while its winning score is excluded from tiebreak average inputs. A played 21–0 is different. Result type corrections need the same audit/reconciliation path as numeric corrections.

Production needs evidence-backed correction cases, roles and appeal windows. Replay may be impossible or unfair after a real event; the organization must choose alternatives such as adjudication/freeze/withdrawal. The lab offers none of those and must not define them implicitly.

## Event Twin learning

An actual late finish is an observation. A later projected schedule is a proposal. Publishing it is an authorized decision. Collapsing them into one mutable start timestamp erases both the original promise and the recovery history.

A small deterministic projector can propagate court occupancy, turnaround, shared-team rest and round barriers. Proposals must be tied to the event revision because another score/timing change can invalidate the calculation. Manual browser QA caught participant reconciliation resetting DELAYED status despite a later approved estimate; dependent projections must preserve unrelated operational facts.

The next disruptions should plug into this same impact/approval boundary. Court closure, late teams and extended pauses need their own typed facts and constraints. Do not copy another Event Twin repository or use AI to conceal unapproved policy. There is no venue-capacity optimizer, automatic earlier start or closing-time guarantee here.

## Public and staff product slice

**ADMIN: team/player setup → official draw → schedule → scores → playoffs.**

**PUBLIC: pools → schedule → scores → playoffs**, with a light Overview. No public rosters, individual ranking-point values, player profiles/statistics, participant accounts, scouting or broader FIBA features.

Plain team lists answer pool membership quickly. Matchup matrices and statistics become useful next to those lists as games progress. Mobile tables should scroll within a labeled region, with row headings retained; squeezing all columns into 360px makes them unreadable. Separate Scores prevents unplayed fixtures masquerading as zero results. Stacked rounds and source-game labels work for deeper brackets without a library.

The explicit public projection remains a security boundary. A previous experiment caught private roster fields leaking via an object spread into standings despite being visually hidden. Keep serialization allowlist tests as well as browser privacy assertions whenever internal records expand.

## Shortcuts that must never migrate

- Synthetic IDs, invented point values or lab account credentials as real identity/authentication.
- Shared global staff authorization, name-only identity matching, public demo secrets or local-only throttling.
- Unsigned 32-bit draw randomness as proof of a publicly fair lottery; text-only audit as Evidence.
- Deleting withdrawn placement/publication versions; complete-event cascade deletion as a retention policy.
- A fixed after-generation registration/check-in lock without real late-arrival/substitute policy.
- Treating the custom average/forfeit/bye/placement rules as certified current Event Maker behavior.
- Local UI forms as an offline queue, or viewport QA as real mobile-device/venue testing.

## Ownership, Evidence and identity requirements

Organizations must own competition rules/version, draw approval and redraw policy, roster eligibility, scheduling resources, publication and corrections. Define scoped registrar, check-in, scorer, official and adjudicator roles; this lab's shared EVENT_STAFF is not that model.

Evidence integration should link original CSV artifacts, point snapshots, draw witness/approval, score sheets, timing observations and replay decisions. Preserve source versions, review lineage, access controls and retention. Keep private evidence out of public projections.

Canonical Athlete resolution belongs to KHLIM Digital after its foundations exist. Future event-local roster snapshots should reference that authority with provenance. No real minors, guardian records, production memberships or athlete data were used here.

## Next field tests

1. Shadow a real tournament with authorized/redacted observations: who records each fact, at what time, with what evidence?
2. Review FIBA-inspired tie groups, walkover denominator treatment, wildcard comparison, byes and lower placements with qualified organizers using current rules.
3. Test witnessed redraw governance, late substitutes, withdrawals, protests and corrections that cannot trigger replay.
4. Measure delays, court outages, rest guarantees and estimate usefulness against actual court clocks; examine schedule feasibility before publication.
5. Test multiple tablets, flaky venue Wi-Fi, offline drafts and recovery after a device restarts.
6. Review diverse authorized organizer sheets for ambiguous identity/layout; measure how often aliases need human intervention.
7. Define production publication history, ownership isolation, backup/restore, audit retention and incident procedures before adaptation.
