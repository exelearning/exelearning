---
name: test-driven-development
description: Apply Red–Green–Refactor to Boolean Core, parsers, ASTs, evaluators, equivalence, truth-table and Karnaugh validators, circuit engines, deterministic graders, and bug fixes. Use before implementation code; use characterization or integration tests for legacy lifecycle/UI behavior where isolated unit tests are unsuitable.
---

# Test-Driven Development

Read `SPEC.md`, `PLAN.md`, the active Task Packet, and `../exelearning-logic-alpha/SKILL.md` before changing code.

## Red–Green–Refactor

1. **Red:** write one minimal test for the required behavior.
2. Run the narrowest relevant test command and confirm it fails for the expected missing behavior, not a setup error.
3. **Green:** implement only enough code to pass that test.
4. Run the focused test and the relevant regression suite.
5. **Refactor:** improve structure only while all tests stay green.
6. Repeat for the next behavior.

Do not claim TDD when the test first ran after the implementation or passed immediately without proving the missing behavior.

## Project Application

- Use unit, property, and golden tests for pure Core, validators, engines, and graders.
- Use characterization tests before changing existing behavior.
- Use integration or smoke tests for eXeLearning lifecycle, UI wiring, save/open, preview, and export when a unit test cannot represent the boundary.
- Preserve existing user and upstream changes. Never delete pre-existing work merely to recreate it through TDD.
- Keep deterministic grading independent of DOM and Electron.
- Test syntax errors, invalid data, boundary cases, and stable ordering, not only happy paths.

## Test Quality

- Test one behavior with a descriptive name.
- Prefer real behavior and dependency injection over assertions about mocks.
- Do not add test-only methods to production APIs.
- Mirror complete external data structures when a mock is unavoidable.
- Do not skip or disable tests to make a gate pass.

Read [testing-anti-patterns.md](testing-anti-patterns.md) before adding mocks or test utilities.

## Completion Evidence

Record the failing command/output, the passing command/output, relevant regression results, and any coverage result required by `AGENTS.md`. Without both red and green evidence, leave the task open.
