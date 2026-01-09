# Development Environment

## Overview

eXeLearning uses **Bun** as the runtime and **Elysia** as the web framework. The development environment is straightforward to set up with minimal dependencies.

## Prerequisites

- **Bun** (v1.0+) - [Install Bun](https://bun.sh/docs/installation)
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

# 3. Install dependencies
bun install

# 4. Start development server
bun run start:dev
```

The application will be available at [http://localhost:8080](http://localhost:8080).

**Default credentials:**
- User: `user@exelearning.net`
- Password: `1234`

## Project Structure

```
exelearning/
├── src/                   # Elysia backend (TypeScript)
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── db/                # Kysely database
│   └── websocket/         # Yjs WebSocket
├── public/                # Static files
│   └── app/               # Vanilla JS frontend
├── views/                 # Nunjucks templates
├── test/                  # Integration tests
├── main.js                # Electron main process
└── package.json
```

## Makefile Commands

The project provides a Makefile for common tasks:

### Basic Commands

| Command | Description |
|---------|-------------|
| `make install` | Install dependencies (`bun install`) |
| `make start:dev` | Start development server with hot reload |
| `make build` | Build for production |
| `make help` | Show all available commands |

### Testing Commands

| Command | Description |
|---------|-------------|
| `make test` | Run all tests |
| `make test-unit` | Run unit tests with coverage |
| `make test-integration` | Run integration tests |
| `make test-frontend` | Run frontend tests (Vitest) |
| `make test-e2e` | Run E2E tests (Playwright) |
| `make test-coverage` | Run tests with coverage report |

### Code Quality

| Command | Description |
|---------|-------------|
| `make lint` | Run ESLint |
| `make fix` | Auto-fix linting issues |
| `make format` | Format code with Prettier |

### CLI Commands

| Command | Description |
|---------|-------------|
| `make create-user` | Create a new user |
| `make generate-jwt` | Generate a JWT token |

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

The development server (`bun run start:dev`) includes hot reload:
- Backend changes restart the server automatically
- Frontend changes are served immediately (static files)

## Using Docker

For containerized development, use the provided Docker configuration:

```bash
# Build and run
docker compose up

# Run in background
docker compose up -d
```

See [Deployment](../deployment.md) for production Docker configuration.

## Troubleshooting

### Port Already in Use

Change `APP_PORT` in `.env`:
```bash
APP_PORT=8081 bun run start:dev
```

### Database Issues

For SQLite, ensure the database directory exists and is writable:
```bash
mkdir -p /mnt/data
```

For in-memory testing:
```bash
DB_PATH=:memory: bun run start:dev
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
