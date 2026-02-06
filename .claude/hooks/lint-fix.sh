#!/bin/bash
# PostToolUse hook: auto-fix lint after file edits
# Runs: make fix (biome check --write on src/, public/app/, test/)

cd "$CLAUDE_PROJECT_DIR" || exit 0

make fix >&2 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "Lint fix failed" >&2
    exit 2
fi
