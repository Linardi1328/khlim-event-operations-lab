# Event domain model

## Authoritative facts and derived views

| Concept | Persisted authority | Derived / projection |
|---|---|---|
| Event / CompetitionFormat | Event metadata, timezone/local planned start, UTC start, courts/pools, expected/max entries, qualification/timing policies, rule versions and publication switches | Actual registered count, format preview, event phase/dashboard |
| Pool | Event-owned pool ID/name | Pool composition from active draw assignments; no generalized division system |
| Team / Registration | Event-local TeamEntry name, confirmation/presence; no permanent club/athlete identity | Display name summaries |
| RosterEntry | Event-local synthetic name/slot, imported FIBA point value, provenance, presence | Top-three seed score before draw |
| Check-in | Current team/player timestamps plus actor/time OperatorAction history | Counts and readiness gates; no separate permanent identity |
| Draw / DrawEntry / DrawPlayer | Algorithm and seeding versions, RNG seed, ordered input snapshots, totals/tie values/seeds/pots/assignments, actor/time/reason/version/status | Reproducible draw replay; TeamEntry pool/seed/score are materialized active draw outputs |
| Fixture | Court, immutable planned `startsAt`, approved `projectedStartsAt`, current actual start/end, operational status and stage/round | Current participants are materialized from source records; upcoming-game view |
| FixtureSource / BracketGraph | Typed HOME/AWAY source: QUALIFIER slot or upstream WINNER/LOSER; migrated POOL_RANK references | Advancement and byes; never hand-copied winners |
| GameResult | Participant IDs, score, PLAYED/WALKOVER kind, staff/time and CONFIRMED/SUPERSEDED/VOIDED revision | Current score, winner/loser, display statistics |
| ResultCorrection | Previous/replacement IDs (replacement absent for void), reason, actor/time | Correction and replay history |
| Standing / Qualification | Governed by frozen event policy and confirmed results; no editable standing/qualifier store | Rank, wins, display PF/PA/PD, tiebreak average, qualifiers and wildcard ordering |
| FixtureTiming | Append-only start/end observations, reason and staff/time | Fixture's current actual timing; old observations survive replay |
| RecoveryProposal / Item | Input event revision, algorithm/reason/disruption, initiator/time, every old/new estimate, applied status/time; approving actor in OperatorAction | Projected schedule impact; public estimates change only on approval |
| EventPlacement | Current complete placement snapshot and staff sign-off; sign-off actor in OperatorAction | Proposed order; current snapshot withdrawn on any result change |
| Announcement | Text, visibility and timestamps, with actor-linked actions | Public event-desk updates |
| ImportBatch / Row / Mapping | Filename/hash/layout, mapped source columns, physical line and player/points column provenance, normalized rows, reviewer/time and commit status | Preview, conflicts and team creation proposal |

The schema uses explicit typed rows rather than opaque event JSON. Lab roster IDs are disposable event-local references. They must **never** be imported as production Athlete identities.

## Competition format

New events use `KHLIM_3X3_V2` and `FIBA_INSPIRED_V2`. Each drawn pool needs at least two teams. Actual entries must fit capacity; automatic qualifiers cannot exceed the smallest pool; `poolCount × automaticQualifiers + wildcardCount = knockoutSize ≤ actualTeams`. Third place requires at least four qualifiers. Expected entries inform creation preview; actual entries govern the official draw and fixture count.

Safety limits: 128 teams, 16 pools/courts, 32 qualifiers, 1,024 pool fixtures, 3–4 players per roster. These bound one local process, not official sport rules. Format edits after creation are deferred; create a fresh event when policy changes. IANA wall time is converted to UTC; invalid dates and ambiguous/nonexistent DST times are rejected rather than guessed.

## Seeding and draw

`TOP_THREE_IMPORTED_FIBA_POINTS_V1`: sort the roster's 3–4 nonnegative whole point values, take the highest three (including substitute if applicable), sum them. Zero means unranked. Staff/CSV input provenance is a lab assertion, not verified FIBA data. The draw snapshots all inputs so later roster edits cannot erase their historical meaning.

`TOP3_POTS_MULBERRY32_V1`:

1. Canonically order input entries by ID solely to record/replay the input sequence. IDs/names are not tiebreaks.
2. Generate 128-bit random seed text on the server. Hash it with FNV-1a to initialize a 32-bit Mulberry32 stream.
3. Fisher–Yates shuffle the input list to allocate unique random tie ordinals. Sort by top-three total descending, then ordinal ascending; assign unique event seeds 1…N (1 is highest).
4. Split seed order into pots of `poolCount`. Shuffle each pot and the pool indices, placing at most one team per pot into a pool. A partial last pot randomly chooses which pools get the extra team. Thus sizes differ by at most one; all seeds/assignments commit atomically.
5. Snapshot input order, players/points/provenance, scores, ordinals, pots, event seeds and pools with rule versions, staff, time and reason.

Only one ACTIVE draw exists per event. Redraw before fixtures needs explicit confirmation, a meaningful reason and matching latest version; the old draw becomes SUPERSEDED. Saving/importing entries invalidates an active draw, clears current seeds/assignments and requires another reasoned draw. Any fixture blocks redraw. Staff cannot supply RNG seeds or manually choose a pool/seed through the API.

The RNG is reproducible, not a cryptographic public lottery: the effective state is 32-bit, so collisions are possible. There is no external randomness witness/commitment. Repeated favorable redraws remain visible but are not prevented by an independent governance authority.

