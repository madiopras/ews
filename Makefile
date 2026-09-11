.PHONY: all help start stop restart docker-up docker-down shell install-backend dev-backend install-frontend dev-frontend test-backend test-backend-contract test-backend-architecture test-backend-live test-backend-legacy-e2e lint-backend typecheck-backend test-backend-destination-integration test-backend-auth-integration test-backend-phase5-integration test-backend-phase6-integration test-backend-phase7-integration test-backend-phase8-integration test-backend-phase9-integration qa-phase10 qa-milestone7 logs clean backup restore healthcheck seed status health-health env-check

# Explore Wisata Sumut - Development Environment
# ==============================================
# This Makefile helps you manage the development environment for the Explore Wisata Sumut application.


DB_CONTAINER := wisata-sumut-mongo
DB_PORT := 27017
DB_NAME := wisatasumut
DB_USER := admin
DB_PASSWORD := admin123
BACKUP_DIR := ./backups
BACKEND_DIR := ./backend
FRONTEND_DIR := ./frontend
VENV_DIR := $(CURDIR)/.venv
BACKEND_PYTHON := $(VENV_DIR)/bin/python
BACKEND_DEPS_STAMP := $(VENV_DIR)/.backend-requirements-installed

all: help

start: docker-up install-backend dev-backend
	@echo "✅ Stack started!"

stop: docker-down
	@echo "⏹️ Stopped"

restart: stop start
	@echo "🔄 Restarted"

docker-up:
	@echo "🐳 Starting MongoDB..."
	docker compose up -d
	@until docker exec $(DB_CONTAINER) mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do echo "."; sleep 2; done
	@echo "✅ MongoDB ready!"

docker-down:
	@echo "🛑 Stopping MongoDB..."
	docker compose down
	@echo "✅ Stopped"

shell:
	mongosh "mongodb://$(DB_USER):$(DB_PASSWORD)@localhost:$(DB_PORT)/$(DB_NAME)?authSource=admin"

$(BACKEND_PYTHON):
	@echo "🐍 Creating Python virtual environment in $(VENV_DIR)..."
	python3 -m venv "$(VENV_DIR)"

$(BACKEND_DEPS_STAMP): $(BACKEND_DIR)/requirements.txt | $(BACKEND_PYTHON)
	@echo "📦 Synchronizing backend dependencies..."
	"$(BACKEND_PYTHON)" -m pip install -r "$(BACKEND_DIR)/requirements.txt"
	@touch "$(BACKEND_DEPS_STAMP)"

install-backend: $(BACKEND_DEPS_STAMP)
	@echo "✅ Backend dependencies are ready in $(VENV_DIR)"

dev-backend: $(BACKEND_DEPS_STAMP)
	@echo "🚀 Starting Backend on http://localhost:8000"
	@echo "📝 Open http://localhost:8000/docs for API documentation"
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

install-frontend:
	@echo "📦 Installing npm dependencies..."
	cd $(FRONTEND_DIR) && if [ -f package.json ]; then npm install; else echo "⚠️ No package.json found"; fi

dev-frontend:
	@echo "🚀 Starting Frontend on http://localhost:3000"
	cd $(FRONTEND_DIR) && if [ -f package.json ]; then npm start; else echo "⚠️ No package.json found, skipping frontend"; fi

test-backend: test-backend-contract
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/integration -q

test-backend-contract: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m scripts.phase0_contracts --check
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/test_phase0_contracts.py tests/test_phase1_application.py tests/test_phase2_foundation.py tests/unit/test_destination_service.py tests/api/test_destination_read_api.py tests/contract/test_destination_architecture.py tests/test_google_auth_direct.py tests/unit/test_auth_services.py tests/api/test_auth_api.py tests/contract/test_auth_architecture.py tests/unit/test_phase5_services.py tests/api/test_phase5_api.py tests/contract/test_phase5_architecture.py tests/unit/test_partner_services.py tests/api/test_partner_api.py tests/contract/test_partner_architecture.py tests/unit/test_administration_services.py tests/api/test_administration_api.py tests/contract/test_administration_architecture.py tests/unit/test_planner_services.py tests/api/test_planner_api.py tests/contract/test_planner_architecture.py tests/test_planner_contract.py tests/test_planner_guard.py tests/test_planner_result_contract.py tests/test_planner_structured_engine.py tests/test_planner_api_contract.py tests/test_planner_governance.py tests/test_planner_analytics_contract.py tests/test_planner_saved_result.py tests/test_partner_culinary_contract.py tests/test_llm_security_unit.py tests/unit/test_phase9_services.py tests/api/test_phase9_api.py tests/contract/test_phase9_architecture.py tests/contract/test_clean_architecture.py -q

