.PHONY: up smoke integration logs traffic fault-db-down fault-slow fault-exception fault-upstream fault-pool fault-provider-flaky fault-provider-outage reset down clean test typecheck lint format-check check

up:
	docker compose up --build -d

smoke:
	bash scripts/smoke.sh

integration:
	bash scripts/integration.sh

logs:
	docker compose logs -f api mock-provider

traffic:
	python3 scripts/traffic.py --requests 20 --concurrency 2

fault-db-down:
	docker compose stop postgres

fault-slow:
	FAULT_MODE=slow_query docker compose up -d --no-deps --force-recreate api

fault-exception:
	FAULT_MODE=application_exception docker compose up -d --no-deps --force-recreate api

fault-upstream:
	FAULT_MODE=upstream_timeout docker compose up -d --no-deps --force-recreate api

fault-pool:
	FAULT_MODE=db_pool_exhaustion docker compose up -d --no-deps --force-recreate api

fault-provider-flaky:
	FAULT_MODE=provider_flaky docker compose up -d --no-deps --force-recreate api

fault-provider-outage:
	FAULT_MODE=provider_outage docker compose up -d --no-deps --force-recreate api

reset:
	docker compose up -d --wait postgres mock-provider
	FAULT_MODE=none docker compose up -d --no-deps --force-recreate api

down:
	docker compose down

clean:
	docker compose down -v

test:
	cd examples/nestjs-monolith && npm test

typecheck:
	cd examples/nestjs-monolith && npm run typecheck

lint:
	cd examples/nestjs-monolith && npm run lint

format-check:
	cd examples/nestjs-monolith && npm run format:check

check:
	cd examples/nestjs-monolith && npm run typecheck && npm run lint && npm test && npm run build
