#!/bin/bash
# Hook: run integration tests
# Runs: make test-integration

cd "$CLAUDE_PROJECT_DIR" || exit 0

make test-integration >&2 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "Integration tests failed" >&2
    exit 2
fi
