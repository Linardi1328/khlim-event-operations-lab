# Astra Experiment #002 — KHLIM Event Operations Lab

## Objective

Evaluate whether GPT Astra can autonomously design, implement, validate, and hand off a complete first version of a one-day KHLIM 3x3 tournament operations system from a minimal repository, while producing reusable Event OS components and integration knowledge for the KHLIM Digital Ecosystem.

This is an integration-focused subproject, not a throwaway demo.

The standalone application shell may be temporary, but Astra should deliberately structure the tournament domain logic, state transitions, import rules, correction behavior, authorization scenarios, and tests so they can later be reviewed and selectively adapted into KHLIM Digital's Event OS.

## Parent project and integration target

**Parent project:** KHLIM Digital Ecosystem  
**Target destination:** Event OS phase after the required Organization #001 / tenancy foundations are ready.

Astra must not modify KHLIM Digital during this experiment. Integration happens only after human review of this subproject.

## Benchmark event

Use one synthetic tournament:

- 8 teams;
- 2 pools of 4;
- round-robin pool play;
- top 2 teams in each pool advance;
- semifinals;
- third-place game;
- final;
- 3-player core rosters with an optional substitute;
- synthetic participants only.

## Required operational journey

```text
create event
→ register/import teams
→ validate rosters
→ check in teams/players
→ publish pool fixtures
→ enter results
→ calculate standings
→ determine qualifiers
→ run knockout games
→ confirm final placements
→ publish results
```

CSV import is a first-class grassroots workflow:

```text
upload
→ map columns
→ validate
→ preview
→ duplicate/conflict review
→ human confirm
→ commit
```

## Reusable outputs expected

Astra should leave clearly identifiable, well-tested outputs that can later inform or accelerate KHLIM Digital implementation, including where appropriate:

- event/tournament domain model;
- benchmark fixture-generation logic;
- standings and tiebreak logic;
- qualifier and knockout advancement logic;
- result lifecycle and correction behavior;
- downstream reconciliation rules after corrections;
- CSV import/validation/conflict handling;
- authorization and negative test scenarios;
- public event schedule/results UX lessons;
- migration-ready test cases;
- documentation mapping lab concepts to future KHLIM Digital concepts.

Do not optimize for code copying at the expense of correctness. Production adoption must still respect KHLIM Digital's Organization, Athlete, Auth, Audit, Evidence, API, and data-ownership architecture.

## Experiment boundaries

Astra may freely choose the internal architecture and implementation details necessary to satisfy the product and validation requirements, while staying within the one-shot prompt and these boundaries.

Astra must not:

- access or modify KHLIM Digital Ecosystem code or infrastructure;
- use real athlete, family, staff, or event data;
- use production credentials or services;
- deploy to production;
- add payments or entry fees;
- add Academy membership/enrolment flows;
- build a generalized every-format tournament engine;
- add player rankings, scouting, individual performance analytics, AI, video, chat, merchandise, or autonomous operations;
- require external paid services for normal local use.

Lab authentication and synthetic participant identities are implementation scaffolding only and must not be treated as production-ready reusable identity infrastructure.

## Intervention policy

The benchmark is intended to measure autonomous completion. Human intervention should be minimal.

For routine reversible architecture choices, Astra should choose the approach it judges most appropriate and continue autonomously.

For implementation defects, Astra should diagnose the problem, fix it, rerun the affected validation, and continue.

Human intervention is appropriate only for:

- real data or credentials;
- production access or deployment;
- paid infrastructure or services;
- destructive Git operations;
- major scope expansion;
- changes to KHLIM Digital Ecosystem or other production projects.

Any substantive human intervention should be recorded below.

## Intervention log

_No substantive intervention recorded yet._

## Success standard

The experiment succeeds only if Astra leaves a working, persisted, tested application that can run the complete synthetic tournament workflow, including authorized result correction and safe downstream reconciliation, plus a mobile-first public schedule/results experience.

It must also leave an explicit integration handoff describing:

- which domain concepts should be adopted into KHLIM Digital;
- which logic/tests are suitable for direct adaptation;
- which lab-only implementation shortcuts must be discarded;
- what must be reworked to fit organization tenancy, canonical athlete identity, audit, evidence/provenance, and production auth;
- unresolved risks or assumptions that should be tested before production use.

Astra should complete its own engineering loop:

```text
understand requirements
→ design domain
→ implement
→ migrate/seed
→ test
→ start app
→ browser QA
→ fix defects
→ responsive QA
→ lint/typecheck/build
→ document integration lessons
→ push experiment branch
→ open PR
→ do not merge
```

Expected implementation branch:

`astra/initial-event-operations-build`

The application shell may disappear. Validated Event OS logic, tests, domain decisions, and integration lessons should survive into the parent project's future implementation.
