# Architecture and boundaries

TraceOps is an **independent Applied AI portfolio project**, not a Kura integration. The initial system is intentionally not an AI agent: it is a controlled, reproducible environment for understanding incidents.

## CP0/CP1 architecture

```text
       curl / smoke / integration
                  |
           HTTP 127.0.0.1:3000
                  |
           NestJS orders API
          /health   /orders/:id
                  |
            PostgreSQL pool
                  |
       PostgreSQL 16 in Docker
         127.0.0.1:5433

make fault-* injects controlled faults.
incidents/ground-truth.json describes expected labels.
```

- Liveness checks process availability; readiness checks PostgreSQL availability.
- The orders service exposes one sample order and three distinct fault scenarios.
- Local database credentials are test-only. No production or customer data belongs here.
- No AI process should be allowed to read the ground-truth manifest when solving an incident.

## Target end-state architecture

```text
        Web app / API / alert webhook
                   |
           Incident orchestrator
      (durable state / bounded budget)
                   |
       Model-driven investigation loop
          tool selection + evidence
                   |
      Read-only tools (policy enforced)
       |         |          |
    Logs      Metrics     Git/deploys
       \         |          /
        Provenanced evidence store
                   |
      Hypothesis & verification engine
                   |
        Evidence-backed diagnosis
                   |
   Optional approved staging-only fix
                   |
        Independent verification

Offline dataset replay -> regression/evaluation runner -> CI gates
```

## Design principles

1. Separate source system adapters from reasoning logic.
2. Typed tool contracts, bounded time windows and result sizes.
3. Retrieval failures must be explicit; empty data is not proof of health.
4. Evidence must carry source IDs, timestamps, redaction state and provenance.
5. The agent should return *inconclusive* when root cause is not justified.
6. All model-suggested actions are subject to independent policy enforcement.
7. Build one agent first; introduce multi-agent workflows only if experiments justify them.
8. Benchmark fixtures and live telemetry are different trust domains.

## Later technologies (not installed)

FastAPI, PostgreSQL state store, LangGraph, OpenTelemetry, Langfuse, benchmark adapters, GitHub/code adapters, local Kubernetes test environment. We introduce these only when their checkpoint needs arise.
