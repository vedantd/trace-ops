#!/usr/bin/env python3
"""Capture sanitized, locally generated telemetry; never include benchmark labels."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import subprocess
import urllib.request

ALLOW_EVENTS = {
    "request_completed",
    "database_query_failed",
    "postgres_pool_error",
    "upstream_request_failed",
    "application_exception",
    "dependency_request_completed",
    "upstream_retry_scheduled",
    "provider_request_completed",
}
ALLOW_FIELDS = {
    "timestamp", "service", "level", "event", "request_id", "method",
    "route", "http_status", "duration_ms", "error_code", "dependency",
    "operation", "attempt", "backoff_ms",
}
SCENARIOS = {
    "cp1-db-unavailable",
    "cp1-slow-query",
    "cp1-app-exception",
    "cp15-upstream-timeout",
    "cp15-db-pool-exhaustion",
    "cp175-provider-flaky",
    "cp175-provider-outage",
}


def parse_safe_events(raw: str) -> list[dict]:
    observations = []
    for line in raw.splitlines():
        start = line.find("{")
        if start < 0:
            continue
        try:
            record = json.loads(line[start:])
        except (ValueError, TypeError):
            continue
        if not isinstance(record, dict) or record.get("event") not in ALLOW_EVENTS:
            continue
        if record.get("service") not in {"orders-api", "mock-provider"}:
            continue
        observation = {
            key: value for key, value in record.items()
            if key in ALLOW_FIELDS and (
                isinstance(value, (str, int, float, bool)) or value is None
            )
        }
        observations.append(observation)
    return observations



def select_current_events(all_events: list[dict]) -> list[dict]:
    """Exclude stale provider events, even when request IDs were reused."""
    api_events = [event for event in all_events if event.get("service") == "orders-api"]
    api_timestamps = [event["timestamp"] for event in api_events
                      if isinstance(event.get("timestamp"), str)]
    if not api_timestamps:
        return api_events
    window_start = min(api_timestamps)
    current_ids = {event.get("request_id") for event in api_events if event.get("request_id")}
    provider_events = [
        event for event in all_events
        if event.get("service") == "mock-provider"
        and event.get("request_id") in current_ids
        and isinstance(event.get("timestamp"), str)
        and event["timestamp"] >= window_start
    ]
    return sorted(api_events + provider_events, key=lambda event: event.get("timestamp", ""))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("scenario", choices=sorted(SCENARIOS))
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    logs = subprocess.run(
        ["docker", "compose", "logs", "--no-color", "--tail=500", "api", "mock-provider"],
        capture_output=True, check=True, text=True,
    ).stdout
    events = select_current_events(parse_safe_events(logs))
    if not events:
        raise SystemExit("No structured events captured; refusing empty fixture")
    # Only controlled counters and histograms; metrics endpoint has no credentials.
    with urllib.request.urlopen(args.base_url + "/metrics", timeout=5) as result:
        metric_lines = result.read().decode("utf-8").splitlines()
    metrics = [line for line in metric_lines if line.startswith("traceops_")]
    if not metrics:
        raise SystemExit("No metric samples captured")
    data = {
        "schema_version": 1,
        # The scenario filename is for offline scoring; never put fault labels in the evidence payload.
        "source": "local-compose",
        "captured_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "events": events,
        "metrics": metrics,
    }
    target = pathlib.Path("artifacts/evidence") / (args.scenario + ".json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Captured {len(events)} sanitized events, {len(metrics)} samples -> {target}")


if __name__ == "__main__":
    main()
