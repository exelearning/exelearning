# Makefile to facilitate the use of Docker in the exelearning project

# Detect the operating system
ifeq ($(OS),Windows_NT)
    # We are on Windows
    ifdef MSYSTEM
        # MSYSTEM is defined, we are in MinGW or MSYS
        SYSTEM_OS := unix
    else ifdef CYGWIN
        # CYGWIN is defined, we are in Cygwin
        SYSTEM_OS := unix
    else
        # Not in MinGW or Cygwin
        SYSTEM_OS := windows

    endif
else
    # Not Windows, assuming Unix
    SYSTEM_OS := unix
endif

MAKEFLAGS += --no-print-directory

PUBLISH_ARG := $(if $(PUBLISH),--publish $(PUBLISH),)

# Use subst for multiplatform ~ expand
EXPAND_PATH = $(subst ~,$(HOME),$(1))

# Enable debug if DEBUG or ACTIONS_STEP_DEBUG is set (e.g., in GitHub Actions re-run with debug logging)
DEBUG_FLAG := $(if $(filter 1 true yes,$(DEBUG) $(ACTIONS_STEP_DEBUG)) ,--debug,)

# Check if Docker is running
check-docker:
ifeq ($(SYSTEM_OS),windows)
	@echo "Detected system: Windows (cmd, powershell)"
	@docker version > NUL 2>&1 || (echo. & echo Error: Docker is not running. Please make sure Docker is installed and running. & echo. & exit 1)
else
	@echo "Detected system: Unix (Linux/macOS/Cygwin/MinGW)"	
	@docker version > /dev/null 2>&1 || (echo "" && echo "Error: Docker is not running. Please make sure Docker is installed and running." && echo "" && exit 1)
endif

# Check if the .env file exists, if not, copy from .env.dist
check-env:
ifeq ($(SYSTEM_OS),windows)
	@if not exist .env ( \
		echo The .env file does not exist. Copying from .env.dist... && \
		copy .env.dist .env \
	) 2>nul
else
	@if [ ! -f .env ]; then \
		echo "The .env file does not exist. Copying from .env.dist..."; \
		cp .env.dist .env; \
	fi
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

# Start Docker containers in interactive mode
up: check-docker check-env
	docker compose up --build --remove-orphans

# Start Docker containers in background mode (daemon)
upd: check-docker check-env
	docker compose up --detach --remove-orphans

# Stop and remove Docker containers
down: check-docker check-env
	@docker compose --profile e2e down

# Pull the latest images from the registry
pull: check-docker check-env
	docker compose -f docker-compose.yml pull

# Build or rebuild Docker containers
build: check-docker check-env
	docker compose build

# Run the linter to check PHP and JS code style
lint: lint-php lint-js

# Automatically fix PHP and JS code style issues
fix: fix-php fix-js

# Check PHP code style with PHP-CS-Fixer
lint-php: check-docker check-env upd
	docker compose exec exelearning composer --no-cache php-cs-checker

# Automatically fix PHP code style with PHP-CS-Fixer
fix-php: check-docker check-env upd
	docker compose exec exelearning composer --no-cache php-cs-fixer

# Check JavaScript files indentation
lint-js:
	yarn check-format

# Indent JavaScript files with 4 spaces
fix-js:
	yarn format

# Run unit tests with PHPUnit (alias)
phpunit: test

# Run ALL or a specific PHPUnit test (by file or with extra args)
# Usage: make test [TEST=tests/Command/AlgoTest.php] [EXTRA="--filter testAlgo"]
test: check-docker check-env
	@echo "Starting unit test environment..."
	@docker compose --profile e2e up -d --quiet-pull
	@echo "Running PHPUnit $(if $(TEST),test: $(TEST) $(EXTRA),suite: all)"
	@if [ -n "$(TEST)" ]; then \
		docker compose exec exelearning vendor/bin/phpunit --configuration phpunit.xml.dist --colors=always $(TEST) $(EXTRA) -- $(DEBUG_FLAG); \
	else \
		docker compose exec exelearning composer --no-cache phpunit -- $(DEBUG_FLAG); \
	fi
	@echo "Stopping test environment..."
	@docker compose --profile e2e down > /dev/null 2>&1


