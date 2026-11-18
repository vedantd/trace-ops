# Engineering checkpoint tracker

**Last update:** 2026-11-18

The starter code is committed to GitHub. Do not count a checkpoint as passed until its acceptance tests have actually run in a clean environment.

| CP | Checkpoint | State |
|---|---|---|
| 0 | Repository, local run and smoke validation | Scaffold committed; validation pending |
| 1 | Three reproducible incidents and ground truth | Code committed; integration results pending |
| 2 | Typed, bounded evidence tools | Not started |
| 3 | Model-only diagnostic baseline | Not started |
| 4 | Tool-calling investigator loop | Not started |
| 5 | Benchmark harness and experiment comparisons | Not started |
| 6 | Durable state, retries and resume | Not started |
| 7 | Evidence verification and prompt injection defense | Not started |
| 8 | Live monolith telemetry integration | Not started |
| 9 | Microservices and approved staging remediation | Not started |
| 10 | Product deployment and independent users | Not started |

## Initial validation evidence

- [ ] Remote CI typecheck
- [ ] Remote CI lint
- [ ] Remote CI unit test suite
- [ ] Remote CI build
- [ ] Remote CI Compose validation
- [ ] Remote CI fault injection suite
- [ ] Generate and commit package-lock.json for reproducible npm ci
- [ ] Local smoke test on a clean environment

Do not claim end-to-end validation until these checks are observed passing.

## Decision log

- **ADR-001:** Independent open-source project, not dependent on employer data.
- **ADR-002:** Start with deterministic incidents, then add intelligence.
- **ADR-003:** One agent with constrained tools before orchestration complexity.
- **ADR-004:** Ground truth is never visible to the diagnosing agent.
- **ADR-005:** Future remediation requires deterministic authorization and approval.
