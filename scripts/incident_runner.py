#!/usr/bin/env python3
"""CP1.8: bounded, local-only timeline replay with agent/evaluator data isolation."""
from __future__ import annotations

import argparse
import collections
import concurrent.futures
import datetime as dt
import json
import os
import pathlib
import statistics
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from urllib.parse import urlsplit

from export_evidence import parse_safe_events, parsed_timestamp
from traffic import percentile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTROL = ROOT / "examples/mock-provider/runtime/fault.json"
EVIDENCE_DIR = ROOT / "artifacts/evidence"
TRUTH_DIR = ROOT / "artifacts/private-ground-truth"
# Modes are evaluator-only. They are never embedded in the agent-facing evidence.
PHASES = (
    ("baseline", "healthy"),
    ("latency_rise", "slow"),
    ("retry_masking", "first_attempt_503"),
    ("provider_outage", "always_503"),
    ("recovery", "healthy"),
)
ALLOWED_METRIC_PREFIX = "traceops_"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def validate_local_url(value: str) -> str:
    parsed = urlsplit(value)
    if (parsed.scheme != "http" or parsed.hostname not in
            {"127.0.0.1", "localhost", "::1"} or parsed.username is not None
            or parsed.password is not None or parsed.path not in {"", "/"}
            or parsed.query or parsed.fragment):
        raise ValueError("Only a loopback HTTP origin without credentials/path/query is allowed")
    try:
        if parsed.port is None:
            raise ValueError("A loopback port is required")
    except ValueError as exc:
        raise ValueError("A valid loopback port is required") from exc
    return value.rstrip("/")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect())


def fetch_response(request: urllib.request.Request, timeout: float) -> tuple[int, str | None]:
    try:
        with OPENER.open(request, timeout=timeout) as response:
            return response.status, response.read(150_000).decode("utf-8")
    except urllib.error.HTTPError as exc:
        exc.close()
        return exc.code, None
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0, None


def set_provider_mode(mode: str, control: pathlib.Path = CONTROL) -> None:
    if mode not in {item[1] for item in PHASES}:
        raise ValueError("Invalid provider replay mode")
    # Atomic replace lets the provider read a whole JSON document on every request.
    control.parent.mkdir(parents=True, exist_ok=True)
    temp = control.with_name("fault-" + uuid.uuid4().hex + ".tmp")
    try:
        temp.write_text(json.dumps({"mode": mode}) + "\n", encoding="utf-8")
        os.replace(temp, control)
    finally:
        temp.unlink(missing_ok=True)


def send_request(origin: str, request_id: str) -> dict:
    started_at = utc_now()
    started = time.perf_counter()
    request = urllib.request.Request(
        origin + "/orders/1/verify", headers={"X-Request-ID": request_id}
    )
    status, _ = fetch_response(request, timeout=3.0)
    return {
        "timestamp": started_at,
        "request_id": request_id,
        "route": "/orders/:id/verify",
        "http_status": status,
        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
    }


def sample_metrics(origin: str) -> dict:
    timestamp = utc_now()
    request = urllib.request.Request(origin + "/metrics")
    status, body = fetch_response(request, timeout=2.0)
    if status != 200 or body is None:
        return {
            "timestamp": timestamp, "source": "orders-api",
            "available": False, "samples": [],
        }
    lines = [
        line for line in body.splitlines()
        if line.startswith(ALLOWED_METRIC_PREFIX) and len(line) <= 300
    ]
    return {
        "timestamp": timestamp, "source": "orders-api",
        "available": True, "samples": lines[:300],
    }


def correlated_events(prefix: str) -> list[dict]:
    output = subprocess.run(
        ["docker", "compose", "logs", "--no-color", "--tail=5000", "api", "mock-provider"],
        cwd=ROOT, check=True, capture_output=True, text=True,
    ).stdout
    events = [
        event for event in parse_safe_events(output)
        if isinstance(event.get("request_id"), str)
        and event["request_id"].startswith(prefix)
    ]
    return sorted(
        events,
        key=lambda event: parsed_timestamp(event)
        or dt.datetime.max.replace(tzinfo=dt.timezone.utc),
    )


def check_transitions(observations: dict[int, list[dict]]) -> None:
    """Lightweight replay correctness checks; never call this with agent evidence."""
    for index in range(len(PHASES)):
        if len(observations[index]) < 2:
            raise AssertionError("Too few requests in one replay phase")
    statuses = {
        index: collections.Counter(item["http_status"] for item in values)
        for index, values in observations.items()
    }
    for index in (0, 1, 2, 4):
        if statuses[index][200] < 2:
            raise AssertionError("Expected successful traffic in healthy/degraded phase")
    if statuses[3][502] < 2:
        raise AssertionError("Expected provider outage to cause HTTP 502")
    baseline = statistics.median(item["duration_ms"] for item in observations[0])
    slow = statistics.median(item["duration_ms"] for item in observations[1])
    if slow < baseline + 60:
        raise AssertionError("Latency-rise window did not measurably exceed baseline")


