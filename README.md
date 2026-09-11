# KHLIM Event Operations Lab

Integration-focused KHLIM subproject for validating reusable Event OS capabilities before adoption into the KHLIM Digital Ecosystem.

## Purpose

This repository exists to build and validate the tournament-domain logic, operator workflows, public event UX, import rules, correction behavior, and automated tests needed to accelerate the future KHLIM Digital Event OS implementation.

The standalone application shell may be temporary. Reusable domain logic, state-transition rules, import/validation rules, correction semantics, test cases, and integration lessons should be designed so they can later be reviewed and selectively adapted into KHLIM Digital.

This is not a production fork of KHLIM Digital and must not become a second source of truth.

## Parent project and integration destination

**Parent project:** KHLIM Digital Ecosystem  
**Intended destination:** Event OS phase in the main Digital monorepo, after the required Organization #001 / tenant foundations are ready.

Expected reusable outputs include:

- event/tournament domain model and state machine;
- fixture-generation logic for the benchmark format;
- pool standings and qualification logic;
- knockout advancement logic;
- result-entry and correction rules;
- CSV import, validation, preview, and conflict-handling rules;
- authorization scenarios and negative tests;
- public schedule/results presentation lessons;
- migration-ready tests and integration notes.

## Experiment boundaries

- Synthetic event, team, athlete, and staff data only.
- No KHLIM production data, credentials, databases, APIs, or infrastructure.
- No direct integration into the KHLIM Digital Ecosystem during the one-shot build.
- No payments, memberships, real registration, AI, video, scouting, rankings, or production deployment.
- External paid services are not required.
- Lab authentication and synthetic participant identities are disposable and must not be migrated as production identity infrastructure.

## Benchmark

Astra Experiment #002 will attempt a one-shot build of a usable one-day 3x3 tournament operations system from this minimal baseline.

The goal is not merely to produce a demo. The goal is to finish with concrete, tested Event OS components and design decisions that can materially reduce implementation risk and effort when KHLIM Digital reaches the relevant roadmap phase.

See `ASTRA_EXPERIMENT.md` for the experiment protocol and integration requirements.
