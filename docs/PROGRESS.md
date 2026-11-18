# Engineering checkpoint tracker

**Last update:** 2026-11-18

The starter code is committed to GitHub. Initial CI passed on c55cb208. CP1.5 CI and CodeQL passed on feature commit a7e642f6 and the change was squash-merged through PR #8. Clean local-machine validation remains outstanding. Local clean-room validation is still outstanding; do not claim that has passed.

| CP | Checkpoint | State |
|---|---|---|
| 0 | Repository, local run and smoke validation | GitHub CI passed; clean local verification pending |
| 1 | Three reproducible incidents and ground truth | GitHub integration suite passed; local verification pending |
| 1.5 | Structured JSON logs, metrics, correlation, 2 harder faults | Implemented; CI and CodeQL passed; local clean-run pending |
| 1.75 | DB-to-provider verification, bounded retries, retry/outage incident fixtures | Implemented on feature branch; GitHub CI passed; clean local validation pending |
| 1.8 | Time-varying replay, continuous traffic, timestamped evidence and separate labels | Implemented on feature branch; replay CI verification pending |
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

- [x] Remote CI typecheck
- [x] Remote CI lint
- [x] Remote CI unit test suite
- [x] Remote CI build
- [x] Remote CI Compose validation
- [x] Remote CI five-scenario fault injection and recovery suite
- [x] Remote CI sanitized evidence export (5 artifacts)
- [x] Remote CodeQL (CP1.5)
- [x] Generate and commit package-lock.json for reproducible npm ci (CP1.5)
- [ ] Local smoke test on a clean environment

**CP1.5 result:** a7e642f6 passed remote CI and CodeQL. The five scenarios returned the expected statuses; pool pressure yielded 2 successes and 6 HTTP 503 responses; five sanitized evidence fixtures were generated. Remaining: fresh local checkout and smoke/integration verification (issue #5).

## Decision log

- **ADR-001:** Independent open-source project, not dependent on employer data.
- **ADR-002:** Start with deterministic incidents, then add intelligence.
- **ADR-003:** One agent with constrained tools before orchestration complexity.
- **ADR-004:** Ground truth is never visible to the diagnosing agent.
- **ADR-005:** Future remediation requires deterministic authorization and approval.
