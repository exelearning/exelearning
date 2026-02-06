#!/bin/bash
# Hook: run E2E tests with Chromium
# Runs: make test-e2e-chromium (Playwright)

cd "$CLAUDE_PROJECT_DIR" || exit 0

make test-e2e-chromium >&2 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "E2E Chromium tests failed" >&2
    exit 2
fi
