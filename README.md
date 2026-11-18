# TraceOps

**Evidence-driven incident investigation and root-cause analysis.**

> **Status:** CP0 scaffold / CP1 incident testbed. GitHub CI (including all three fault-injection scenarios) and CodeQL passed on commit c55cb20. A clean local-machine verification is still outstanding. No AI agent, cloud integrations, or automatic remediation yet.

TraceOps is an independent open-source Applied AI engineering project. The goal is to build an incident investigator that collects authorized evidence from logs, metrics, traces and code changes, tests competing root-cause hypotheses, and produces verifiable, cited diagnoses. It must abstain when evidence is insufficient.

We build it from first principles: **Build → Prove → Break → Harden → Extend**.

## Quick start (local, disposable environment only)

Prerequisites: Docker with Compose, `make`, Bash and curl. Node.js 22 is used by CI.

```bash
make up
make smoke
make integration  # exercises database outage, slow query, application exception & recovery
make down
```

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl http://localhost:3000/orders/1
```

### Inject failures

```bash
make fault-db-down     # /orders/1 -> 503, /health/ready -> 503
make reset
make fault-slow        # /orders/1 takes ~2.5s
make reset
make fault-exception   # /orders/1 -> 500, database remains ready
make reset
```

**Do not expose this testbed publicly.** Fault injection and local credentials exist exclusively for an isolated development environment.

## What is included

- NestJS + PostgreSQL service with three deterministic incident scenarios
- Ground-truth incident manifest kept separate from future agent input
- Unit tests, HTTP smoke tests, fault-injection integration tests
- CI (typecheck, lint, tests, build, Compose validation, incident integration)
- CodeQL, Dependabot, contribution guidelines, issue/PR templates
- Checkpoint roadmap and architecture documentation

## Learning checkpoints

| Gate | Capability |
|---|---|
| CP0 | Repository and repeatable test environment |
| CP1 | Reproducible incidents and ground-truth records |
| CP2 | Read-only typed evidence tools |
| CP3 | Baseline LLM diagnosis |
| CP4 | Bounded tool-calling agent |
| CP5 | Reproducible evaluation harness and held-out cases |
| CP6 | Durable execution and failure recovery |
| CP7 | Hypothesis verification, abstention and security |
| CP8 | Real telemetry from a monolith |
| CP9 | Microservice support and approved staging remediation |
| CP10 | Deployed product and external validation |

This repository starts only with CP0/CP1. Later layers are intentionally not pre-built.

## Current validation limits

The starter was prepared without Docker or npm registry connectivity, so it has **not been independently run locally**. GitHub Actions subsequently passed typecheck, lint, tests, build, Compose, and fault-injection integration checks on commit c55cb20. Commit a dependency lockfile and switch to reproducible `npm ci` as the next toolchain-hardening step (tracked in issue #6).

## Project materials

- [Architecture](docs/architecture.md)
- [CP0–CP1 checklist](docs/CP0_CP1.md)
- [Progress](docs/PROGRESS.md)
- [Engineering roadmap](docs/ROADMAP.md)
- [Full engineering blueprint](docs/ENGINEERING_BLUEPRINT.md)
- [Security guidance](SECURITY.md)

## License

MIT. See [LICENSE](LICENSE).
