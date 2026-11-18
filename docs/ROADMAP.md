# TraceOps — Final State and Build Plan

## Vision

Build an open-source, production-minded AI incident investigator that supports both monolithic and microservice applications. It ingests alerts and authorized telemetry; selectively queries logs, metrics, traces, deployment history and source code; maintains evidence-backed, testable hypotheses; and produces clear diagnoses with verifiable supporting references. It must not invent certainty. Optional changes are restricted to isolated staging with explicit approval and independent verification.

This is a **full-stack AI engineering project**, not a generic chat interface or a Kura-specific bot. The final product should demonstrate tool use, context engineering, evals, robust execution, security, user-facing workflows and deployment.

## Acceptance criteria for final state

- New user can connect a disposable test application through scoped credentials.
- Investigations run asynchronously with visible intermediate tool actions and evidence.
- Agent enforces time, token and dollar budgets and returns an inconclusive state when warranted.
- Evidence IDs map back to original read-only observations.
- Incidents, tool results, hypotheses, runtime state and costs are durable and auditable.
- Offline benchmark suite reproduces model/version comparisons with held-out cases.
- Prompt injection and unauthorized write attempts are explicitly tested.
- Monolith and microservice adapters use the same core investigation engine.
- No direct production write capability. Staging remediation is opt-in and approved.
- Public demo, operator docs, security model, CI quality gates and measured outcomes.

## CP0: Repository and environment

**Build:** GitHub repository, NestJS/Postgres local testbed, readme, CI and Docker Compose.
**Break:** Fresh checkout with missing dependencies and unavailable Postgres.
**Harden:** Explicit prerequisite checks, container healthcheck, deterministic setup.
**Pass:** Reproduce the healthy demo on a clean machine, CI passes.

## CP1: Deterministic incidents

**Build:** DB outage, slow query, application exception and a ground-truth fixture.
**Break:** Repeat each fault after recovery; check similarity of outward symptoms.
**Harden:** Stable fault commands, structured outcomes, integration checks.
**Pass:** Three reproducible, distinguishable incidents and successful resets.

## CP2: Deterministic evidence collectors

**Build:** `get_logs`, `get_metrics`, `get_service_health` contracts returning typed, sourced records with timestamps.
**Break:** Empty, stale and enormous datasets, bad parameters, unavailable tools.
**Harden:** Read-only permissions, bounded output, explicit errors, truncation metadata.
**Pass:** A human can diagnose incident fixtures using only tool APIs.

## CP3: Model-only baseline

**Build:** Model call on preselected incident evidence; Pydantic output schema for components, cause, evidence IDs and abstention.
**Break:** Ambiguous or contradictory evidence; repeated model runs.
**Harden:** Validation, provider errors, token budgets and output contract checks.
**Pass:** Measurable correctness and documented failures on a versioned dataset.

## CP4: First tool-calling agent

**Build:** Bounded observe → choose tool → retrieve → update state → decide loop, one agent only.
**Break:** Repeated calls, invalid args, tool timeouts, budget exhaustion.
**Harden:** Tool schema checking, explicit stop conditions, per-run tracing.
**Pass:** Agent autonomously gathers sufficient evidence for at least some benchmark cases.

## CP5: Evaluation harness

**Build:** Baseline vs agent comparisons, held-out incident set, deterministic scoring and trace inspection.
**Break:** Dataset leakage, judge disagreement, model-version regression.
**Harden:** Isolated ground truth, scored evidence IDs, cost/time metrics, regression gates.
**Pass:** Reproducible report with failure taxonomy, not invented performance claims.

## CP6: Durable execution

**Build:** Persisted runs, checkpoints, retry policies and cancellable/resumable investigations.
**Break:** Kill process mid-run, provider 429, tool timeouts and duplicate deliveries.
**Harden:** Idempotency, backoff, job ownership and failure audit events.
**Pass:** Restart resumes without corrupting state or repeating unsafe effects.

## CP7: Verifiable hypotheses and safety

**Build:** Hypothesis graph, supporting/contradicting evidence, explicit uncertain status.
**Break:** Prompt injection hidden in logs, misleading metrics, missing data.
**Harden:** Evidence provenance and policy enforcement outside the LLM.
**Pass:** No unsupported evidence citation; unauthorized actions denied deterministically.

## CP8: Live NestJS monolith

**Build:** OpenTelemetry instrumentation and read-only adapters; trace/log/metric correlation.
**Break:** Late telemetry, stale timestamps, lost spans, transient recovery.
**Harden:** Time-window and freshness handling, redaction, cost limits.
**Pass:** Three actual staging/local faults diagnosed using live signals.

## CP9: Microservices and staging remediation

**Build:** Google Online Boutique adapter; dependency graph and distributed trace reasoning.
**Break:** Errors caused by upstream/downstream services; partial outages.
**Harden:** Staging-only, scoped, human-approved actions with independent post-change verification.
**Pass:** Same investigator reasons about monolith and microservices; safe staging fix verified.

## CP10: Product and external validation

**Build:** Next.js UI, authentication, investigations dashboard, evidence drill-down, approvals, history and eval results.
**Break:** Concurrent users, expired credentials, malformed integrations, load.
**Harden:** Tenant isolation, observability, alerts, CI, limits and operational playbooks.
**Pass:** External engineer can onboard a test application and reproduce a documented investigation.

## Engineering rules

- Do not build ahead of the checkpoint's observed failure.
- Always create a test that would have detected the failure before the fix.
- Preserve comparison artifacts and experiment metadata.
- Re-run held-out evaluations at checkpoints that change agent behavior.
- Record the reason for every framework introduced.
- Never submit employer/customer secrets or private traces to a public repo.

## Useful references

- [Cloud-OpsBench](https://github.com/LLM4Ops/Cloud-OpsBench) — offline incident evaluation
- [OpenTelemetry](https://opentelemetry.io/) — telemetry instrumentation
- [Google Online Boutique](https://github.com/GoogleCloudPlatform/microservices-demo) — distributed testbed
- [LangGraph](https://github.com/langchain-ai/langgraph) — durable agent workflows
- [Langfuse](https://github.com/langfuse/langfuse) — trace and evaluation tooling

The comprehensive original blueprint remains a separate planning artifact; this concise repository roadmap is the source of truth for checkpoint execution until the detailed document is migrated.
