# Astra Experiment #002 — KHLIM Event Operations Lab

## Objective

Evaluate whether GPT Astra can autonomously design, implement, validate, and hand off a complete first version of a one-day KHLIM 3x3 tournament operations prototype from a minimal repository.

The experiment should teach KHLIM what event-day data, states, corrections, and operator workflows need to become durable domain truth before those concepts are implemented in the KHLIM Digital Ecosystem.

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

CSV import should be treated as a first-class grassroots workflow:

```text
upload
→ map columns
→ validate
→ preview
→ duplicate/conflict review
→ human confirm
→ commit
```

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

The experiment succeeds only if Astra leaves a working, persisted, tested application that can run the complete synthetic tournament workflow, including authorized result correction and downstream recomputation, plus a mobile-first public schedule/results experience.

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
→ document findings
→ push experiment branch
→ open PR
→ do not merge
```

Expected implementation branch:

`astra/initial-event-operations-build`

The implementation can disappear. The validated event domain model and workflow lessons should survive.
