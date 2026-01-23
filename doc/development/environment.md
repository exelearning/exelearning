# Development Environment

## Overview

eXeLearning uses **Bun** as the runtime and **Elysia** as the web framework. The development environment is straightforward to set up with minimal dependencies.

## Prerequisites

- **Bun** (v1.3+) - [Install Bun](https://bun.sh/docs/installation)
- **Git**

Supported operating systems:
- Linux (Ubuntu, Fedora, etc.)
- macOS
- Windows with WSL2

### Installing Bun

```bash
# macOS / Linux / WSL
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/exelearning/exelearning.git

# 2. Enter the project directory
cd exelearning

# 3. Start development server (installs deps + builds assets automatically)
make up-local
```

The application will be available at [http://localhost:8080](http://localhost:8080).

**Default credentials:**
- User: `user@exelearning.net`
- Password: `1234`

## Project Structure

```
exelearning/
├── src/                   # Elysia backend (TypeScript)
│   ├── index.ts           # Elysia entry point
│   ├── routes/            # API routes (Elysia plugins)
│   ├── services/          # Business logic
│   ├── shared/            # Shared code (export/, import/)
│   ├── db/                # Kysely: client, dialect, migrations, queries
│   ├── websocket/         # Yjs collaboration, room/asset management
│   ├── yjs/               # Server-side Yjs operations (for REST API)
│   ├── cli/               # CLI commands (export, user management)
│   ├── utils/             # Utility functions
│   └── exceptions/        # Custom exceptions
├── public/                # Static files
│   ├── app/               # Vanilla JS frontend
│   │   ├── yjs/           # Yjs integration (DocumentManager, AssetManager)
│   │   ├── common/        # Common components (math, media, effects)
│   │   ├── workarea/      # Editor UI (interface, idevices, menus, modals)
│   │   ├── admin/         # Admin panel
│   │   ├── locate/        # Internationalization (i18n)
│   │   └── rest/          # REST API client calls
│   ├── libs/              # External libraries (jQuery, TinyMCE, Bootstrap)
│   ├── files/perm/        # Permanent files (themes, idevices)
│   └── style/             # Compiled CSS
├── assets/styles/         # SCSS source files
├── views/                 # Nunjucks templates
├── translations/          # i18n files (messages.{locale}.xlf)
├── doc/                   # Documentation
├── test/                  # Tests (integration/, e2e/, fixtures/)
├── main.js                # Electron main process
├── Makefile               # Build commands
└── package.json           # Dependencies
```

## Makefile Commands

The project provides a Makefile for common tasks:

### Basic Commands

| Command | Description |
|---------|-------------|
| `make up-local` | Start development server (installs deps + hot reload) |
| `make help` | Show all available commands |

### Testing Commands

| Command | Description |
|---------|-------------|
| `make test` | Run all tests |
| `make test-unit` | Run unit tests with coverage |
| `make test-integration` | Run integration tests |
| `make test-frontend` | Run frontend tests (Vitest) |
| `make test-e2e` | Run E2E tests (Playwright) |
| `make test-e2e-firefox` | Run E2E tests with Firefox (Playwright) |
| `make test-e2e-mariadb` | Run E2E tests with MariaDB (Playwright) |
| `make test-e2e-postgres` | Run E2E tests with PostgreSQL (Playwright) |


### Code Quality

| Command | Description |
|---------|-------------|
| `make lint` | Run Biome linter |
| `make fix` | Auto-fix linting issues |

### CLI Commands

| Command | Description |
|---------|-------------|
| `make create-user EMAIL=x PASSWORD=y USER_ID=z` | Create a new user |
| `make promote-admin EMAIL=x` | Grant ROLE_ADMIN to user |
| `make demote-admin EMAIL=x` | Remove ROLE_ADMIN from user |
| `make grant-role EMAIL=x ROLE=y` | Add role to user |
| `make revoke-role EMAIL=x ROLE=y` | Remove role from user |
| `make generate-jwt EMAIL=x [TTL=3600]` | Generate JWT token |
| `make tmp-cleanup [MAX_AGE=86400]` | Clean temporary files |
| `make translations [LOCALE=es]` | Extract/clean translations |

### ELPX Processing

| Command | Description |
|---------|-------------|
| `make convert-elp INPUT=x OUTPUT=y` | Convert legacy ELP to ELPX format |
| `make export-html5 INPUT=x OUTPUT=y` | Export to HTML5 |
| `make export-html5-sp INPUT=x OUTPUT=y` | Export to HTML5 single-page |
| `make export-scorm12 INPUT=x OUTPUT=y` | Export to SCORM 1.2 |
| `make export-scorm2004 INPUT=x OUTPUT=y` | Export to SCORM 2004 |
| `make export-ims INPUT=x OUTPUT=y` | Export to IMS Content Package |
| `make export-epub3 INPUT=x OUTPUT=y` | Export to EPUB3 |

## Configuration

### Environment Variables

Copy `.env.dist` to `.env` and customize as needed:

```bash
cp .env.dist .env
```

Key variables:

```bash
# Server
APP_PORT=8080
APP_SECRET=your-jwt-secret-key

# Database (SQLite by default)
DB_DRIVER=pdo_sqlite
DB_PATH=/mnt/data/exelearning.db

# File storage
FILES_DIR=/mnt/data/

# Authentication methods
APP_AUTH_METHODS=password,guest

# Base path (for subdirectory installs)
BASE_PATH=
```

### Database Configuration

**SQLite (default):**
```bash
DB_DRIVER=pdo_sqlite
DB_PATH=/mnt/data/exelearning.db
```

**PostgreSQL:**
```bash
DB_DRIVER=pdo_pgsql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=exelearning
DB_USER=myuser
DB_PASSWORD=mypassword
```

**MySQL/MariaDB:**
```bash
DB_DRIVER=pdo_mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=exelearning
DB_USER=root
DB_PASSWORD=secret
```

## Real-Time Collaboration

eXeLearning uses **Yjs** for real-time collaborative editing over WebSocket.

Two test users are provided:
- Primary: `user@exelearning.net` / `1234`
- Secondary: `user2@exelearning.net` / `1234`

For details, see [Real-Time Collaboration](real-time.md).

## Debugging

### VS Code Setup

1. Install extensions:
   - ESLint
   - Prettier
   - TypeScript + JavaScript

2. Create `.vscode/launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "bun",
            "request": "launch",
            "name": "Debug Bun",
            "program": "${workspaceFolder}/src/index.ts",
            "cwd": "${workspaceFolder}",
            "env": {
                "DB_PATH": ":memory:"
            }
        }
    ]
}
```

3. Set breakpoints and press F5 to start debugging.

### Hot Reload

The development server (`make up-local`) includes hot reload:
- Backend changes restart the server automatically
- Frontend changes are served immediately (static files)

## Using Docker

### Starting the Environment

```bash
make up               # Start Docker (development mode)
make up APP_ENV=prod  # Start in production mode
make upd              # Start in background (detached)
make down             # Stop Docker
make shell            # Open shell inside container
make logs             # View container logs
```

### Running CLI Commands Inside Docker

When eXeLearning runs in Docker, execute CLI commands inside the container:

```bash
# General pattern
docker compose exec exelearning bun cli <command> [arguments]

# User management
docker compose exec exelearning bun cli create-user admin@example.com password123 admin
docker compose exec exelearning bun cli promote-admin admin@example.com

# Generate JWT token
docker compose exec exelearning bun cli jwt:generate admin@example.com --ttl=86400

# Export commands
docker compose exec exelearning bun cli elp:export /data/input.elpx /data/output --format=html5
docker compose exec exelearning bun cli elp:convert /data/legacy.elp /data/output.elpx

# Cleanup
docker compose exec exelearning bun cli tmp:cleanup --max-age=86400
```

### Interactive Shell

For multiple commands or debugging:

```bash
make shell
# Inside container:
bun cli --help
bun cli create-user test@example.com test123 testuser
```

See [Deployment](../deployment.md) for production Docker configuration.

## Troubleshooting

### Port Already in Use

Change `APP_PORT` in `.env` or override it:
```bash
APP_PORT=8081 make up-local
```

### Database Issues

For SQLite, ensure the database directory exists and is writable:
```bash
mkdir -p /mnt/data
```

### Bun Installation Issues

If `bun` command not found after installation:
```bash
# Add to PATH (add to .bashrc or .zshrc)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

### Windows/WSL Issues

For best performance on Windows:
1. Use WSL2 (not WSL1)
2. Clone the repository inside WSL filesystem (`~/projects/`)
3. Run all commands from WSL terminal

---

## See Also

- [Architecture Overview](../architecture.md)
- [Testing Guide](testing.md)
- [Real-Time Collaboration](real-time.md)
- [Deployment](../deployment.md)