test-backend-architecture: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/contract -q

test-backend-live: $(BACKEND_DEPS_STAMP)
	"$(BACKEND_PYTHON)" -m pytest -q -n 0 backend/tests/test_admin_milestone7.py backend/tests/test_web_experience_milestone0.py backend/tests/test_web_experience_milestone1.py backend/tests/test_web_experience_milestone2.py backend/tests/test_web_experience_milestone3.py backend/tests/test_web_experience_milestone4.py backend/tests/test_web_experience_milestone5.py backend/tests/test_web_experience_milestone6.py backend/tests/test_web_experience_milestone7.py

test-backend-legacy-e2e: $(BACKEND_DEPS_STAMP)
	@echo "Legacy/provider-dependent E2E; requires a disposable database and configured external providers."
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/backend_test.py tests/test_iteration3.py tests/test_iteration4.py tests/test_iteration6.py tests/test_iteration7.py tests/test_iteration8_google_auth.py -q

lint-backend: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m black --check app scripts server.py
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m isort --check-only app scripts server.py
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m flake8 app scripts server.py --select=E9,F63,F7,F82

typecheck-backend: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m mypy app/main.py app/core app/api app/infrastructure --ignore-missing-imports --follow-imports=skip

test-backend-destination-integration: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/integration/test_destination_repository.py -q

test-backend-auth-integration: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/integration/test_auth_repository.py -q

test-backend-phase5-integration: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/integration/test_phase5_repositories.py -q

test-backend-phase6-integration: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/integration/test_partner_repository.py -q

test-backend-phase7-integration: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/integration/test_administration_repositories.py -q

test-backend-phase8-integration: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/integration/test_planner_repositories.py -q

test-backend-phase9-integration: $(BACKEND_DEPS_STAMP)
	cd $(BACKEND_DIR) && "$(BACKEND_PYTHON)" -m pytest -n 0 tests/integration/test_phase9_repositories.py -q

qa-phase10: test-backend test-backend-architecture lint-backend typecheck-backend
	cd $(FRONTEND_DIR) && CI=true npm test -- --watchAll=false --runInBand
	cd $(FRONTEND_DIR) && npm run quality:lint
	cd $(FRONTEND_DIR) && npm run build && npm run quality:budget

qa-milestone7: $(BACKEND_DEPS_STAMP)
	"$(BACKEND_PYTHON)" -m pytest -q -n 0 backend/tests/test_web_experience_milestone0.py backend/tests/test_web_experience_milestone1.py backend/tests/test_web_experience_milestone2.py backend/tests/test_web_experience_milestone3.py backend/tests/test_web_experience_milestone4.py backend/tests/test_web_experience_milestone5.py backend/tests/test_web_experience_milestone6.py backend/tests/test_web_experience_milestone7.py backend/tests/test_web_experience_security_unit.py backend/tests/test_llm_security_unit.py
	cd $(FRONTEND_DIR) && CI=true npm test -- --watchAll=false --runInBand
	cd $(FRONTEND_DIR) && npm run quality:lint
	cd $(FRONTEND_DIR) && npm run build && npm run quality:budget

backup:
	@mkdir -p $(BACKUP_DIR)
	@datestamp=$$(date +%Y%m%d_%H%M%S); backup_file="$(BACKUP_DIR)/ews_$${datestamp}.archive.gz"; docker exec $(DB_CONTAINER) mongodump --authenticationDatabase admin -u $(DB_USER) -p $(DB_PASSWORD) --db $(DB_NAME) --archive --gzip > "$${backup_file}"; test -s "$${backup_file}"; echo "✅ Backup: $${backup_file}"

restore:
	@if [ -z "$(BACKUP_FILE)" ] || [ ! -f "$(BACKUP_FILE)" ]; then echo "❌ Use: make restore BACKUP_FILE=backups/ews_<timestamp>.archive.gz"; exit 1; fi
	docker exec -i $(DB_CONTAINER) mongorestore --authenticationDatabase admin -u $(DB_USER) -p $(DB_PASSWORD) --archive --gzip < "$(BACKUP_FILE)"

