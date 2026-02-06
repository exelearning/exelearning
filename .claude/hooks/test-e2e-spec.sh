#!/bin/bash
# Hook: run a single E2E spec file with Chromium
# Receives the spec path via stdin JSON (.tool_input.command)
# Usage: triggered on Stop event to run a specific spec

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Read the spec file from the hook input, or use a default
INPUT=$(cat)
SPEC_FILE=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$SPEC_FILE" ]; then
    SPEC_FILE="test/e2e/playwright/specs/project-clone-duplicate.spec.ts"
fi

bun x playwright test --project=chromium "$SPEC_FILE" >&2 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "E2E spec test failed: $SPEC_FILE" >&2
    exit 2
fi
