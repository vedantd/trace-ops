# Mock provider (local-only)

The CP1.5 testbed introduces a real HTTP network hop using Node.js built-ins. `GET /verify?delay_ms=2000` delays its response, allowing the NestJS client to enforce a 350 ms timeout and return 504.

The service is private to the Docker Compose network. It is **not** a real third-party payment provider and must not be deployed or exposed on the internet.
