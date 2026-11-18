# Contributing to TraceOps

TraceOps grows through testable checkpoints. Proposals should describe the failure mode they solve, alternatives considered, tests added, and any evaluation impact.

1. Work on a branch and open a pull request.
2. Run `make check` and, for infrastructure changes, `make up && make integration`.
3. Document deterministic reproduction steps.
4. Do not upload secrets or production/customer data.
5. Keep future agent tools read-only unless a permission policy and explicit approval exist.
