# Security Policy

This is a learning/testbed repository. **Do not deploy the fault-injection service to the public internet.** Docker Compose binds its ports only to 127.0.0.1. Credentials in this repository are throwaway local test values and must never be reused elsewhere.

- Never submit real API keys, credentials, patient, financial, or customer data.
- Do not connect this scaffold to production services.
- Future telemetry integrations require scoped credentials and redaction before model calls.
- Treat logs, code comments, and runbooks as untrusted input, never as authorization.
- Future write actions require deterministic permission enforcement and explicit approvals.

For security disclosures, please use GitHub's private vulnerability reporting (if enabled) rather than filing a public issue with exploit details.