## Pool play, standings and walkovers

Circle-method round robin for `n ≥ 2`: add a bye for odd n, rotate all but one position. Skip bye pairs. Produce exactly `n(n−1)/2` unique games; a team appears at most once per round. No self or duplicate matchup.

Only CONFIRMED results count. A missing result is null, not 0–0. PLAYED scores are unequal integers 0…50; this protects structure without being a full overtime/FIBA scoring engine.

KHLIM WALKOVER is explicitly recorded **21–0** (or 0–21). It counts as a win/loss and contributes those values to displayed PF, PA and PD. It carries an actor, timestamp, kind and meaningful reason in the audit action. It is never inferred from an ordinary played 21–0 result. Corrections may replace either kind and preserve the earlier kind/score.

`FIBA_INSPIRED_V2` pool ordering:

1. Most wins within a pool.
2. Head-to-head win/loss only among tied teams. For a multi-team tie, form a mini-table of wins in mutual games. If this separates groups, reapply head-to-head to each smaller tied subgroup. A fully circular/unseparated group proceeds to average.
3. Highest average scored points across applicable pool games: `sum(min(scored,21)) / eligibleGameCount`. Exclude a walkover **winner's** fixture from both numerator and denominator; the losing team's recorded zero remains eligible. No eligible games means average 0. Compare integer cross-products, not rounded displayed decimals.
4. Higher event seed (smaller number). Duplicate remaining seeds raise an explicit ambiguity error; no alphabetical/UUID/PD fallback.

Display PD is `PF−PA` and is **never a new-policy tiebreak**. Tables show actual scores; capped averages are separate fields. Provisional ranks can change until all pools finish. Qualification requires complete pool results and non-null event seeds.

Across pools: **win ratio** (wins / games, compared as integer products), then the same capped average, then event seed. No head-to-head and no point difference. Automatic qualifiers are first ordered by their pool finish, then this inter-pool comparison; best remaining teams are selected from all others by that comparison and appended. Staff cannot select wildcards.

## Bracket and placements

Generate the next power-of-two capacity for 2…32 qualifiers. Recursive seed positions start `[1,2]` and expand each rank r into `[r, size+1−r]`. Missing qualifiers are byes carried forward as sources, not fake games/results. Higher qualification positions receive the byes. Twelve qualifiers produce four opening play-ins and four byes, then four quarterfinals, two semifinals and final (plus optional third place).

Preserve high-half positions/byes. For opening games containing two qualifiers, deterministically match lower-half opponents to high-half entrants using bipartite augmenting paths, excluding same-pool pairs where possible. Prefer the original seeded opponent, then descending lower-half position. If a complete avoidance assignment exists within those fixed positions, find it; otherwise retain a maximal non-rematch assignment and deterministically fill leftovers. This does not guarantee avoidance across later rounds or optimize every possible re-seeding of bye recipients.

Stages: PLAY_IN, ROUND32, ROUND16, QUARTERFINAL, SEMIFINAL, FINAL, optional THIRD. Higher round number means earlier dependency depth. Final/third derive from semifinal winners/losers; all other rounds derive from upstream winners. See [architecture](ARCHITECTURE.md) for atomic correction/replay traversal.

Placements: final winner/loser take 1/2; third-place winner/loser take 3/4 if enabled. Remaining entries sort by furthest elimination round, pool finish, then inter-pool comparison. Without a third-place game, semifinal losers are ordered by that policy, not an additional played game. Nonqualifiers use pool finish and inter-pool comparison. Staff must sign off the full order; these are lab classification rules, not a claim of official FIBA final standings.

## Time and operational lifecycle

`startsAt` is planned UTC; `projectedStartsAt` is the approved estimate. Neither is a fabricated actual timestamp. Actuals are entered separately and every observation persists. Status distinguishes SCHEDULED, DELAYED, IN_PROGRESS, AWAITING_RESULT, COMPLETED, WALKOVER and REPLAY_REQUIRED; READY is reserved for a future explicit ready-call workflow. Result revision status is independent of fixture operational status. A void retains result history while the fixture requires replay.

Projection uses configured slot/turnaround/rest, current approved estimates, court occupancy, known team dependencies and conservative pool/round completion barriers. Late start/end or a court delay moves later unstarted estimates, never the original plan. Proposals are immutable reviewed alternatives tied to the schedule revision. A changed result/observation or another approval makes them stale. Only staff approval applies estimates. No autonomous reordering, offline recovery or court-outage implementation exists yet.

## Legacy compatibility and official differences

Migrated events remain `LEGACY_V1`: wins → PD → scored points → original seed, and typed POOL_RANK references preserve A1/B2 and B1/A2 history. New events cannot select this rule or manually enter seed/pool fields. The old Black/Lime scenario is tested explicitly as a migration compatibility fixture.

This is an intentionally bounded, FIBA-inspired lab policy. [FIBA's published Challenger/Event Maker example](https://help.fiba3x3.com/en/support/solutions/articles/35000062326-creating-a-challenger-competition-format-16-teams-with-qd) describes snake seeding; this user-requested randomized-pot algorithm differs. Consult the [official rules/interpretations](https://fiba3x3.com/docs/fiba-3x3-basketball-rules-interpretations-yellow-version.pdf) and current organizer guidance before adoption. The supplied rule sequence governs this prototype; no certification of current Event Maker parity is claimed. No official points calculation, federation/pro-circuit eligibility, disqualification/double-forfeit policy, appeals or complete official classification system is implemented.
