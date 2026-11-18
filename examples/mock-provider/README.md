# Mock provider (local-only)

The example provider is an internal HTTP service used by the NestJS orders API.
There are no real customers, credentials, or external requests.

- `GET /health` returns 200 independently of the verification workflow.
- `GET /verify` returns success, including in normal verification.
- `GET /verify?mode=first_attempt_503&attempt=1` returns 503 after `180 ms; attempt 2 succeeds.
- `GET /verify?mode=always_503` consistently returns 503.
- `GET /verify?delay_ms=2000` preserves the earlier upstream-timeout scenario.

For CP1.8, a read-only directory mount at `/app/runtime` supplies an atomic local
`fault.json` file. The provider reads it for each verification request so behavior
changes **without restarting the API**. The host replay script alone writes it,
and it is deleted after a replay. There is no HTTP fault-control endpoint.
The `slow` replay mode adds approximately 180 ms, below the API timeout.

The provider emits sanitized JSON events with operation, attempt number, status,
duration and validated forwarded request ID. The API also logs its dependency
attempts and retries, so a future investigator can correlate the two services.
The Docker Compose file does **not** publish the provider port to the host.

**Never deploy or expose this deliberately faultable service publicly.**
