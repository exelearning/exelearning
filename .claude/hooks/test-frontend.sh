#!/bin/bash
# Hook: run frontend tests with coverage
# Runs: make test-frontend (Vitest + happy-dom)

cd "$CLAUDE_PROJECT_DIR" || exit 0

make test-frontend >&2 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "Frontend tests failed" >&2
    exit 2
fi
