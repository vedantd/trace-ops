#!/usr/bin/env python3
"""Bounded, local-only checkout traffic for reproducible incident observations."""
from __future__ import annotations

import argparse
import collections
import concurrent.futures
import json
import math
import statistics
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit


def percentile(values: list[float], fraction: float) -> float:
    """Nearest-rank percentile (milliseconds); no heavy dependencies."""
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3000")
    parser.add_argument("--requests", type=int, default=20)
    parser.add_argument("--concurrency", type=int, default=2)
    parser.add_argument("--expect-status", type=int)
    args = parser.parse_args()

    parsed = urlsplit(args.base_url)
    if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        parser.error("Traffic generation is only permitted against a local HTTP loopback address")
    if not 1 <= args.requests <= 200 or not 1 <= args.concurrency <= 10:
        parser.error("Allowed ranges: 1-200 requests and 1-10 concurrent workers")

    def send(index: int) -> tuple[int, float]:
        start = time.perf_counter()
        request = urllib.request.Request(
            args.base_url.rstrip("/") + "/orders/1/verify",
            headers={"X-Request-ID": "traffic-" + str(index)},
        )
        try:
            with urllib.request.urlopen(request, timeout=6) as response:
                status = response.status
        except urllib.error.HTTPError as error:
            status = error.code
        except (urllib.error.URLError, TimeoutError):
            status = 0
        return status, (time.perf_counter() - start) * 1000

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        results = list(executor.map(send, range(args.requests)))
    statuses = collections.Counter(str(status) for status, _ in results)
    durations = [duration for _, duration in results]
    summary = {
        "endpoint": "/orders/:id/verify",
        "requests": len(results),
        "status_counts": dict(sorted(statuses.items())),
        "latency_ms": {
            "p50": round(statistics.median(durations), 2),
            "p95": round(percentile(durations, 0.95), 2),
        },
    }
    print(json.dumps(summary, sort_keys=True))
    if args.expect_status is not None and any(status != args.expect_status for status, _ in results):
        raise SystemExit("Unexpected response status in generated traffic")


if __name__ == "__main__":
    main()