# Run just unit tests with PHPUnit
test-unit: check-docker check-env
	@echo "Starting unit test environment..."
	@docker compose up -d --quiet-pull
	@echo "Running PHPUnit tests..."
	@docker compose exec exelearning composer --no-cache phpunit-unit -- $(DEBUG_FLAG)
	@echo "Stopping test environment..."
	@docker compose --profile e2e down > /dev/null 2>&1

# Run just e2e tests with PHPUnit
test-e2e: check-docker check-env
	@echo "Starting e2e test environment..."
	@docker compose --profile e2e up -d --quiet-pull
	@echo "Running PHPUnit tests..."
	@docker compose exec exelearning composer --no-cache phpunit-e2e -- $(DEBUG_FLAG)

# Run just e2e-realtime tests with PHPUnit
test-e2e-realtime: check-docker check-env
	@echo "Starting e2e test environment..."
	@docker compose --profile e2e up -d --quiet-pull
	@echo "Running PHPUnit tests..."
	@docker compose exec exelearning composer --no-cache phpunit-e2e-realtime -- $(DEBUG_FLAG)

# Open a shell inside the exelearning container ready for running phpunit
test-shell:
	docker compose --profile e2e up -d --quiet-pull	
	@echo "\033[33mRun a specific test with 'composer phpunit <test path>'. Example: composer phpunit tests/Command/CreateUserCommandTest.php\033[0m"	
	docker compose exec exelearning sh
	docker compose --profile e2e down

# Open a shell inside the exelearning container
shell: check-docker check-env upd
	docker compose exec exelearning sh

# Clean up and stop Docker containers, removing volumes and orphan containers
clean: check-docker check-env
	@docker compose --profile e2e down -v --remove-orphans

# Command to create a user via Symfony console with input prompts
create-user: check-docker check-env upd
	@read -p "Enter email: " email; \
	read -p "Enter password: " password; \
	read -p "Enter username: " username; \
	docker compose exec exelearning php bin/console app:create-user $$email $$password $$username --no-fail;

# Generate API key for a user (Usage: make generate-api-key USER_ID=123 [OVERWRITE=1])
generate-api-key: check-docker check-env upd
	@if [ -z "$(USER_ID)" ]; then \
		echo "❌ USER_ID is required. Usage: make generate-api-key USER_ID=123 [OVERWRITE=1]"; \
		exit 1; \
	fi
	docker compose exec exelearning composer --no-cache generate-api-key -- $(USER_ID) $(if $(OVERWRITE),--overwrite,)

# Update Composer dependencies
update: check-docker check-env upd
	docker compose exec exelearning composer update --no-cache --with-all-dependencies

# Update translation string
translations: check-docker check-env upd
	docker compose exec exelearning composer --no-cache translations:extract

# Start the local environment with specific commands
up-local: check-env
	@echo "\033[31mWarning: Running in local environment may cause unexpected behavior. Use at your own risk.\033[0m"
	@TMPDIR=$$(mktemp -d /tmp/exelearning-XXXXXX) && \
	echo "Using temporary directory: $$TMPDIR" && \
	export DB_DRIVER=pdo_sqlite && \
	export APP_ENV=dev && \
	export APP_DEBUG=1 && \
	export APP_ONLINE_MODE=1 && \
	export DB_PATH="$$TMPDIR/exelearning.db" && \
	export FILES_DIR="$$TMPDIR/" && \
	export TEST_USER_EMAIL="user@exelearning.net" && \
	export TEST_USER_PASSWORD="1234" && \
	export TEST_USER_USERNAME="testuser" && \
	export APP_SECRET=mySuperSecretKey && \
	php bin/console doctrine:schema:update --force && \
	php bin/console app:create-user "$${TEST_USER_EMAIL}" "$${TEST_USER_PASSWORD}" "$${TEST_USER_USERNAME}" --no-fail && \
	php bin/console cache:clear && \
	php bin/console assets:install public && \
	php bin/console dbal:run-sql "SELECT * FROM users" && \
	php -d variables_order=EGPCS -S 127.0.0.1:8000 -t public public/router.php