def replay(origin: str, phase_seconds: int, rps: int, assert_transitions: bool) -> tuple[pathlib.Path, pathlib.Path]:
    request_prefix = "replay-" + uuid.uuid4().hex[:12] + "-"
    run_id = request_prefix[:-1]
    observations: dict[int, list[dict]] = {index: [] for index in range(len(PHASES))}
    metrics: list[dict] = []
    changes: list[dict] = []
    injected: list[dict] = []
    futures: list[tuple[int, concurrent.futures.Future]] = []
    origin = validate_local_url(origin)

    # Fail early before changing the local provider's behavior.
    health, _ = fetch_response(urllib.request.Request(origin + "/health/ready"), timeout=3)
    if health != 200:
        raise RuntimeError("Start the healthy local testbed first: make up && make reset")

    began = time.monotonic()
    current_phase = -1
    next_traffic = began
    next_metric = began
    issued = 0
    until = phase_seconds * len(PHASES)
    print("Replaying a timed incident against local services (no API restarts).")
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as workers:
            while True:
                now = time.monotonic()
                elapsed = now - began
                if elapsed >= until:
                    break
                phase_index = min(int(elapsed / phase_seconds), len(PHASES) - 1)
                if phase_index != current_phase:
                    label, mode = PHASES[phase_index]
                    set_provider_mode(mode)
                    changed = utc_now()
                    injected.append({
                        "phase": label, "provider_mode": mode,
                        "started_at": changed, "index": phase_index,
                    })
                    current_phase = phase_index
                    print("Entered replay window", phase_index + 1, "of", len(PHASES))
                    # Decoy: a deployment event coincides with degradation, but is not the cause.
                    if phase_index == 1:
                        changes.append({
                            "timestamp": changed,
                            "source": "simulated_change_feed",
                            "event": "deployment_completed",
                            "service": "orders-api",
                            "release_id": "demo-release-002",
                        })

                if now >= next_traffic:
                    request_id = request_prefix + str(issued)
                    futures.append((phase_index, workers.submit(send_request, origin, request_id)))
                    issued += 1
                    next_traffic += 1 / rps
                    # Don't accumulate unbounded catch-up traffic on a stalled machine.
                    if next_traffic < now - 1 / rps:
                        next_traffic = now + 1 / rps

                if now >= next_metric:
                    metrics.append(sample_metrics(origin))
                    next_metric += 1.0
                    if next_metric < now:
                        next_metric = now + 1.0

                time.sleep(0.01)

            # Restore healthy mode before awaiting in-flight work, so recovery is observable.
            set_provider_mode("healthy")
            for index, future in futures:
                observations[index].append(future.result(timeout=7))
        metrics.append(sample_metrics(origin))
        if assert_transitions:
            check_transitions(observations)

        requests = sorted(
            (item for batch in observations.values() for item in batch),
            key=lambda item: item["timestamp"],
        )
        events = correlated_events(request_prefix)
        if not events or not metrics or not requests:
            raise RuntimeError("Refusing to emit a replay without requests, logs and metrics")

        # Agent evidence intentionally contains neither phase names nor fault schedules.
        public = {
            "schema_version": 1,
            "source": "local-compose-replay",
            "run_id": run_id,
            "captured_at": utc_now(),
            "observations": {
                "requests": requests,
                "metrics": metrics,
                "events": events,
                "change_events": changes,
            },
        }
        private = {
            "schema_version": 1,
            "run_id": run_id,
            "scenario": "cp18-progressive-provider-degradation",
            "phase_seconds": phase_seconds,
            "injections": injected,
            "injected_component": "mock-provider",
            "deployment_change_is_causal": False,
            "expected_detection": [
                "API latency increases before user-facing error rate",
                "Dependency retries and failed attempts rise while client sees 200",
                "Persistent provider 503s lead to HTTP 502",
                "Recovery restores 200 responses and low retry counts",
            ],
        }
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        TRUTH_DIR.mkdir(parents=True, exist_ok=True)
        evidence_path = EVIDENCE_DIR / (run_id + ".json")
        truth_path = TRUTH_DIR / (run_id + ".json")
        evidence_path.write_text(json.dumps(public, indent=2) + "\n", encoding="utf-8")
        truth_path.write_text(json.dumps(private, indent=2) + "\n", encoding="utf-8")

        all_status = collections.Counter(req["http_status"] for req in requests)
        latencies = [req["duration_ms"] for req in requests]
        print(json.dumps({
            "requests": len(requests),
            "status_counts": dict(sorted(all_status.items())),
            "overall_p50_ms": round(statistics.median(latencies), 2),
            "overall_p95_ms": round(percentile(latencies, 0.95), 2),
            "metric_snapshots": len(metrics),
            "correlated_events": len(events),
        }, sort_keys=True))
        print("Agent-visible evidence:", evidence_path)
        print("PRIVATE evaluator labels:", truth_path)
        return evidence_path, truth_path
    finally:
        # A crashed process leaves no public HTTP fault-injection control surface.
        CONTROL.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:3000")
    parser.add_argument("--phase-seconds", type=int, default=6)
    parser.add_argument("--rps", type=int, default=4)
    parser.add_argument("--assert-transitions", action="store_true")
    args = parser.parse_args()
    if not 2 <= args.phase_seconds <= 30 or not 1 <= args.rps <= 8:
        parser.error("Allowed bounds: 2–30 seconds per phase, 1–8 requests/sec")
    try:
        replay(args.base_url, args.phase_seconds, args.rps, args.assert_transitions)
    except (RuntimeError, AssertionError, subprocess.CalledProcessError) as exc:
        parser.exit(1, "Replay failed: " + str(exc) + "\n")


if __name__ == "__main__":
    main()
