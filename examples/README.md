# TraceOps example services

These examples form a **controlled incident lab**, not a production reference architecture.

## Topology

```text
Client ─────► NestJS orders API ─────► PostgreSQL
                     │
                     └──────────────► mock-provider (HTTP verification)
```

- `GET /orders/1`: database-backed order lookup; existing CP1/CP1.5 scenarios.
- `GET /orders/1/verify`: database lookup followed by an actual internal HTTP call.
- `/health/live` checks the process; `/health/ready` checks PostgreSQL only. Provider
  failure therefore does not automatically take the API out of readiness.
- `/metrics` exposes HTTP request outcomes/latencies, DB pool state and dependency attempts/retries.

## Incident controls

| Command | Client symptom | Distinguishing evidence |
|---|---|---|
| `make fault-db-down` | `/orders/1` 503 | PostgreSQL readiness 503 |
| `make fault-slow` | `/orders/1` 200 but slow | DB query delay |
| `make fault-exception` | `/orders/1` 500 | Application exception event |
| `make fault-upstream` | `/orders/1` 504 | Aborted provider HTTP call |
| `make fault-pool` | Concurrent `/orders/1` mix of 200 and 503 | DB connection contention |
| `make fault-provider-flaky` | `/orders/1/verify` 200 but slower | First provider attempt 503; retry 200 |
| `make fault-provider-outage` | `/orders/1/verify` 502 | Two provider 503 attempts |

## Generate observations

After `make up`, compare these runs:

```bash
make reset && make traffic
make fault-provider-flaky && make traffic
make fault-provider-outage && make traffic
make reset
```

`make traffic` prints only response-status counts and p50/p95 latencies. Query
`/metrics` and `make logs` to inspect the evidence. `make integration` exercises all
seven deterministic scenarios and exports sanitized JSON under `artifacts/evidence/`.

The traffic generator is dependency-free, capped at 200 requests/10 workers, and
only accepts loopback HTTP destinations. Do not point fault scripts at real services.

**Evaluation boundary:** scenario names, environment variables, the operator commands
above, fixture filenames and `incidents/ground-truth.json` are labels for the test
harness. They must not appear in the future agent's evidence context.
