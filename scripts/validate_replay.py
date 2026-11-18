#!/usr/bin/env python3
"""Validate replay evidence and its separation from evaluator-only labels."""
from __future__ import annotations

import datetime as dt
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def stamp(text: str) -> dt.datetime:
    return dt.datetime.fromisoformat(text.replace("Z", "+00:00"))


def verify(evidence: dict, truth: dict) -> None:
    obs = evidence["observations"]
    assert evidence["schema_version"] == 1
    assert truth["run_id"] == evidence["run_id"]
    assert len(truth["injections"]) == 5
    assert truth["deployment_change_is_causal"] is False
    assert len(obs["requests"]) >= 20
    assert len(obs["metrics"]) >= 5
    assert obs["events"], "No log events were captured"
    assert obs["change_events"], "Missing non-causal change-feed event"

    # The record available to the future agent cannot disclose the injected schedule.
    serialized = json.dumps(evidence, sort_keys=True)
    for secret in ('"injections"', '"phase"', '"provider_mode"', '"scenario"',
                   '"first_attempt_503"', '"always_503"', '"latency_rise"',
                   '"provider_outage"', '"retry_masking"', '"baseline"'):
        assert secret not in serialized, "Evaluator label leaked to public evidence"
    statuses = {item["http_status"] for item in obs["requests"]}
    assert 200 in statuses and 502 in statuses, statuses
    assert {event["event"] for event in obs["events"]} >= {
        "request_completed", "dependency_request_completed", "provider_request_completed",
    }
    ids = {item["request_id"] for item in obs["requests"]}
    assert all(event["request_id"] in ids for event in obs["events"])
    assert any(
        "traceops_dependency_retries_total" in sample
        for snapshot in obs["metrics"] for sample in snapshot["samples"]
    )
    assert all(
        before["timestamp"] <= after["timestamp"]
        for before, after in zip(obs["metrics"], obs["metrics"][1:])
    )

    boundaries = [stamp(item["started_at"]) for item in truth["injections"]]
    phase_requests = [[] for _ in boundaries]
    for request in obs["requests"]:
        at = stamp(request["timestamp"])
        index = max((i for i, boundary in enumerate(boundaries) if at >= boundary), default=0)
        phase_requests[index].append(request)

    # Ground-truth comparisons are CI-only and cannot be part of the public fixture.
    assert sum(req["http_status"] == 502 for req in phase_requests[3]) >= 2
    assert sum(req["http_status"] == 200 for req in phase_requests[4]) >= 2
    assert sum(req["http_status"] == 200 for req in phase_requests[0]) >= 2
    print(
        "PASS CP1.8: timed degradation, recovery, cross-service events, "
        "metrics, clean privacy boundary"
    )


def main() -> None:
    evidence_files = sorted((ROOT / "artifacts/evidence").glob("replay-*.json"))
    assert evidence_files, "No replay evidence artifacts found"
    latest = evidence_files[-1]
    truth = ROOT / "artifacts/private-ground-truth" / latest.name
    assert truth.exists(), "Missing private evaluator metadata"
    verify(json.loads(latest.read_text()), json.loads(truth.read_text()))


if __name__ == "__main__":
    main()