# Start the unit tests in a local environment
test-local: check-env
	@echo "\033[31mWarning: Running tests in local environment may cause unexpected behavior. Use at your own risk.\033[0m"
	@TMPDIR=$$(mktemp -d /tmp/exe-test-XXXXXX) && \
	echo "Using temporary directory: $$TMPDIR" && \
	DB_DRIVER=pdo_sqlite \
	DB_PATH="$$TMPDIR/exelearning.db" \
	FILES_DIR="$$TMPDIR/" \
	APP_ENV=dev \
	APP_DEBUG=1 \
	APP_SECRET=TestSecretKey \
	composer --no-cache phpunit-unit

# Generate a new migration class from changes in mapping information and compy them to the ./migrations local folder
migration: check-docker check-env upd
	docker compose exec exelearning php bin/console make:migration
	docker compose cp exelearning:/app/migrations/. ./migrations/

# Execute Symfony migrations
migrate: check-docker check-env upd
	docker compose exec exelearning php bin/console doctrine:migrations:migrate --no-interaction

# Convert an ELP file via Docker using STDIN
# Usage: make convert-elp INPUT=path/to/input.elp OUTPUT=path/to/output.elp [DEBUG=debug]
# Important! Only works with absolute paths!
convert-elp: fail-on-windows check-docker check-env upd
ifndef INPUT
	$(error INPUT is required. Use INPUT=/absolute/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/absolute/path/to/output.elp)
endif
	$(eval EXPANDED_INPUT := $(call EXPAND_PATH,$(INPUT)))
	@if [ ! -f "$(EXPANDED_INPUT)" ]; then \
	  echo "❌ INPUT file does not exist: $(EXPANDED_INPUT)"; \
	  exit 1; \
	fi
	@mkdir -p $(dir $(OUTPUT))
	@echo "Converting ELP file..."
	@# Generate a temporary filename inside the container
	$(eval TEMP_OUTPUT := /tmp/converted_$(shell date +%s).elp)
	
	@# Pass input via stdin, specifying output path in the container
	@cat "$(EXPANDED_INPUT)" | \
	env MSYS_NO_PATHCONV=1 docker compose exec -T exelearning \
	    php bin/console elp:convert - "$(TEMP_OUTPUT)" $(if $(filter debug,$(DEBUG)),--debug,)
	
	@# Copy the converted file out of the container
	@docker compose cp exelearning:"$(TEMP_OUTPUT)" "$(OUTPUT)"
	
	@echo "✅ Done. Output saved to $(OUTPUT)"

# Export an ELP file via Docker in a given format using STDIN
# Usage: make export-elp FORMAT=html5 INPUT=/abs/path.elp OUTPUT=/abs/output/folder [DEBUG=debug] [BASE_URL=https://example.com]
export-elp: fail-on-windows check-docker check-env upd
ifndef FORMAT
	$(error FORMAT is required. Use FORMAT=html5, scorm12, etc.)
endif
ifndef INPUT
	$(error INPUT is required. Use INPUT=/absolute/path/to/file.elp)
endif
ifndef OUTPUT
	$(error OUTPUT is required. Use OUTPUT=/absolute/path/to/output/folder)
endif
	$(eval EXPANDED_INPUT := $(call EXPAND_PATH,$(INPUT)))
	@if [ ! -f "$(EXPANDED_INPUT)" ]; then \
	  echo "❌ INPUT file does not exist: $(EXPANDED_INPUT)"; \
	  exit 1; \
	fi
	@mkdir -p "$(OUTPUT)"
	@echo "Exporting ELP file to format '$(FORMAT)'..."

	$(eval TEMP_OUTPUT := /tmp/export_$(shell date +%s))

	@cat "$(EXPANDED_INPUT)" | \
	env MSYS_NO_PATHCONV=1 docker compose exec -T exelearning \
	php bin/console elp:export - "$(TEMP_OUTPUT)" "$(FORMAT)" \
	$(if $(filter debug,$(DEBUG)),--debug,) \
	$(if $(BASE_URL),--base-url=$(BASE_URL),)

	@docker compose cp exelearning:"$(TEMP_OUTPUT)/." "$(OUTPUT)/"

	@echo "✅ Done. Exported files saved to $(OUTPUT)"

