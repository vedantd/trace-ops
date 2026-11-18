# CP0 / CP1 — Your first reproducible incident lab

**Objective:** Establish a version-controlled, testable environment and understand symptom, evidence and root cause *without an LLM*.

## Prerequisites

- Docker Engine or Docker Desktop with Docker Compose v2
- Bash, curl, make
- Node.js 22 and npm for local non-container development

Do not start the testbed on a publicly exposed server. Fault-injection modes are intended only for disposable, locally bound services.

## CP0 — Setup and smoke test

```bash
git clone https://github.com/vedantd/trace-ops.git
cd trace-ops
make up
make smoke
```

Expected:
- `GET /health/live` → 200 (API process alive)
- `GET /health/ready` → 200 (PostgreSQL reachable)
- `GET /orders/1` → 200 with seeded demo order

If any check fails, inspect `docker compose ps` and `docker compose logs --tail=100 api postgres`. Do not mark CP0 complete until the smoke checks pass on a fresh environment.

## CP1 — Three incidents

### A. Database unavailable

```bash
make fault-db-down
curl -i localhost:3000/health/live
curl -i localhost:3000/health/ready
curl -i localhost:3000/orders/1
docker compose logs --tail=80 api
make reset
```

Expected: process remains live, readiness and order fail with 503. Reset restores health.

### B. Slow database query

```bash
make fault-slow
curl -o /dev/null -s -w 'HTTP %{http_code} / %{time_total}s\n' localhost:3000/orders/1
curl -i localhost:3000/health/ready
make reset
```

Expected: order succeeds but waits about 2.5 seconds; readiness stays healthy.

### C. Application exception

```bash
make fault-exception
curl -i localhost:3000/orders/1
curl -i localhost:3000/health/ready
docker compose logs --tail=80 api
make reset
```

Expected: order returns 500 even though database readiness is 200.

## Prove it

```bash
make integration
make down
```

Observe for each incident:
- exact symptom and HTTP status
- root cause you injected
- evidence that distinguishes it from the other two
- recovery action and its observable effect

Complete the written incident record, not just a green CI result. Re-run from a fresh Compose volume when debugging reproducibility.

## Acceptance gate

- All three faults reproduce on demand.
- Each has distinct supporting evidence.
- Environment recovers successfully after every fault.
- Unit tests, CI static checks and integration tests pass.
- No real credentials/data, no public fault-injection endpoints, no AI agent yet.

Next: **CP2** typed, bounded, read-only evidence tools.
