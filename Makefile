.PHONY: all help start stop restart docker-up docker-down shell install-backend dev-backend install-frontend dev-frontend test-backend qa-milestone7 logs clean backup restore healthcheck seed status health-health env-check

# Explore Wisata Sumut - Development Environment
# ==============================================
# This Makefile helps you manage the development environment for the Explore Wisata Sumut application.


DB_CONTAINER := explore-wisata-sumut-mongodb
DB_PORT := 27017
BACKEND_DIR := ./backend
FRONTEND_DIR := ./frontend

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
	mongosh mongodb://admin:admin123@localhost:$(DB_PORT)/wisasumut?authSource=admin

install-backend:
	@echo "📦 Installing Python deps..."
	cd $(BACKEND_DIR) && pip3 install -r requirements.txt

dev-backend:
	@echo "🚀 Starting Backend on http://localhost:8000"
	@echo "📝 Open http://localhost:8000/docs for API documentation"
	cd $(BACKEND_DIR) && python3 -m uvicorn server:app --reload --host 0.0.0.0 --port 8000

install-frontend:
	@echo "📦 Installing npm dependencies..."
	cd $(FRONTEND_DIR) && if [ -f package.json ]; then npm install; else echo "⚠️ No package.json found"; fi

dev-frontend:
	@echo "🚀 Starting Frontend on http://localhost:3000"
	cd $(FRONTEND_DIR) && if [ -f package.json ]; then npm start; else echo "⚠️ No package.json found, skipping frontend"; fi

test-backend:
	cd $(BACKEND_DIR) && pytest tests/ -v

qa-milestone7:
	.venv/bin/pytest -q -n 0 backend/tests/test_web_experience_milestone0.py backend/tests/test_web_experience_milestone1.py backend/tests/test_web_experience_milestone2.py backend/tests/test_web_experience_milestone3.py backend/tests/test_web_experience_milestone4.py backend/tests/test_web_experience_milestone5.py backend/tests/test_web_experience_milestone6.py backend/tests/test_web_experience_milestone7.py backend/tests/test_web_experience_security_unit.py backend/tests/test_llm_security_unit.py
	cd $(FRONTEND_DIR) && CI=true npm test -- --watchAll=false --runInBand
	cd $(FRONTEND_DIR) && npm run quality:lint
	cd $(FRONTEND_DIR) && npm run build && npm run quality:budget

backup:
	@mkdir -p ./backups
	@datestamp=$$(date +%Y%m%d_%H%M%S); docker exec $(DB_CONTAINER) mongodump --authenticationDatabase admin -u admin -p admin123 --out=./backups/$${datestamp}; echo "✅ Backup: $${datestamp}"

restore:
	@if [ -z "$(DATESTAMP)" ]; then echo "❌ Use: make restore DATESTAMP=xxx"; exit 1; fi
	docker exec -i $(DB_CONTAINER) mongorestore --authenticationDatabase admin -u admin -p admin123 ./backups/$(DATESTAMP)

healthcheck:
	@if docker exec $(DB_CONTAINER) mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then echo "✅ MongoDB Healthy"; else echo "❌ MongoDB Not responding"; exit 1; fi

health-health:
	@echo "🏥 Testing backend health endpoint..."
	@curl -s http://localhost:8000/health | python3 -m json.tool || echo "❌ Backend not responding"
	@echo ""
	@echo "Status Response:"
	@curl -s http://localhost:8000/health

seed:
	docker exec $(DB_CONTAINER) mongosh --authenticationDatabase admin -u admin -p admin123 wisasumut --quiet --eval 'db.users.updateOne({email: "admin@wisatasumut.id"}, {$set: {role: "admin"}}, {upsert: true})'

status:
	@docker inspect $(DB_CONTAINER) --format='{{.State.Health.Status}}' || echo "not running"
	@docker exec $(DB_CONTAINER) mongosh --authenticationDatabase admin -u admin -p admin123 wisasumut --quiet --eval 'printjson(db.getCollectionNames())' | head -20

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
	@echo "  make restore          Restore (use DATESTAMP=xxx)"
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
	@echo "  make test-backend     Run pytest"
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
# run-backend: make sure .env is configured, then: cd backend && python3 -m uvicorn server:app --reload