# Usage: make export-elp-html5 INPUT=/abs/file.elp OUTPUT=/abs/output/dir
export-elp-html5:
	@$(MAKE) export-elp FORMAT=html5 INPUT="$(INPUT)" OUTPUT="$(OUTPUT)" DEBUG="$(DEBUG)" BASE_URL="$(BASE_URL)"

export-elp-scorm12:
	@$(MAKE) export-elp FORMAT=scorm12 INPUT="$(INPUT)" OUTPUT="$(OUTPUT)" DEBUG="$(DEBUG)" BASE_URL="$(BASE_URL)"

export-elp-scorm2004:
	@$(MAKE) export-elp FORMAT=scorm2004 INPUT="$(INPUT)" OUTPUT="$(OUTPUT)" DEBUG="$(DEBUG)" BASE_URL="$(BASE_URL)"

export-elp-epub3:
	@$(MAKE) export-elp FORMAT=epub3 INPUT="$(INPUT)" OUTPUT="$(OUTPUT)" DEBUG="$(DEBUG)" BASE_URL="$(BASE_URL)"

export-elp-ims:
	@$(MAKE) export-elp FORMAT=ims INPUT="$(INPUT)" OUTPUT="$(OUTPUT)" DEBUG="$(DEBUG)" BASE_URL="$(BASE_URL)"


# Install nativephp/php-bin package temporarily without modifying composer.json
install-php-bin:
	@echo "Installing nativephp/php-bin temporarily..."
	composer require --dev nativephp/php-bin

# Remove nativephp/php-bin package without modifying composer.json
remove-php-bin:
	@echo "Removing nativephp/php-bin temporarily..."
	composer remove --dev nativephp/php-bin --no-scripts

# Run the app locally with yarn (requires PHP binaries), pass DEBUG=1 to enable dev mode
run-app: install-php-bin
	yarn install
ifeq ($(SYSTEM_OS),windows)
	powershell -Command "$$env:EXELEARNING_DEBUG_MODE='$(DEBUG)'; yarn start"	
	#set EXELEARNING_DEBUG_MODE=$(DEBUG) && yarn start
else
	EXELEARNING_DEBUG_MODE=$(DEBUG) yarn start
endif

	$(MAKE) remove-php-bin

# Package the application with the specified version
# Usage: make package VERSION=1.0.0
package: install-php-bin
ifndef VERSION
	$(error VERSION is not set. Usage: make package VERSION=x.y.z)
endif
	@echo "Packaging application with version $(VERSION)..."
	
	# Update version in Constants.php and package.json
	@echo "Updating version in files..."
	@sed -i.bak "s|public const APP_VERSION = '.*';|public const APP_VERSION = '$(VERSION)';|" src/Constants.php && rm -f src/Constants.php.bak
	@sed -i.bak "s|\"version\":[[:space:]]*\"[^\"]*\"|\"version\": \"$(VERSION)\"|" package.json && rm -f package.json.bak

	@echo "Installing Node.js dependencies..."
	yarn install
	
	# Build & publish for current platform
	@echo "Building & publishing for current platform..."
	yarn build $(PUBLISH_ARG)
	
	# Restore the fixed version in package.json and Constants.php
	@echo "Restoring fixed version v0.0.0-alpha in package.json and Constants.php..."
	@sed -i.bak "s|public const APP_VERSION = '.*';|public const APP_VERSION = 'v0.0.0-alpha';|" src/Constants.php && rm -f src/Constants.php.bak
	@sed -i.bak "s|\"version\":[[:space:]]*\"[^\"]*\"|\"version\": \"v0.0.0-alpha\"|" package.json && rm -f package.json.bak
	
	# Remove php-bin
	$(MAKE) remove-php-bin
	
	@echo "Package created successfully with version $(VERSION)"
	@echo "Installer files available in the dist/ directory"

