#!/bin/bash
# Hook: run E2E tests against static build
# Runs: make test-e2e-static (Playwright + static build)

cd "$CLAUDE_PROJECT_DIR" || exit 0

make build-static
make test-e2e-static >&2 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "E2E static tests failed" >&2
    exit 2
fi