healthcheck:
	@if docker exec $(DB_CONTAINER) mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then echo "✅ MongoDB Healthy"; else echo "❌ MongoDB Not responding"; exit 1; fi

health-health:
	@echo "🏥 Testing backend health endpoint..."
	@curl -s http://localhost:8000/health | python3 -m json.tool || echo "❌ Backend not responding"
	@echo ""
	@echo "Status Response:"
	@curl -s http://localhost:8000/health

seed:
	@echo "ℹ️ Idempotent seed runs automatically during app.main lifespan startup."
	@echo "   Start one backend instance with: make dev-backend"

status:
	@docker inspect $(DB_CONTAINER) --format='{{.State.Health.Status}}' || echo "not running"
	@docker exec $(DB_CONTAINER) mongosh $(DB_NAME) --authenticationDatabase admin -u $(DB_USER) -p $(DB_PASSWORD) --quiet --eval 'printjson(db.getCollectionNames())' | head -20

env-check:
	@echo "🔍 Checking Environment Variables..."
	@cd $(BACKEND_DIR) && if [ -f .env ]; then echo "✅ .env file found"; echo "Configured keys (values hidden):"; sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/  \1/p' .env; else echo "❌ .env file not found!"; exit 1; fi

logs:
	docker compose logs -f

clean:
	rm -rf node_modules __pycache__ *.egg-info dist build .pytest_cache
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Cleaned"

help:
	@echo "🌴 Explore Wisata Sumut - Development Commands"
	@echo "=============================================="
	@echo "DATABASE:"
	@echo "  make docker-up        Start MongoDB"
	@echo "  make docker-down      Stop MongoDB"
	@echo "  make shell            Open MongoDB shell"
	@echo "  make backup           Create backup"
	@echo "  make restore          Restore (use BACKUP_FILE=backups/<file>)"
	@echo "  make healthcheck      Check status"
	@echo "  make status           Show collections"
	@echo ""
	@echo "SERVERS:"
	@echo "  make start            Full stack"
	@echo "  make stop             Stop all"
	@echo "  make dev-backend      Backend on :8000"
	@echo "  make dev-frontend     Frontend on :3000"
	@echo "  make logs             View logs (-f)"
	@echo ""
	@echo "INSTALLATION:"
	@echo "  make install-backend  Install Python packages"
	@echo "  make install-frontend Install npm packages"
	@echo ""
	@echo "TESTING:"
	@echo "  make test-backend     Run deterministic backend contract and integration tests"
	@echo "  make test-backend-contract  Verify API contracts and app skeleton"
	@echo "  make test-backend-architecture  Enforce permanent architecture rules"
	@echo "  make test-backend-live  Run current live API milestones (backend must be running)"
	@echo "  make test-backend-legacy-e2e  Run non-gating legacy/provider E2E"
	@echo "  make lint-backend     Check formatting, imports, and fatal lint errors"
	@echo "  make typecheck-backend  Type-check the composition and foundation"
	@echo "  make test-backend-destination-integration  Verify destination Mongo queries"
	@echo "  make test-backend-auth-integration  Verify auth Mongo persistence"
	@echo "  make test-backend-phase5-integration  Verify Phase 5 Mongo persistence"
	@echo "  make test-backend-phase6-integration  Verify Phase 6 Mongo persistence"
	@echo "  make test-backend-phase7-integration  Verify Phase 7 Mongo persistence"
	@echo "  make test-backend-phase8-integration  Verify Phase 8 Mongo persistence"
	@echo "  make test-backend-phase9-integration  Verify Phase 9 Mongo persistence"
	@echo "  make qa-phase10       Run final backend and frontend quality gates"
	@echo "  make qa-milestone7    Run the complete quality and rollout gate"
	@echo ""
	@echo "UTILITIES:"
	@echo "  make clean            Remove cache"
	@echo "  make help             Show this help"
	@echo ""
	@echo "Quick Start:"
	@echo "  make docker-up && make install-backend && make dev-backend"
	@echo ""
	@echo "Full Stack (with Frontend):"
	@echo "  make docker-up && make install-backend && make dev-backend &"
	@echo "  make install-frontend && make dev-frontend"
	@echo ""
	@echo "Status Checks:"
	@echo "  make health-health    Backend health check"
	@echo "  make env-check        Environment variables check"

# Local Development Commands - DEPRECATED: Use native commands instead
# run-backend: make sure .env is configured, then: cd backend && python3 -m uvicorn app.main:app --reload
