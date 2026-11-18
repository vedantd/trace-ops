# TraceOps

**Evidence-driven incident investigation and root-cause analysis.**

> **Status:** CP0 starter / CP1 testbed. No AI agent, cloud integrations, or automatic remediation yet. The initial checks need to run in GitHub Actions before we mark this checkpoint validated.

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

The starter was prepared without Docker or npm registry connectivity, so the build and end-to-end tests have **not yet been observed passing**. GitHub Actions will provide the first remote check. Dependency lockfile generation and reproducible `npm ci` should be added immediately after initial dependencies install successfully.

## Project materials

- [Architecture](docs/architecture.md)
- [CP0–CP1 checklist](docs/CP0_CP1.md)
- [Progress](docs/PROGRESS.md)
- [Engineering roadmap](docs/ROADMAP.md)
- [Security guidance](SECURITY.md)

## License

MIT. See [LICENSE](LICENSE).
