#!/bin/bash
# Hook: run unit tests with coverage
# Runs: make test-unit (bun test with 90% threshold)

cd "$CLAUDE_PROJECT_DIR" || exit 0

make test-unit >&2 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "Unit tests failed" >&2
    exit 2
fi