# Display help with available commands
help:
	@echo ""
	@echo "Usage: make <command>"
	@echo ""
	@echo "Docker management:"
	@echo ""
	@echo "  build                 - Build or rebuild Docker containers"
	@echo "  clean                 - Clean up and stop Docker containers, removing volumes and orphan containers"
	@echo "  down                  - Stop and remove Docker containers"
	@echo "  pull                  - Pull the latest images from the registry"
	@echo "  shell                 - Open a shell inside the exelearning container"
	@echo "  up                    - Start Docker containers in interactive mode"
	@echo "  up-local              - Run local Symfony server and prepare the environment (unstable)"
	@echo "  upd                   - Start Docker containers in background mode (daemon)"
	@echo "  update                - Update Composer dependencies"
	@echo ""
	@echo "Code quality:"
	@echo ""
	@echo "  lint                  - Run the linter to check PHP and JS code style"
	@echo "  fix                   - Automatically fix PHP and JS code style issues"
	@echo "  lint-php              - Check PHP code style with PHP-CS-Fixer"
	@echo "  fix-php               - Automatically fix PHP code style with PHP-CS-Fixer"
	@echo "  lint-js               - Check JavaScript files indentation"
	@echo "  fix-js                - Indent JavaScript files with 4 spaces"
	@echo ""
	@echo "ELP Processing:"
	@echo ""
	@echo "  convert-elp           - Convert eXeLearning v2.x file to v3.0 format"
	@echo "  export-elp            - Export .elp file to any supported format (requires FORMAT, INPUT, OUTPUT)"
	@echo "  export-elp-html5      - Export .elp to HTML5 format (alias for export-elp FORMAT=html5)"
	@echo "  export-elp-html5-sp   - Export .elp to single-page HTML5 format (alias for FORMAT=html5-sp)"
	@echo "  export-elp-scorm12    - Export .elp to SCORM 1.2 format (alias for FORMAT=scorm12)"
	@echo "  export-elp-scorm2004  - Export .elp to SCORM 2004 format (alias for FORMAT=scorm2004)"
	@echo "  export-elp-ims        - Export .elp to IMS format (alias for FORMAT=ims)"
	@echo "  export-elp-epub3      - Export .elp to EPUB 3 format (alias for FORMAT=epub3)"
	@echo "  export-elp-elp        - Re-export .elp file (alias for FORMAT=elp)"
	@echo ""
	@echo "Data:"
	@echo ""
	@echo "  create-user           - Ask for data and create user in Symonfy"
	@echo "  make-migration        - Generate a new Symfony migration (make:migration)"
	@echo "  migrate               - Run pending Symfony migrations (doctrine:migrations:migrate)"
	@echo ""
	@echo "Testing:"
	@echo ""
	@echo "  phpunit               - Run unit tests with PHPUnit"
	@echo "  test                  - Run ALL tests with PHPUnit"
	@echo "  test-unit             - Run unit tests with PHPUnit"
	@echo "  test-e2e              - Run e2e tests with PHPUnit (chrome)"
	@echo "  test-e2e-realtime     - Run e2e-realtime tests with PHPUnit (chrome)"
	@echo "  test-shell            - Open a shell inside the exelearning container (and the chrome container)"
	@echo "  test-local            - Run unit tests in local environment (no Docker, SQLite tmp DB)"
	@echo ""
	@echo "Packaging:"
	@echo ""
	@echo "  run-app               - Run the app locally as it would work when packaged"
	@echo "  package               - Generate installers for current platform with specified version (usage: make package VERSION=x.y.z)"
	@echo ""
	@echo "Translations (i18n):"
	@echo ""
	@echo "  translations          - Update translation strings"
	@echo ""
	@echo "Other:"
	@echo ""
	@echo "  help                  - Display this help with available commands"
	@echo ""

# Set help as the default goal if no target is specified
.DEFAULT_GOAL := help
