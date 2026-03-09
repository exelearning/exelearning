# Makefile for eXeLearning (Elysia Backend)
# Simplified wrapper around Docker and Bun scripts

# Detect OS
ifeq ($(OS),Windows_NT)
    ifdef MSYSTEM
        SYSTEM_OS := unix
    else ifdef CYGWIN
        SYSTEM_OS := unix
    else
        SYSTEM_OS := windows
    endif
else
    SYSTEM_OS := unix
endif

MAKEFLAGS += --no-print-directory

# Default target: show help
.DEFAULT_GOAL := help

# Check Bun is installed
check-bun:
ifeq ($(SYSTEM_OS),windows)
	@where bun >NUL 2>&1 || (if exist "$(HOME)\.bun\bin\bun.exe" (echo.) else (echo. & echo [ERROR] Bun is not installed. & echo    Install it from: https://bun.sh/ & echo. & exit 1))
else
	@command -v bun >/dev/null 2>&1 || [ -x "$$HOME/.bun/bin/bun" ] || { \
		echo ""; \
		echo "[ERROR] Bun is not installed."; \
		echo "   Install it from: https://bun.sh/"; \
		echo ""; \
		echo "   Quick install: curl -fsSL https://bun.sh/install | bash"; \
		echo ""; \
		exit 1; \
	}
endif

# Check .env file exists
check-env:
ifeq ($(SYSTEM_OS),windows)
	@if not exist .env (copy .env.dist .env) 2>nul
else
	@if [ ! -f .env ]; then cp .env.dist .env; fi
endif

# Check Docker is running
check-docker:
ifeq ($(SYSTEM_OS),windows)
	@docker version > NUL 2>&1 || (echo Error: Docker is not running & exit 1)
else
	@docker version > /dev/null 2>&1 || (echo "Error: Docker is not running" && exit 1)
endif

# Fail early if running in Windows cmd or PowerShell
fail-on-windows:
ifeq ($(SYSTEM_OS),windows)
	@echo ""
	@echo "[ERROR] This command is not supported on native Windows shells (cmd or PowerShell)."
	@echo "   Please use Git Bash, Cygwin, or WSL instead."
	@echo ""
	@exit 1
endif


# =============================================================================
# DOCKER COMMANDS
# =============================================================================

# Pull latest Docker images
.PHONY: pull
pull: check-docker check-env
	@docker compose pull

# Build Docker environment
.PHONY: up
build: check-docker check-env
	@echo "Building Docker image..."
	@docker compose build --pull

# Start Docker environment
# APP_ENV=dev (default): Elysia with hot-reload + SCSS watcher
# APP_ENV=prod: Pre-compiled Elysia, no watchers
.PHONY: up
up: check-docker check-env
	@echo "Starting Docker (APP_ENV=$${APP_ENV:-dev})..."
	@docker compose up --build --remove-orphans

.PHONY: up-postgres
up-postgres: check-docker check-env
	@echo "Starting Docker with PostgreSQL database..."
	@docker compose -f doc/deploy/docker-compose.postgres.yml run --build --rm --remove-orphans --service-ports exelearning

.PHONY: up-mariadb
up-mariadb: check-docker check-env
	@echo "Starting Docker with MariaDB datbase..."
	@docker compose -f doc/deploy/docker-compose.mariadb.yml run --build --rm --remove-orphans --service-ports exelearning

# Start Docker in background
.PHONY: upd
upd: check-docker check-env
	@echo "Starting Docker detached (APP_ENV=$${APP_ENV:-dev})..."
	@docker compose up -d --build --remove-orphans

# Stop Docker
.PHONY: down
down: check-docker
	@docker compose down

# Shell into container
.PHONY: shell
shell: check-docker
	@docker compose exec exelearning sh

# View logs
.PHONY: logs
logs: check-docker
	@docker compose logs -f exelearning


# =============================================================================
# LOCAL DEVELOPMENT
# =============================================================================

# Local environment variables (used by CLI commands)
# For up-local, cross-env handles these via package.json scripts
ifeq ($(SYSTEM_OS),windows)
# Windows: use cross-env for environment variable handling
LOCAL_ENV := npx cross-env FILES_DIR=data/ DB_PATH=data/exelearning.db PORT=8080 APP_ONLINE_MODE=1
else
LOCAL_ENV := FILES_DIR=data/ DB_PATH=data/exelearning.db PORT=8080 APP_ONLINE_MODE=1
endif

# Install dependencies
.PHONY: deps
deps: check-bun
	@LOCK=/tmp/.exe-bun-lock; \
	PIDFILE=/tmp/.exe-bun-lock.pid; \
	if mkdir "$$LOCK" 2>/dev/null; then \
		echo $$$$ > "$$PIDFILE"; \
		bun install; RET=$$?; rmdir "$$LOCK" 2>/dev/null; rm -f "$$PIDFILE"; exit $$RET; \
	else \
		if [ -f "$$PIDFILE" ] && ! kill -0 $$(cat "$$PIDFILE") 2>/dev/null; then \
			echo "[deps] Removing stale lock (owner PID no longer running)"; \
			rmdir "$$LOCK" 2>/dev/null; rm -f "$$PIDFILE"; \
			mkdir "$$LOCK" 2>/dev/null; \
			echo $$$$ > "$$PIDFILE"; \
			bun install; RET=$$?; rmdir "$$LOCK" 2>/dev/null; rm -f "$$PIDFILE"; exit $$RET; \
		fi; \
		WAITED=0; \
		while [ -d "$$LOCK" ]; do \
			sleep 0.5; WAITED=$$((WAITED + 1)); \
			if [ $$WAITED -ge 120 ]; then \
				echo "[deps] Lock held for >60s — removing stale lock"; \
				rmdir "$$LOCK" 2>/dev/null; rm -f "$$PIDFILE"; \
				break; \
			fi; \
		done; \
	fi

# Build CSS
.PHONY: css
css: check-bun
	@bun run css:node

# Build TypeScript + bundle JS
.PHONY: bundle
bundle: deps
	@echo "Building all assets..."
	@bun run build:all

# Start local development (web only)
# Uses cross-env to override .env values with local paths (data/)
# APP_ENV=dev (default): Elysia with hot-reload + SCSS watcher
# APP_ENV=prod: Pre-compiled Elysia, no watchers
.PHONY: up-local
up-local: check-bun check-env deps css bundle
ifeq ($(APP_ENV),prod)
	@echo "Starting local (prod mode)..."
	@$(MAKE) bundle
	$(LOCAL_ENV) bun run start
else
	@echo "Starting local (dev mode)..."
	bun run dev:local
endif

# Start full app: Static files + Electron (no server needed)
.PHONY: run-app
run-app: check-bun check-env deps css bundle
	@bun add --no-save electron-updater electron-log electron-context-menu 2>/dev/null || true
	@echo "Building static files..."
	@bun scripts/build-static-bundle.ts
	@echo "Copying static files to app/..."
	@rm -rf app/dist/static && mkdir -p app/dist && cp -r dist/static app/dist/static
	@echo "Launching eXeLearning App (Electron)..."
	@bun run electron

# Build static distribution (PWA mode, no server required)
# Usage: make build-static [VERSION=v1.0.0] [OUTPUT_DIR=/path/to/output]
.PHONY: build-static
build-static: check-bun deps css bundle
	@echo "Building static distribution..."
	@$(if $(VERSION),VERSION=$(VERSION) ,)$(if $(OUTPUT_DIR),OUTPUT_DIR=$(OUTPUT_DIR) ,)bun run build:static
	@echo "Static distribution built at $${OUTPUT_DIR:-dist/static/}"

# Build static distribution and serve it
# Usage: make up-static [PORT=8080]
.PHONY: up-static
up-static: build-static
	@echo ""
	@echo "============================================================"
	@echo "  Serving static distribution at http://localhost:$${PORT:-8080}"
	@echo "  Press Ctrl+C to stop"
	@echo "============================================================"
	@echo ""
	@bun x serve dist/static -p $${PORT:-8080}


# =============================================================================
# CLI COMMANDS
# =============================================================================

CLI := $(LOCAL_ENV) bun run src/cli/index.ts

# Generic CLI access
.PHONY: cli
cli: check-bun
	@$(CLI) $(ARGS)

# Create a new user
# Usage: make create-user EMAIL=x PASSWORD=y [ROLES=ROLE_USER,ROLE_ADMIN] [QUOTA=4096]
.PHONY: create-user
create-user: check-bun
ifndef EMAIL
	$(error EMAIL is required. Usage: make create-user EMAIL=x PASSWORD=y)
endif
ifndef PASSWORD
	$(error PASSWORD is required)
endif
	@$(CLI) create-user $(EMAIL) $(PASSWORD) $(if $(ROLES),--roles=$(ROLES),) $(if $(QUOTA),--quota=$(QUOTA),) $(if $(NO_FAIL),--no-fail,)

# Grant ROLE_ADMIN to a user
# Usage: make promote-admin EMAIL=x
.PHONY: promote-admin
promote-admin: check-bun
ifndef EMAIL
	$(error EMAIL is required. Usage: make promote-admin EMAIL=x)
endif
	@$(CLI) promote-admin $(EMAIL)

# Remove ROLE_ADMIN from a user
# Usage: make demote-admin EMAIL=x
.PHONY: demote-admin
demote-admin: check-bun
ifndef EMAIL
	$(error EMAIL is required. Usage: make demote-admin EMAIL=x)
endif
	@$(CLI) demote-admin $(EMAIL)

# Add a role to a user
# Usage: make grant-role EMAIL=x ROLE=y
.PHONY: grant-role
grant-role: check-bun
ifndef EMAIL
	$(error EMAIL is required. Usage: make grant-role EMAIL=x ROLE=y)
endif
ifndef ROLE
	$(error ROLE is required)
endif
	@$(CLI) grant-role $(EMAIL) $(ROLE)

# Remove a role from a user
# Usage: make revoke-role EMAIL=x ROLE=y
.PHONY: revoke-role
revoke-role: check-bun
ifndef EMAIL
	$(error EMAIL is required. Usage: make revoke-role EMAIL=x ROLE=y)
endif
ifndef ROLE
	$(error ROLE is required)
endif
	@$(CLI) revoke-role $(EMAIL) $(ROLE)

# Generate a JWT token
# Usage: make generate-jwt EMAIL=email@example.com [TTL=3600]
.PHONY: generate-jwt
generate-jwt: check-bun
ifndef EMAIL
	$(error EMAIL is required. Usage: make generate-jwt EMAIL=email@example.com [TTL=3600])
endif
	@$(CLI) jwt:generate $(EMAIL) $(if $(TTL),--ttl=$(TTL),)

# Clean temporary files
# Usage: make tmp-cleanup [MAX_AGE=86400] [DRY_RUN=1]
.PHONY: tmp-cleanup
tmp-cleanup: check-bun
	@$(CLI) tmp:cleanup $(if $(MAX_AGE),--max-age=$(MAX_AGE),) $(if $(DRY_RUN),--dry-run,)

# Extract and clean translations
# Usage: make translations [LOCALE=es] [EXTRACT_ONLY=1] [CLEAN_ONLY=1]
.PHONY: translations
translations: check-bun
	@$(CLI) translations $(if $(LOCALE),--locale=$(LOCALE),) $(if $(EXTRACT_ONLY),--extract-only,) $(if $(CLEAN_ONLY),--clean-only,)

# Update license information in public/libs/README.md
# Usage: make update-licenses [DRY_RUN=1]
.PHONY: update-licenses
update-licenses: check-bun
	@$(CLI) update-licenses $(if $(DRY_RUN),--dry-run,)


# =============================================================================
# ELPX PROCESSING
# =============================================================================

# Convert a legacy .elp file to .elpx
# Usage: make convert-elp INPUT=/path/to/file.elp OUTPUT=/path/to/output.elpx [DEBUG=1]
.PHONY: convert-elp
convert-elp: check-bun
ifndef INPUT
	$(error INPUT is required. Use INPUT=/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/path/to/output.elpx)
endif
	@$(CLI) elp:convert $(INPUT) $(OUTPUT) $(if $(DEBUG),--debug,)

# Export an ELP file to any supported format
# Usage: make export-elpx FORMAT=html5 INPUT=/path/to/file.elp OUTPUT=/path/to/output [DEBUG=1] [BASE_URL=https://...]
.PHONY: export-elpx
export-elpx: check-bun
ifndef FORMAT
	$(error FORMAT is required. Use FORMAT=html5, scorm12, etc.)
endif
ifndef INPUT
	$(error INPUT is required. Use INPUT=/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/path/to/output/folder)
endif
	@$(CLI) elp:export $(INPUT) $(OUTPUT) --format=$(FORMAT) $(if $(THEME),--theme=$(THEME),) $(if $(DEBUG),--debug,) $(if $(BASE_URL),--base-url=$(BASE_URL),)

# Format-specific export shortcuts
.PHONY: export-html5
export-html5: check-bun
ifndef INPUT
	$(error INPUT is required. Use INPUT=/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/path/to/output/folder)
endif
	@$(CLI) elp:export $(INPUT) $(OUTPUT) --format=html5 $(if $(THEME),--theme=$(THEME),) $(if $(DEBUG),--debug,) $(if $(BASE_URL),--base-url=$(BASE_URL),)

.PHONY: export-html5-sp
export-html5-sp: check-bun
ifndef INPUT
	$(error INPUT is required. Use INPUT=/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/path/to/output/folder)
endif
	@$(CLI) elp:export $(INPUT) $(OUTPUT) --format=html5-sp $(if $(THEME),--theme=$(THEME),) $(if $(DEBUG),--debug,) $(if $(BASE_URL),--base-url=$(BASE_URL),)

.PHONY: export-scorm12
export-scorm12: check-bun
ifndef INPUT
	$(error INPUT is required. Use INPUT=/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/path/to/output/folder)
endif
	@$(CLI) elp:export $(INPUT) $(OUTPUT) --format=scorm12 $(if $(THEME),--theme=$(THEME),) $(if $(DEBUG),--debug,) $(if $(BASE_URL),--base-url=$(BASE_URL),)

.PHONY: export-scorm2004
export-scorm2004: check-bun
ifndef INPUT
	$(error INPUT is required. Use INPUT=/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/path/to/output/folder)
endif
	@$(CLI) elp:export $(INPUT) $(OUTPUT) --format=scorm2004 $(if $(THEME),--theme=$(THEME),) $(if $(DEBUG),--debug,) $(if $(BASE_URL),--base-url=$(BASE_URL),)

.PHONY: export-ims
export-ims: check-bun
ifndef INPUT
	$(error INPUT is required. Use INPUT=/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/path/to/output/folder)
endif
	@$(CLI) elp:export $(INPUT) $(OUTPUT) --format=ims $(if $(THEME),--theme=$(THEME),) $(if $(DEBUG),--debug,) $(if $(BASE_URL),--base-url=$(BASE_URL),)

.PHONY: export-epub3
export-epub3: check-bun
ifndef INPUT
	$(error INPUT is required. Use INPUT=/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/path/to/output/folder)
endif
	@$(CLI) elp:export $(INPUT) $(OUTPUT) --format=epub3 $(if $(THEME),--theme=$(THEME),) $(if $(DEBUG),--debug,) $(if $(BASE_URL),--base-url=$(BASE_URL),)


# =============================================================================
# LINTING & FORMATTING
# =============================================================================

.PHONY: lint
lint: check-bun lint-ts lint-js lint-tests

.PHONY: fix
fix: check-bun fix-ts fix-js fix-tests

# Lint TypeScript source files (src/)
.PHONY: lint-ts
lint-ts: check-bun
	bun run lint:src

# Fix TypeScript source linting issues
.PHONY: fix-ts
fix-ts: check-bun
	bun run lint:src:fix

# Lint JavaScript files (public/app/)
.PHONY: lint-js
lint-js: check-bun
	bun run lint:public

# Fix JavaScript linting issues
.PHONY: fix-js
fix-js: check-bun
	bun run lint:public:fix

# Lint test files
.PHONY: lint-tests
lint-tests: check-bun
	bun run lint:test

# Fix test file linting issues
.PHONY: fix-tests
fix-tests: check-bun
	bun run lint:test:fix

.PHONY: format
format: check-bun
	bun run format

.PHONY: format-check
format-check: check-bun
	bun run format:check


# =============================================================================
# LEGACY SYSTEM (Core2 Duo / No Bun support)
# =============================================================================
# UNSUPPORTED legacy mode for developers whose systems cannot run Bun
# (e.g., older CPUs like Core2 Duo that lack AVX instructions).
#
# LIMITATIONS:
# - No WebSocket support (real-time collaboration disabled)
# - Runs in offline/single-user mode (APP_ONLINE_MODE=0)
# - Performance may be slower than Bun
# - Not recommended for production use
#
# For full functionality, use "make up" with Bun.

# Start Docker with Node.js (legacy mode)
.PHONY: up-legacy
up-legacy: check-docker check-env ## Start server with Node.js (for systems without Bun)
	@echo ""
	@echo "============================================================"
	@echo "  LEGACY MODE (Node.js) - UNSUPPORTED"
	@echo "============================================================"
	@echo "  This mode is for developers whose systems cannot run Bun"
	@echo "  (e.g., older CPUs like Core2 Duo without AVX support)."
	@echo ""
	@echo "  LIMITATIONS:"
	@echo "  - No WebSocket support (real-time collaboration disabled)"
	@echo "  - Runs in offline/single-user mode"
	@echo "  - Performance may be slower than Bun"
	@echo ""
	@echo "  For full functionality, use 'make up' with Bun."
	@echo "============================================================"
	@echo ""
	@docker compose -f docker-compose.legacy.yml up --build --remove-orphans

# Clean legacy Docker volumes
.PHONY: clean-legacy
clean-legacy: check-docker check-env
	@echo ""
	@echo "[LEGACY MODE] Starting with Node.js (no WebSocket, offline mode)"
	@echo ""
	@docker compose -f docker-compose.legacy.yml down -v --remove-orphans

# Stop legacy Docker
.PHONY: down-legacy
down-legacy: check-docker ## Stop legacy server
	@docker compose -f docker-compose.legacy.yml down

# Check Node.js is installed
check-node:
ifeq ($(SYSTEM_OS),windows)
	@where node >NUL 2>&1 || (echo. & echo [ERROR] Node.js is not installed. & echo    Install it from: https://nodejs.org/ & echo. & exit 1)
else
	@command -v node >/dev/null 2>&1 || { \
		echo ""; \
		echo "[ERROR] Node.js is not installed."; \
		echo "   Install it from: https://nodejs.org/"; \
		echo ""; \
		exit 1; \
	}
endif

.PHONY: test-frontend-legacy
test-frontend-legacy: check-node check-env ## Run frontend tests with Node.js (Vitest) + coverage (CI) - for systems without Bun
	npm run test:frontend:legacy

.PHONY: lint-legacy
lint-legacy: check-node
	@echo "[LEGACY] Running full lint with npm"
	npm run lint:src
	npm run lint:public
	npm run lint:test

.PHONY: fix-legacy
fix-legacy: check-node
	@echo "[LEGACY] Running full lint fix with npm"
	npm run lint:src:fix
	npm run lint:public:fix
	npm run lint:test:fix

# =============================================================================
# TESTING
# =============================================================================

.PHONY: check-tests
check-tests: check-bun
	bun run scripts/check-test-coverage.ts

.PHONY: check-coverage
check-coverage: check-bun ## Check that all files have at least 90% coverage
	@bun run scripts/check-coverage.ts < /tmp/exe-coverage.txt

# Test environment: in-memory database for isolation, no BASE_PATH
ifeq ($(SYSTEM_OS),windows)
TEST_ENV := set "BASE_PATH=" && set "DB_PATH=:memory:" && set "ELYSIA_FILES_DIR=%TEMP%\exelearning-test" &&
else
TEST_ENV := BASE_PATH="" DB_PATH=:memory: ELYSIA_FILES_DIR=/tmp/exelearning-test
endif

.PHONY: test
test: check-env check-env test-unit test-integration test-frontend test-e2e   ## Run unit tests (src/) with coverage

.PHONY: test-unit
test-unit: check-bun check-tests check-env bundle ## Run unit tests (src/) with coverage and 90% threshold
	@echo "Running unit tests with coverage..."
	@FORCE_COLOR=1 $(TEST_ENV) bun test:unit > /tmp/exe-coverage.txt 2>&1; \
	test_exit=$$?; \
	cat /tmp/exe-coverage.txt; \
	if [ $$test_exit -ne 0 ]; then exit $$test_exit; fi; \
	bun run scripts/check-coverage.ts < /tmp/exe-coverage.txt

.PHONY: test-integration
test-integration: check-bun check-env bundle ## Run integration tests
	$(TEST_ENV) bun test:integration

.PHONY: test-frontend
test-frontend: check-bun check-env bundle ## Run frontend tests (with Vitest + happy-dom) with coverage
	bun test:frontend

.PHONY: test-unit-ci
test-unit-ci: check-bun check-tests check-env ## Run unit tests with lcov coverage for CI/Codecov
	@echo "Running unit tests with lcov coverage..."
	@mkdir -p coverage/bun
	$(TEST_ENV) bun test:unit:ci
	@bun run scripts/check-coverage.ts < coverage/bun/lcov.info || true

.PHONY: test-e2e-chromium
test-e2e-chromium: check-env ## Run Playwright E2E tests with Chromium
	bun x playwright test --project=chromium

.PHONY: test-e2e
test-e2e: test-e2e-chromium bundle ## Run Playwright E2E tests (alias for test-e2e-chromium)

.PHONY: test-e2e-ui
test-e2e-ui: check-env ## Run Playwright E2E tests with UI
	bun x playwright test --ui

.PHONY: test-e2e-firefox
test-e2e-firefox: check-env bundle ## Run Playwright E2E tests with Firefox
	bun x playwright test --project=firefox

.PHONY: test-e2e-static
test-e2e-static: check-bun bundle build-static fail-on-windows ## Run E2E tests against static build
	@echo ""
	@echo "============================================================"
	@echo "  E2E Tests against Static Build"
	@echo "============================================================"
	@echo ""
	@echo "Running Playwright tests (server managed by Playwright)..."
	@echo ""
	@bun x playwright test --project=static; \
	test_exit=$$?; \
	echo ""; \
	if [ $$test_exit -eq 0 ]; then \
		echo "============================================================"; \
		echo "  Static E2E Tests PASSED"; \
		echo "============================================================"; \
	else \
		echo "============================================================"; \
		echo "  Static E2E Tests FAILED"; \
		echo "============================================================"; \
	fi; \
	exit $$test_exit

# =============================================================================
# DATABASE-SPECIFIC E2E TESTS
# =============================================================================
# These targets run E2E tests against different database backends using Docker.
# They build the app, start the services, run Playwright tests, and clean up.
#
# Usage:
#   make test-e2e-mariadb    # Test with MariaDB
#   make test-e2e-postgres   # Test with PostgreSQL
#   make test-e2e-sqlite     # Test with SQLite

# Helper to wait for app to be ready
define wait_for_app
	@echo "Waiting for app to be ready at http://localhost:8080..."
	@for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do \
		if curl -s http://localhost:8080/health > /dev/null 2>&1; then \
			echo "App is ready!"; \
			break; \
		fi; \
		if [ $$i -eq 30 ]; then \
			echo "Timeout waiting for app"; \
			docker compose -p $(1) -f doc/deploy/docker-compose.$(1).yml logs; \
			docker compose -p $(1) -f doc/deploy/docker-compose.$(1).yml down -v; \
			exit 1; \
		fi; \
		echo "  Attempt $$i/30 - waiting..."; \
		sleep 2; \
	done
endef

.PHONY: down-e2e
down-e2e:
	@echo ""
	@echo "Step 1: Cleaning up previous containers..."
	-@docker compose -p sqlite -f doc/deploy/docker-compose.sqlite.yml down -v --remove-orphans
	-@docker compose -p mariadb -f doc/deploy/docker-compose.mariadb.yml down -v --remove-orphans
	-@docker compose -p postgres -f doc/deploy/docker-compose.postgres.yml down -v --remove-orphans


.PHONY: test-e2e-mariadb
test-e2e-mariadb: check-docker check-env down-e2e ## Run E2E tests with MariaDB backend
	@echo ""
	@echo "============================================================"
	@echo "  E2E Tests with MariaDB"
	@echo "============================================================"
	@echo ""
	@echo "Step 2: Building and starting services..."
	@docker compose -p mariadb --env-file doc/deploy/.env.e2e -f doc/deploy/docker-compose.mariadb.yml up --build -d
	@echo ""
	@echo "Step 3: Waiting for services to be ready..."
	$(call wait_for_app,mariadb)
	@echo ""
	@echo "Step 4: Running Playwright tests..."
	@echo ""
	@E2E_BASE_URL=http://localhost:8080 bun x playwright test --project=chromium; \
	test_exit=$$?; \
	echo ""; \
	echo "Step 5: Cleaning up..."; \
	docker compose -p mariadb -f doc/deploy/docker-compose.mariadb.yml down -v; \
	echo ""; \
	if [ $$test_exit -eq 0 ]; then \
		echo "============================================================"; \
		echo "  ✅ MariaDB E2E Tests PASSED"; \
		echo "============================================================"; \
	else \
		echo "============================================================"; \
		echo "  ❌ MariaDB E2E Tests FAILED"; \
		echo "============================================================"; \
	fi; \
	exit $$test_exit

.PHONY: test-e2e-postgres
test-e2e-postgres: check-docker check-env down-e2e ## Run E2E tests with PostgreSQL backend
	@echo ""
	@echo "============================================================"
	@echo "  E2E Tests with PostgreSQL"
	@echo "============================================================"
	@echo ""
	@echo "Step 2: Building and starting services..."
	@docker compose -p postgres --env-file doc/deploy/.env.e2e -f doc/deploy/docker-compose.postgres.yml up --build -d
	@echo ""
	@echo "Step 3: Waiting for services to be ready..."
	$(call wait_for_app,postgres)
	@echo ""
	@echo "Step 4: Running Playwright tests..."
	@echo ""
	@E2E_BASE_URL=http://localhost:8080 bun x playwright test --project=chromium; \
	test_exit=$$?; \
	echo ""; \
	echo "Step 5: Cleaning up..."; \
	docker compose -p postgres -f doc/deploy/docker-compose.postgres.yml down -v; \
	echo ""; \
	if [ $$test_exit -eq 0 ]; then \
		echo "============================================================"; \
		echo "  ✅ PostgreSQL E2E Tests PASSED"; \
		echo "============================================================"; \
	else \
		echo "============================================================"; \
		echo "  ❌ PostgreSQL E2E Tests FAILED"; \
		echo "============================================================"; \
	fi; \
	exit $$test_exit

.PHONY: test-e2e-sqlite
test-e2e-sqlite: check-docker check-env down-e2e ## Run E2E tests with SQLite backend
	@echo ""
	@echo "============================================================"
	@echo "  E2E Tests with SQLite"
	@echo "============================================================"
	@echo ""
	@echo "Step 2: Building and starting services..."
	@docker compose -p sqlite --env-file doc/deploy/.env.e2e -f doc/deploy/docker-compose.sqlite.yml up --build -d
	@echo ""
	@echo "Step 3: Waiting for services to be ready..."
	$(call wait_for_app,sqlite)
	@echo ""
	@echo "Step 4: Running Playwright tests..."
	@echo ""
	@E2E_BASE_URL=http://localhost:8080 bun x playwright test --project=chromium; \
	test_exit=$$?; \
	echo ""; \
	echo "Step 5: Cleaning up..."; \
	docker compose -p sqlite -f doc/deploy/docker-compose.sqlite.yml down -v; \
	echo ""; \
	if [ $$test_exit -eq 0 ]; then \
		echo "============================================================"; \
		echo "  ✅ SQLite E2E Tests PASSED"; \
		echo "============================================================"; \
	else \
		echo "============================================================"; \
		echo "  ❌ SQLite E2E Tests FAILED"; \
		echo "============================================================"; \
	fi; \
	exit $$test_exit


# =============================================================================
# PACKAGING
# =============================================================================

# Build release package
# Usage: make package VERSION=1.0.0 [PUBLISH=always]
.PHONY: package
package: check-bun deps bundle
ifndef VERSION
	$(error VERSION is required. Usage: make package VERSION=x.y.z)
endif
	$(eval PACKAGE_VERSION := $(patsubst v%,%,$(VERSION)))
	$(eval PACKAGE_VERSION := $(strip $(PACKAGE_VERSION)))
	@echo "Packaging version $(VERSION) (npm version: $(PACKAGE_VERSION))..."
	@echo "Building static files..."
	@bun run build:static
	@echo "Copying static files to app/dist/static..."
	@rm -rf app/dist/static && mkdir -p app/dist && cp -r dist/static app/dist/static
	@echo "Updating version in package.json files..."
	@bun -e "let pkg=require('./package.json'); pkg.version='$(PACKAGE_VERSION)'; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));"
	@bun -e "let pkg=require('./app/package.json'); pkg.version='$(PACKAGE_VERSION)'; require('fs').writeFileSync('app/package.json', JSON.stringify(pkg, null, 2));"
	@echo "Installing app dependencies..."
	@cd app && npm install --production
	@echo "Building Electron package..."
	npm run electron:pack $(if $(PUBLISH),-- --publish $(PUBLISH),)
	@echo "Restoring version to 0.0.0-alpha..."
	@bun -e "let pkg=require('./package.json'); pkg.version='0.0.0-alpha'; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));"
	@bun -e "let pkg=require('./app/package.json'); pkg.version='0.0.0-alpha'; require('fs').writeFileSync('app/package.json', JSON.stringify(pkg, null, 2));"
	@echo "Package created successfully with version $(VERSION)"


## --------- WINDOWS LOCAL SIGN ---------

# Accept multiple aliases for certificate thumbprint
CERT_SHA1 ?= $(or $(CERT_THUMBPRINT),$(CERTIFICATE_SHA1),$(WIN_CERTIFICATE_SHA1))

.SILENT: check-release-env eb-inject-config eb-cleanup-config package-windows-local-sign
.PHONY: check-release-env eb-inject-config eb-cleanup-config package-windows-local-sign

# Fail fast if required env/inputs are missing
check-release-env:
	@: $(if $(VERSION),,$(error VERSION is not set. Usage: make package-windows-local-sign VERSION=vX.Y.Z CERT_THUMBPRINT=...))
	@: $(if $(or $(GH_TOKEN),$(GITHUB_TOKEN),$(GITHUB_RELEASE_TOKEN)),,$(error GH_TOKEN or GITHUB_TOKEN is required to publish to GitHub))
	@: $(if $(CERT_SHA1),,$(error Set CERT_THUMBPRINT (or CERTIFICATE_SHA1/WIN_CERTIFICATE_SHA1) with your certificate SHA1 thumbprint))

# Inject ephemeral config into package.json (win.certificateSha1)
eb-inject-config:
	bun -e "const fs=require('fs');const pth='package.json';\
	 const s=fs.readFileSync(pth,'utf8'); const pj=JSON.parse(s); \
	 pj.build=pj.build||{}; \
	 pj.build.win=pj.build.win||{}; \
	 pj.build.win.certificateSha1 = process.env.CERT_SHA1 || pj.build.win.certificateSha1; \
	 fs.writeFileSync(pth, JSON.stringify(pj,null,2)); \
	 fs.writeFileSync('.eb-injected.sentinel','1'); \
	 console.log('Injected: win.certificateSha1');"

# Remove only what we injected (win.certificateSha1)
eb-cleanup-config:
	@if [ -f .eb-injected.sentinel ]; then \
	  bun -e "const fs=require('fs');const pth='package.json';\
	    const pj=JSON.parse(fs.readFileSync(pth,'utf8')); \
	    if(pj.build && pj.build.win){ delete pj.build.win.certificateSha1; } \
	    fs.writeFileSync(pth, JSON.stringify(pj,null,2)); \
	    console.log('Cleaned: win.certificateSha1');"; \
	  rm -f .eb-injected.sentinel; \
	fi

# Windows packaging with local certificate store thumbprint
# Usage: make package-windows-local-sign VERSION=v3.0.0 CERT_THUMBPRINT=<SHA1> [PUBLISH=always]
package-windows-local-sign: fail-on-windows check-release-env eb-inject-config
	@echo "Tag/version: $(VERSION)"
	@echo "Cert SHA1: $(CERT_SHA1)"
	@echo "Cleaning previous build artifacts..."
	@rm -rf node_modules dist || true
	@DEBUG=electron-builder \
	 GH_TOKEN="$${GH_TOKEN:-$${GITHUB_TOKEN:-$${GITHUB_RELEASE_TOKEN}}}" \
	 $(MAKE) package VERSION="$(VERSION)" PUBLISH=$(if $(PUBLISH),$(PUBLISH),always)
	@$(MAKE) eb-cleanup-config
	@echo "Windows package (signed) built & published for $(VERSION)"

## --------- END WINDOWS LOCAL SIGN ---------


# =============================================================================
# UTILITIES
# =============================================================================

# Clean Docker volumes
.PHONY: clean
clean: check-docker
	docker compose down -v --remove-orphans

# Clean local data (database + assets) for fresh start
.PHONY: clean-local
clean-local: check-bun
	bun scripts/setup-local.js --clean

# Clean test artifacts
.PHONY: test-clean
test-clean:
	rm -rf coverage playwright-report test-results

# Destroy everything: containers, volumes, images, node_modules, dist (with confirmation)
.PHONY: destroy
destroy: check-docker
ifeq ($(SYSTEM_OS),windows)
	@echo "WARNING: This will remove containers, images, node_modules/, dist/, data/*"
	@choice /M "Are you sure you want to destroy everything?" || exit 1
	@docker compose down -v --rmi all --remove-orphans
	@if exist node_modules rmdir /S /Q node_modules
	@if exist dist rmdir /S /Q dist
	@if exist data ( for %%i in (data\*) do if /I not "%%~nxi"==".gitkeep" del /Q "%%i" )
	@echo "Everything destroyed. Next run will be a fresh start."
else
	@echo "WARNING: This will remove containers, images, node_modules/, dist/, data/*"
	@read -p "Are you sure? [y/N] " confirm; \
	if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
		echo "Aborted."; exit 1; \
	fi; \
	docker compose down -v --rmi all --remove-orphans; \
	rm -rf node_modules dist; \
	if [ -d data ]; then find data -mindepth 1 ! -name ".gitkeep" -exec rm -rf {} + 2>/dev/null || true; fi; \
	echo "Everything destroyed. Next run will be a fresh start."
endif


# =============================================================================
# HELP
# =============================================================================

.PHONY: help
help:
	@echo "eXeLearning Development Commands"
	@echo ""
	@echo "Docker:"
	@echo "  make build           Build Docker image"
	@echo "  make clean           Stop and remove volumes"
	@echo "  make destroy         Remove everything (containers, images, node_modules)"
	@echo "  make down            Stop Docker"
	@echo "  make logs            View container logs"
	@echo "  make pull            Pull latest Docker images"
	@echo "  make shell           Shell into container"
	@echo "  make up              Start Docker (dev mode by default)"
	@echo "  make up APP_ENV=prod Start Docker (prod mode)"
	@echo "  make up-mariadb      Start Docker with MariaDB"
	@echo "  make up-postgres     Start Docker with PostgreSQL"
	@echo "  make upd             Start Docker detached"
	@echo ""
	@echo "Local:"
	@echo "  make bundle                Build all assets (TS + CSS + JS bundle)"
	@echo "  make clean-local           Clean local data (database + assets)"
	@echo "  make css                   Build CSS only"
	@echo "  make deps                  Install dependencies"
	@echo "  make run-app               Start Electron + backend (desktop app)"
	@echo "  make up-local              Start locally (web only, dev mode)"
	@echo "  make up-local APP_ENV=prod Start locally (web only, prod mode)"
	@echo "  make build-static [VERSION=v1.0.0]  Build static distribution (PWA mode)"
	@echo "  make up-static             Build and serve static distribution (PWA mode)"
	@echo "  make up-static PORT=3000   Same, but on custom port"
	@echo ""
	@echo "CLI Commands:"
	@echo "  make cli ARGS='...'                           Generic CLI access"
	@echo "  make create-user EMAIL=x PASSWORD=y           Create a new user"
	@echo "  make demote-admin EMAIL=x                     Remove ROLE_ADMIN"
	@echo "  make generate-jwt EMAIL=x [TTL=3600]          Generate JWT token"
	@echo "  make grant-role EMAIL=x ROLE=y                Add role to user"
	@echo "  make promote-admin EMAIL=x                    Grant ROLE_ADMIN"
	@echo "  make revoke-role EMAIL=x ROLE=y               Remove role from user"
	@echo "  make tmp-cleanup [MAX_AGE=86400]              Clean temp files"
	@echo "  make translations [LOCALE=es]                 Extract/clean translations"
	@echo "  make update-licenses [DRY_RUN=1]              Update license info"
	@echo ""
	@echo "ELPX Processing:"
	@echo "  make convert-elp INPUT=x OUTPUT=y             Convert ELP v2.x to v3.0 (elpx)"
	@echo "  make export-elpx FORMAT=x INPUT=y OUTPUT=z    Export to any format"
	@echo "  make export-epub3 INPUT=x OUTPUT=y            Export to EPUB3"
	@echo "  make export-html5 INPUT=x OUTPUT=y            Export to HTML5"
	@echo "  make export-html5-sp INPUT=x OUTPUT=y         Export to HTML5 single-page"
	@echo "  make export-ims INPUT=x OUTPUT=y              Export to IMS Content Package"
	@echo "  make export-scorm12 INPUT=x OUTPUT=y          Export to SCORM 1.2"
	@echo "  make export-scorm2004 INPUT=x OUTPUT=y        Export to SCORM 2004"
	@echo ""
	@echo "Testing:"
	@echo "  make check-coverage     Check 90% coverage threshold"
	@echo "  make check-tests        Check test file coverage requirements"
	@echo "  make test               Run all tests"
	@echo "  make test-clean         Clean test artifacts"
	@echo "  make test-frontend      Run frontend tests (Vitest)"
	@echo "  make test-integration   Run integration tests"
	@echo "  make test-unit          Run unit tests with coverage"
	@echo "  make test-unit-ci       Run unit tests with lcov for CI"
	@# TODO: Implement test-watch target
	@# @echo "  make test-watch         Run tests in watch mode"
	@echo ""
	@echo "E2E Testing (Playwright):"
	@echo "  make down-e2e           Clean up E2E Docker containers"
	@echo "  make test-e2e           Run E2E tests (Chromium)"
	@echo "  make test-e2e-chromium  Run E2E tests with Chromium"
	@echo "  make test-e2e-firefox   Run E2E tests with Firefox"
	@echo "  make test-e2e-static    Run E2E tests against static build"
	@echo "  make test-e2e-mariadb   Run E2E tests with MariaDB backend"
	@echo "  make test-e2e-postgres  Run E2E tests with PostgreSQL backend"
	@echo "  make test-e2e-sqlite    Run E2E tests with SQLite backend"
	@echo "  make test-e2e-ui        Run E2E tests with Playwright UI"
	@echo ""
	@echo "Legacy (Core2 Duo / No Bun):"
	@echo "  make clean-legacy           Stop and remove legacy volumes"
	@echo "  make down-legacy            Stop legacy server"
	@echo "  make fix-legacy             Fix lint issues using npm"
	@echo "  make lint-legacy            Run lint using npm (no Bun required)"
	@echo "  make test-frontend-legacy   Run frontend tests with Node.js + coverage"
	@echo "  make up-legacy              Start legacy server with Node.js (Docker)"
	@echo ""
	@echo "Linting (Biome):"
	@echo "  make fix             Fix all lint issues"
	@echo "  make fix-js          Fix JavaScript linting issues"
	@echo "  make fix-tests       Fix test linting issues"
	@echo "  make fix-ts          Fix TypeScript linting issues"
	@echo "  make format          Format code with Biome"
	@echo "  make format-check    Check formatting without fixing"
	@echo "  make lint            Run lint on all files"
	@echo "  make lint-js         Lint JavaScript (public/app/)"
	@echo "  make lint-tests      Lint test files"
	@echo "  make lint-ts         Lint TypeScript source (src/)"
	@echo ""
	@echo "Packaging:"
	@echo "  make package VERSION=1.0.0                    Build release"
	@echo "  make package VERSION=1.0.0 PUBLISH=always     Build & publish to GitHub"
	@echo "  make package-windows-local-sign VERSION=1.0.0 CERT_THUMBPRINT=xxx"
	@echo "                                                Build signed Windows release"
