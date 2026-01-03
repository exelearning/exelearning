#!/bin/sh
set -e

# Colors for messages (only if terminal supports it)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    GREEN=''
    YELLOW=''
    NC=''
fi

log()  { printf "%b[entrypoint] %s%b\n" "${GREEN}" "$1" "${NC}"; }
warn() { printf "%b[entrypoint] %s%b\n" "${YELLOW}" "$1" "${NC}"; }

# Create data directories from environment variables if they don't exist
if [ -n "$FILES_DIR" ]; then
    mkdir -p "$FILES_DIR" 2>/dev/null || true
    log "Ensured FILES_DIR exists: $FILES_DIR"
fi

# DB_PATH directory for SQLite database
if [ -n "$DB_PATH" ] && [ "$DB_PATH" != ":memory:" ]; then
    DB_DIR=$(dirname "$DB_PATH")
    mkdir -p "$DB_DIR" 2>/dev/null || true
    log "Ensured DB directory exists: $DB_DIR"
fi

# Wait for external database if configured
if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
    log "Waiting for database at $DB_HOST:$DB_PORT..."
    timeout=60
    elapsed=0
    while ! nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
        if [ $elapsed -ge $timeout ]; then
            warn "Timeout waiting for database after ${timeout}s, continuing anyway..."
            break
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done
    if [ $elapsed -lt $timeout ]; then
        log "Database is ready!"
    fi
fi

# Run database migrations
log "Running database migrations..."
bun cli migrate up || warn "Migration failed (may already be up-to-date)"

# Execute post-configuration commands if set
# This is used for things like creating test users on first startup
if [ -n "$POST_CONFIGURE_COMMANDS" ]; then
    log "Executing post-configure commands..."
    eval "$POST_CONFIGURE_COMMANDS" || warn "Some post-configure commands failed"
fi

log "Starting application..."

# Execute the main command
exec "$@"
